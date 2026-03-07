import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type TierRecord = { tier: number };
type ProfileRecord = { id: string; business_name: string; plan_status: string };

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function chunkText(text: string, size = 800, overlap = 120) {
  const chunks: string[] = [];
  if (!text) return chunks;

  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + size);
    const part = cleanText(text.slice(start, end));
    if (part.length > 0) chunks.push(part);
    if (end === text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

function extractTextFallbackFromPdf(buffer: Buffer) {
  // Heuristic fallback for malformed PDFs where strict parser fails (e.g. bad XRef).
  // It scans stream sections and keeps printable text only.
  const raw = buffer.toString("latin1");
  const streamMatches = raw.match(/stream[\r\n]+([\s\S]*?)endstream/g) || [];

  const extracted = streamMatches
    .map((chunk) =>
      chunk
        .replace(/^stream[\r\n]+/, "")
        .replace(/endstream$/, "")
        .replace(/\\\(([\s\S]*?)\\\)/g, " $1 ")
        .replace(/\(([^\)]{2,})\)/g, " $1 ")
        .replace(/\\[nrtbf()\\]/g, " ")
        .replace(/[^\x20-\x7E\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .join(" ")
    .trim();

  return cleanText(extracted);
}

async function getActiveTier(admin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const { data } = await admin
    .from("payments")
    .select("tier")
    .eq("user_id", userId)
    .eq("status", "SUCCESS")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<TierRecord>();

  return data?.tier || 0;
}

async function ensureKbBucket(admin: ReturnType<typeof getSupabaseAdmin>) {
  const storage = admin.storage;
  const { data: existing, error: getBucketError } = await storage.getBucket("kb-files");

  if (!getBucketError && existing?.id) {
    return;
  }

  const { error: createError } = await storage.createBucket("kb-files", {
    public: false,
  });

  if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
    throw new Error(`Storage bucket setup failed: ${createError.message}`);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile } = await admin
      .from("business_profiles")
      .select("id, business_name, plan_status")
      .eq("user_id", user.id)
      .maybeSingle<ProfileRecord>();

    if (!profile || profile.plan_status !== "active") {
      return NextResponse.json({ error: "Complete payment before using dashboard features." }, { status: 403 });
    }

    const tier = await getActiveTier(admin, user.id);
    if (tier < 1) {
      return NextResponse.json({ error: "Your plan does not allow PDF upload." }, { status: 403 });
    }

    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const kind = String(formData.get("kind") || "general").trim();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    }

    const extension = path.extname(file.name).toLowerCase();
    const isPdf = file.type === "application/pdf" || extension === ".pdf";
    if (!isPdf) {
      return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "PDF is too large. Max 10MB." }, { status: 400 });
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${profile.id}/${Date.now()}-${safeFileName}`;

    await ensureKbBucket(admin);

    let storageErrorMessage = "";
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { error: storageError } = await admin.storage.from("kb-files").upload(storagePath, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

      if (!storageError) {
        storageErrorMessage = "";
        break;
      }

      storageErrorMessage = storageError.message;

      // One-time self-heal for fresh projects where bucket metadata is missing.
      if (attempt === 1 && /bucket|not found|does not exist/i.test(storageError.message || "")) {
        await ensureKbBucket(admin);
      }
    }

    if (storageErrorMessage) {
      return NextResponse.json(
        {
          error: `Storage upload failed: ${storageErrorMessage}. Ensure Supabase bucket 'kb-files' exists in this project.`,
        },
        { status: 500 },
      );
    }

    const { data: insertedDoc, error: docError } = await admin
      .from("kb_documents")
      .insert({
        business_profile_id: profile.id,
        title: title || file.name,
        file_name: file.name,
        mime_type: file.type || "application/pdf",
        storage_path: storagePath,
        document_kind: kind || "general",
        status: "processing",
      })
      .select("id, title, file_name, status")
      .single();

    if (docError || !insertedDoc) {
      return NextResponse.json({ error: `Failed to save document: ${docError?.message || "Unknown error"}` }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let chunks: string[] = [];

    try {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      chunks = chunkText(parsed.text || "");
    } catch (parseError) {
      const fallbackText = extractTextFallbackFromPdf(buffer);
      chunks = chunkText(fallbackText || "");

      if (chunks.length === 0) {
        await admin.from("kb_documents").update({ status: "failed" }).eq("id", insertedDoc.id);
        const message =
          parseError instanceof Error
            ? parseError.message
            : "PDF parsing failed. Try exporting as a searchable PDF.";
        return NextResponse.json(
          {
            error:
              `PDF parsing failed: ${message}. Please re-export this file as searchable PDF (Print to PDF) and upload again.`,
          },
          { status: 500 },
        );
      }
    }

    if (chunks.length > 0) {
      const chunkRows = chunks.map((content, index) => ({
        business_profile_id: profile.id,
        document_id: insertedDoc.id,
        chunk_index: index,
        content,
        metadata: { source_file: file.name },
      }));

      const { error: chunkError } = await admin.from("kb_chunks").insert(chunkRows);
      if (chunkError) {
        await admin.from("kb_documents").update({ status: "failed" }).eq("id", insertedDoc.id);
        return NextResponse.json({ error: `Failed to index chunks: ${chunkError.message}` }, { status: 500 });
      }
    }

    await admin.from("kb_documents").update({ status: "ready" }).eq("id", insertedDoc.id);

    return NextResponse.json({
      ok: true,
      document: {
        id: insertedDoc.id,
        title: insertedDoc.title,
        fileName: insertedDoc.file_name,
        status: "ready",
      },
      chunksCreated: chunks.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "PDF upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
