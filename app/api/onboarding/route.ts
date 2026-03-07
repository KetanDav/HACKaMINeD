import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestKnowledgeBase } from "@/lib/kb/indexer";

export const runtime = "nodejs";

type IncomingPayload = {
  business: {
    businessName: string;
    ownerName: string;
    email: string;
    phone: string;
    city: string;
    category: "doctor" | "hotel";
  };
  tier: 1 | 2 | 3 | 4;
  kbFiles: Array<{ name: string; size: number; type: string }>;
  integrationConfig: Record<string, unknown>;
};

type ParsedPayload = IncomingPayload & {
  kbFileObjects: File[];
};

function generateIndianNumber() {
  const first = 6 + Math.floor(Math.random() * 4);
  const remaining = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  return `+91 ${first}${remaining.slice(0, 4)} ${remaining.slice(4)}`;
}

function toTierPlan(tier: number): "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" {
  switch (tier) {
    case 1:
      return "TIER_1";
    case 2:
      return "TIER_2";
    case 3:
      return "TIER_3";
    default:
      return "TIER_4";
  }
}

function createBusinessSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "business"
  );
}

function validatePayload(payload: IncomingPayload) {
  if (!payload?.business?.businessName?.trim()) return "Business name is required.";
  if (!payload?.business?.ownerName?.trim()) return "Owner name is required.";
  if (!payload?.business?.email?.trim()) return "Email is required.";
  if (!payload?.business?.phone?.trim()) return "Phone is required.";
  if (!payload?.business?.city?.trim()) return "City is required.";
  if (!payload?.tier) return "Tier is required.";
  if (!Array.isArray(payload?.kbFiles) || payload.kbFiles.length === 0) {
    return "At least one KB file is required.";
  }
  if (payload.kbFiles.length > 5) return "You can upload up to 5 KB files.";
  if (payload.kbFiles.some((file) => file.size > 10 * 1024 * 1024)) {
    return "Each KB file must be 10MB or smaller.";
  }
  return null;
}

async function parseRequestPayload(request: Request): Promise<ParsedPayload> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const businessRaw = String(formData.get("business") || "{}");
    const tierRaw = Number(formData.get("tier") || "1");
    const integrationConfigRaw = String(formData.get("integrationConfig") || "{}");
    const fileEntries = formData.getAll("kbFiles").filter((item): item is File => item instanceof File);

    const business = JSON.parse(businessRaw) as IncomingPayload["business"];
    const integrationConfig = JSON.parse(integrationConfigRaw) as IncomingPayload["integrationConfig"];

    return {
      business,
      tier: (tierRaw as 1 | 2 | 3 | 4),
      kbFiles: fileEntries.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
      kbFileObjects: fileEntries,
      integrationConfig,
    };
  }

  const json = (await request.json()) as IncomingPayload;
  return {
    ...json,
    kbFileObjects: [],
  };
}

export async function POST(request: Request) {
  try {
    const payload = await parseRequestPayload(request);
    const validationError = validatePayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const tierPlan = toTierPlan(payload.tier);
    const provisionedNumber = generateIndianNumber();

    const enableDashboard = Boolean(
      payload.tier === 3 ||
      (payload.tier === 4 && Boolean(payload.integrationConfig?.enableDashboard)),
    );

    const dashboardUrl = enableDashboard
      ? `https://${createBusinessSlug(payload.business.businessName)}.mydomain.in`
      : null;

    let record: {
      id: string;
      provisionedNumber: string;
      dashboardUrl: string | null;
      createdAt: Date;
    };

    try {
      // 1. Create the new Tenant
      const tenant = await prisma.tenant.create({
        data: {
          name: payload.business.businessName,
          industry: payload.business.category,
          city: payload.business.city,
          tier: tierPlan,
          contactEmail: payload.business.email,
          contactPhone: payload.business.phone,
          websiteUrl: dashboardUrl,
          // You could also create initial integrations based on payload.integrationConfig
          // but for now we just store the essential Tenant data.
        },
      });

      // 2. Link a Twilio Phone Number
      // (If TWILIO_PHONE_NUMBER is set, use it; otherwise mock a number for the UI)
      const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
      let finalNumber = provisionedNumber;

      if (twilioNumber) {
        finalNumber = twilioNumber;
        await prisma.phoneNumber.upsert({
          where: { number: twilioNumber },
          update: { tenantId: tenant.id },
          create: {
            tenantId: tenant.id,
            number: twilioNumber,
            provider: "twilio",
            status: "active",
          },
        });
      } else {
        await prisma.phoneNumber.create({
          data: {
            tenantId: tenant.id,
            number: provisionedNumber,
            provider: "mock",
            status: "active",
          },
        });
      }

      record = {
        id: tenant.id,
        provisionedNumber: finalNumber,
        dashboardUrl,
        createdAt: tenant.createdAt,
      };

    } catch (e) {
      console.error("Failed to create tenant record:", e);
      record = {
        id: `local_${Date.now()}`,
        provisionedNumber,
        dashboardUrl,
        createdAt: new Date(),
      };
    }

    let kbIngestion: { filesProcessed: number; chunksCreated: number } | null = null;
    if (payload.kbFileObjects.length > 0) {
      // Pass the tenant.id to the indexer so it creates Policy records for this specific tenant
      kbIngestion = await ingestKnowledgeBase(record.id, payload.kbFileObjects);
    }

    return NextResponse.json({
      onboardingId: record.id,
      knowledgeBaseId: record.id,
      provisionedNumber: record.provisionedNumber,
      dashboardUrl: record.dashboardUrl,
      createdAt: record.createdAt,
      kbIngestion,
    });
  } catch (error) {
    console.error("onboarding create failed", error);
    return NextResponse.json({ error: "Failed to save onboarding." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitValue = Number(searchParams.get("limit") || "20");
    const limit = Number.isFinite(limitValue)
      ? Math.max(1, Math.min(limitValue, 100))
      : 20;

    const records = await prisma.onboardingSubmission.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        businessName: true,
        ownerName: true,
        email: true,
        phone: true,
        city: true,
        category: true,
        tier: true,
        provisionedNumber: true,
        dashboardUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      count: records.length,
      records,
    });
  } catch (error) {
    console.error("onboarding list failed", error);
    return NextResponse.json({ error: "Failed to fetch onboardings." }, { status: 500 });
  }
}
