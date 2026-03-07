import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

const tierNames: Record<number, string> = {
  1: "Starter",
  2: "Connect",
  3: "Growth",
  4: "Elite",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard");
  }

  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("business_profiles")
    .select("id, business_name, category, city, phone, timezone, plan_status, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: latestPayment } = await admin
    .from("payments")
    .select("tier, amount, currency, status, order_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasSuccessfulPayment = latestPayment?.status === "SUCCESS";

  // Payment is the source of truth. Keep profile status in sync.
  if (profile && hasSuccessfulPayment && profile.plan_status !== "active") {
    await admin.from("business_profiles").update({ plan_status: "active" }).eq("id", profile.id);
    profile.plan_status = "active";
  }

  // Block dashboard only when user is genuinely unpaid.
  if (!profile || (!hasSuccessfulPayment && profile.plan_status !== "active")) {
    redirect("/onboarding");
  }

  const currentTier = latestPayment?.tier || 1;

  const { data: docs } = await admin
    .from("kb_documents")
    .select("id, title, file_name, document_kind, status, created_at")
    .eq("business_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: appointmentSlots } = await admin
    .from("appointment_slots")
    .select("id, slot_date, slot_time, status, customer_name, customer_phone")
    .eq("business_profile_id", profile.id)
    .order("slot_date", { ascending: true })
    .order("slot_time", { ascending: true })
    .limit(300);

  const { data: flags } = await admin
    .from("feature_flags")
    .select("whatsapp_enabled")
    .eq("business_profile_id", profile.id)
    .maybeSingle();

  const { data: customToolsFact } = await admin
    .from("business_facts")
    .select("fact_value")
    .eq("business_profile_id", profile.id)
    .eq("fact_key", "custom_mcp_tools")
    .maybeSingle();

  const { data: existingAllocation } = await admin
    .from("telephony_allocations")
    .select("phone_number")
    .eq("business_profile_id", profile.id)
    .maybeSingle<{ phone_number: string }>();

  const productionPhone =
    process.env.TWILIO_PROD_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER || "";
  const productionAccountLabel =
    process.env.TWILIO_PROD_ACCOUNT_LABEL ||
    process.env.TWILIO_PROD_ACCOUNT_SID ||
    process.env.TWILIO_ACCOUNT_SID ||
    "primary";

  // One-user deployment mode: auto-bind production number to this active business.
  if (!existingAllocation?.phone_number && productionPhone) {
    await admin.from("telephony_allocations").upsert(
      {
        business_profile_id: profile.id,
        phone_number: productionPhone,
        twilio_account_label: productionAccountLabel,
        status: "assigned",
      },
      { onConflict: "business_profile_id" },
    );
  }

  const assignedPhoneNumber = existingAllocation?.phone_number || productionPhone || "Not assigned";

  const customTools = Array.isArray(customToolsFact?.fact_value?.tools)
    ? customToolsFact?.fact_value?.tools
    : [];

  return (
    <main className="min-h-screen bg-[#06101a] px-5 py-10 text-[#e7f1ff] sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-[#4a739f]/40 bg-[linear-gradient(140deg,#10243a_0%,#0a1a2d_72%,#0d2b4a_100%)] px-6 py-8 shadow-[0_22px_120px_rgba(16,87,170,0.2)] sm:px-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8ed9ff]">Dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
            {profile?.business_name || "Your business workspace"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-[#bfd2ed] sm:text-base">
            Operations workspace for Callify. Manage your business knowledge base, channel features,
            and advanced automation based on your active tier.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="rounded-full border border-white/20 px-5 py-2 text-sm text-[#d7e5f9] hover:bg-white/10"
            >
              Edit onboarding
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card label="Plan Status" value={profile?.plan_status || "draft"} />
          <Card
            label="Active Tier"
            value={latestPayment?.tier ? `Tier ${latestPayment.tier} - ${tierNames[latestPayment.tier]}` : "Not selected"}
          />
          <Card
            label="Latest Payment"
            value={latestPayment ? `${latestPayment.currency} ${latestPayment.amount} (${latestPayment.status})` : "No payment yet"}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Business Snapshot</h2>
            <div className="mt-4 space-y-2 text-sm text-[#c8d9f1]">
              <DataRow label="Category" value={profile?.category || "-"} />
              <DataRow label="City" value={profile?.city || "-"} />
              <DataRow label="Phone" value={profile?.phone || "-"} />
              <DataRow label="Timezone" value={profile?.timezone || "-"} />
              <DataRow label="Onboarded On" value={profile?.created_at ? new Date(profile.created_at).toLocaleString() : "-"} />
            </div>
          </div>

          <div className="rounded-2xl border border-[#8edcff]/30 bg-[#0a1f34] p-5">
            <h2 className="text-lg font-semibold">Workspace Status</h2>
            <ul className="mt-4 space-y-2 text-sm text-[#b5d0ee]">
              <li>- Documents uploaded: {(docs || []).length}</li>
              <li>- WhatsApp enabled: {flags?.whatsapp_enabled ? "Yes" : "No"}</li>
              <li>- Custom MCP tools: {customTools.length}</li>
              <li>- Assigned production number: {assignedPhoneNumber}</li>
              <li>- Active tier gates: Tier {currentTier}</li>
            </ul>
          </div>
        </section>

        <DashboardClient
          tier={currentTier}
          tierName={tierNames[currentTier] || "Starter"}
          whatsappEnabled={Boolean(flags?.whatsapp_enabled)}
          documents={docs || []}
          appointmentSlots={appointmentSlots || []}
          customTools={customTools}
        />
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-[#8fabcf]">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0a1624] px-3 py-2">
      <span className="text-[#96b3d8]">{label}</span>
      <span className="text-[#e6f0ff]">{value}</span>
    </div>
  );
}
