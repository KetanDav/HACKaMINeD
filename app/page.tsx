"use client";

import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const stats = [
  { label: "Average Setup Time", value: "4 min" },
  { label: "Onboarding Steps", value: "3 only" },
  { label: "Payment to Dashboard", value: "Instant" },
];

const features = [
  {
    title: "Voice + Action",
    desc: "Callers speak naturally, Callify maps requests to business actions through MCP tools.",
  },
  {
    title: "Tiered Growth",
    desc: "Start with KB answering, unlock messaging, dashboard operations, and custom automation.",
  },
  {
    title: "AWS-Ready",
    desc: "Designed for AWS-native scaling with dedicated tenant numbers and hosted business dashboard links.",
  },
];

const plans = [
  {
    name: "Tier 1 • Starter",
    price: "₹199/mo",
    subtitle: "KB + AI Number",
    features: [
      "AI call answering from knowledge base",
      "One dedicated business number",
      "Any business category support",
    ],
  },
  {
    name: "Tier 2 • Connect",
    price: "₹399/mo",
    subtitle: "Comms Integrations",
    features: [
      "Everything in Tier 1",
      "Email + WhatsApp + Message config",
      "MCP tools for outbound notifications",
    ],
  },
  {
    name: "Tier 3 • Ops",
    price: "₹699/mo",
    subtitle: "Dashboard Included",
    features: [
      "Everything in Tier 2",
      "Hosted dashboard at business.mydomain.in",
      "Business operations on Callify AWS backend",
    ],
  },
  {
    name: "Tier 4 • Custom",
    price: "₹999/mo",
    subtitle: "Custom MCP + Self-hosted LLM",
    features: [
      "Tier 3 capabilities with optional modules",
      "Client-managed MCP tool customization",
      "Advanced AWS deployment profile",
    ],
  },
];

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(99,102,241,0.2),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.1),transparent_28%)]" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <p className="text-lg font-semibold tracking-tight">Callify</p>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/demo" className="text-sm text-slate-300 transition hover:text-white">
              Try Demo
            </Link>
            <a href="#plans" className="text-sm text-slate-300 transition hover:text-white">
              Plans
            </a>
            {user ? (
              <>
                <span className="text-sm text-slate-400">{user.email}</span>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
                >
                  Dashboard
                </Link>
                <button
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    setUser(null);
                    router.refresh();
                  }}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm text-slate-300 transition hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-6xl gap-10 px-6 pb-10 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200"
          >
            Regional AI Customer Care Infrastructure
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.55 }}
            className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl"
          >
            Professional AI Voice Support
            <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-emerald-300 bg-clip-text text-transparent">
              Built for Every Business
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.55 }}
            className="mt-5 max-w-2xl text-base text-slate-300 sm:text-lg"
          >
            Launch onboarding in minutes: capture business details, upload knowledge base,
            choose a tier, and complete payment. You are redirected directly to dashboard for next-phase setup.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.55 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link
              href="/onboarding"
              className="rounded-xl bg-cyan-400 px-6 py-3 font-medium text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-300"
            >
              Start 3-Step Onboarding
            </Link>
            <Link
              href="/demo"
              className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-6 py-3 font-medium text-cyan-200 transition hover:bg-cyan-300/20"
            >
              Try Demo Chat
            </Link>
            <a
              href="#plans"
              className="rounded-xl border border-white/20 px-6 py-3 font-medium transition hover:bg-white/10"
            >
              Explore Plans
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.55 }}
          className="rounded-3xl border border-white/15 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-500/10"
        >
          <p className="text-sm font-medium text-cyan-200">Live Setup Snapshot</p>
          <div className="mt-4 space-y-3 text-sm">
            <InfoRow label="Business" value="Sunrise Hotel" />
            <InfoRow label="Category" value="Hotel" />
            <InfoRow label="Tier" value="Tier 3 • Ops" />
            <InfoRow label="Step 1" value="Basic Business Details" />
            <InfoRow label="Step 2" value="Tier Selection" />
            <InfoRow label="Step 3" value="Payment -> Dashboard" />
          </div>
        </motion.div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-6 sm:grid-cols-3">
        {stats.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.08, duration: 0.45 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <p className="text-2xl font-semibold text-cyan-200">{item.value}</p>
            <p className="mt-1 text-sm text-slate-400">{item.label}</p>
          </motion.div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-semibold">Built for conversion-first onboarding</h2>
            <p className="mt-2 text-slate-400">Get customers to paid state quickly, then expand capabilities inside dashboard.</p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.45 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <p className="text-lg font-semibold">{item.title}</p>
              <p className="mt-2 text-sm text-slate-300">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="plans" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold">Tier Plans (Demo Pricing)</h2>
            <p className="mt-2 text-slate-400">
              Pricing below is demo-only for your pitch website.
            </p>
          </div>
          <a
            href="https://docs.cashfree.com/docs/test-and-go-live"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-300/15"
          >
            Cashfree Sandbox Docs
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:-translate-y-1 hover:border-cyan-300/30"
            >
              <p className="text-sm text-cyan-300">{plan.name}</p>
              <p className="mt-2 text-3xl font-semibold">{plan.price}</p>
              <p className="mt-1 text-sm text-slate-400">{plan.subtitle}</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-200">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <Link
                href="/onboarding"
                className="mt-6 inline-flex rounded-lg bg-white/10 px-4 py-2 text-sm transition group-hover:bg-cyan-400 group-hover:text-slate-900"
              >
                Choose {plan.name.split(" • ")[0]}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-sm text-slate-400">
          <p>Callify • AI Customer Care Infrastructure</p>
          <p>Demo site for tiered onboarding and AWS deployment readiness</p>
        </div>
      </footer>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}
