"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Tier = 1 | 2 | 3 | 4;
type Category = "doctor" | "hotel" | "salon" | "other";

type BusinessDetails = {
    businessName: string;
    category: Category;
    city: string;
    phone: string;
    timezone: string;
    systemPrompt: string;
};

const steps = ["Basic Details", "Choose Tier", "Payment"];

const tiers: Array<{
    id: Tier;
    name: string;
    price: string;
    amount: number;
    pitch: string;
    benefits: string[];
}> = [
        {
            id: 1,
            name: "Starter",
            price: "Rs 6 / month",
            amount: 6,
            pitch: "For launch and core customer call handling",
            benefits: ["AI call handling", "Basic business context", "One active voice flow"],
        },
        {
            id: 2,
            name: "Connect",
            price: "Rs 7 / month",
            amount: 7,
            pitch: "For teams that want messaging channels",
            benefits: ["Everything in Starter", "WhatsApp enablement", "Email and message actions"],
        },
        {
            id: 3,
            name: "Growth",
            price: "Rs 8 / month",
            amount: 8,
            pitch: "For operational teams scaling support",
            benefits: ["Everything in Connect", "Operations dashboard", "Priority routing support"],
        },
        {
            id: 4,
            name: "Elite",
            price: "Rs 9 / month",
            amount: 9,
            pitch: "For advanced workflows and customization",
            benefits: ["Everything in Growth", "Custom MCP tool hooks", "Advanced automation options"],
        },
    ];

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
    const raw = await response.text();
    if (!raw.trim()) return null;

    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function loadCashfreeSDK(): Promise<any> {
    return new Promise((resolve, reject) => {
        if ((window as any).Cashfree) {
            const cf = new (window as any).Cashfree({
                mode: process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT === "production" ? "production" : "sandbox",
            });
            resolve(cf);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
        script.onload = () => {
            if ((window as any).Cashfree) {
                const cf = new (window as any).Cashfree({
                    mode: process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT === "production" ? "production" : "sandbox",
                });
                resolve(cf);
            } else {
                reject(new Error("Cashfree SDK failed to load."));
            }
        };
        script.onerror = () => reject(new Error("Failed to load Cashfree SDK script."));
        document.head.appendChild(script);
    });
}

export default function OnboardingPage() {
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);
    const [step, setStep] = useState(0);
    const [tier, setTier] = useState<Tier | null>(null);
    const [businessId, setBusinessId] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [error, setError] = useState("");

    const [business, setBusiness] = useState<BusinessDetails>({
        businessName: "",
        category: "doctor",
        city: "",
        phone: "",
        timezone: "Asia/Kolkata",
        systemPrompt: "",
    });

    const selectedTier = useMemo(() => tiers.find((item) => item.id === tier) || null, [tier]);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((res) => {
                if (!res.ok) {
                    window.location.href = "/auth/login?redirect=/onboarding";
                    return;
                }
                setAuthChecked(true);
            })
            .catch(() => {
                window.location.href = "/auth/login?redirect=/onboarding";
            });
    }, []);

    function validateCurrentStep() {
        if (step === 0) {
            if (!business.businessName.trim()) return "Business name is required.";
            if (!business.city.trim()) return "City is required.";
            if (!business.phone.trim()) return "Phone number is required.";
        }

        if (step === 1 && !tier) {
            return "Please choose a tier.";
        }

        return "";
    }

    async function saveOnboardingDetails() {
        if (!tier) return null;

        setIsSaving(true);
        setError("");

        try {
            const response = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ business, tier }),
            });

            const data =
                (await parseJsonSafe<{ error?: string; businessId?: string }>(response)) || {};

            if (!response.ok || !data.businessId) {
                throw new Error(data.error || "Failed to save onboarding details.");
            }

            setBusinessId(data.businessId);
            return data.businessId;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save onboarding details.");
            return null;
        } finally {
            setIsSaving(false);
        }
    }

    async function handlePayment() {
        if (!tier) return;

        setIsPaying(true);
        setError("");

        try {
            let activeBusinessId = businessId;
            if (!activeBusinessId) {
                const savedId = await saveOnboardingDetails();
                if (!savedId) {
                    setIsPaying(false);
                    return;
                }
                activeBusinessId = savedId;
            }

            const checkoutRes = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessId: activeBusinessId, tier }),
            });

            const checkoutData =
                (await parseJsonSafe<{ error?: string; paymentSessionId?: string; orderId?: string }>(
                    checkoutRes,
                )) || {};

            if (checkoutRes.status === 401) {
                window.location.href = "/auth/login?redirect=/onboarding";
                return;
            }

            if (!checkoutRes.ok || !checkoutData.paymentSessionId || !checkoutData.orderId) {
                throw new Error(checkoutData.error || "Failed to initiate payment.");
            }

            const cashfree = await loadCashfreeSDK();
            const result = await cashfree.checkout({
                paymentSessionId: checkoutData.paymentSessionId,
                redirectTarget: "_modal",
            });

            if (result.error) {
                throw new Error(result.error.message || "Payment was cancelled.");
            }

            const verifyRes = await fetch("/api/billing/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: checkoutData.orderId }),
            });

            const verifyData =
                (await parseJsonSafe<{ error?: string; status?: string }>(verifyRes)) || {};

            if (!verifyRes.ok) {
                throw new Error(verifyData.error || "Payment verification failed.");
            }

            if (verifyData.status !== "SUCCESS") {
                throw new Error("Payment is not complete yet. Please try again in a moment.");
            }

            router.push("/dashboard?payment=success");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Payment failed.");
        } finally {
            setIsPaying(false);
        }
    }

    function nextStep() {
        const validationError = validateCurrentStep();
        if (validationError) {
            setError(validationError);
            return;
        }

        setError("");
        setStep((prev) => Math.min(prev + 1, steps.length - 1));
    }

    function previousStep() {
        setError("");
        setStep((prev) => Math.max(prev - 1, 0));
    }

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
    }

    if (!authChecked) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#08121c] text-[#d6e7ff]">
                <p>Loading your onboarding workspace...</p>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#08121c] px-5 py-8 text-[#e9f2ff] sm:px-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                    <Link href="/" className="text-sm text-[#8db7ff] hover:text-[#bad3ff]">
                        Back to home
                    </Link>
                    <div className="flex items-center gap-3">
                        <p className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs">
                            Step {step + 1} of {steps.length}
                        </p>
                        <button
                            onClick={() => void handleLogout()}
                            className="rounded-full border border-white/15 px-3 py-1 text-xs text-[#d4ddf5] hover:bg-white/10"
                        >
                            Sign out
                        </button>
                    </div>
                </div>

                <motion.section
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-3xl border border-[#4c6f9f]/35 bg-[linear-gradient(140deg,#102033_0%,#0a1a2f_60%,#0f2746_100%)] shadow-[0_20px_120px_rgba(20,91,181,0.22)]"
                >
                    <div className="border-b border-white/10 px-6 py-6 sm:px-10">
                        <p className="text-xs uppercase tracking-[0.22em] text-[#87d1ff]">Launch Setup</p>
                        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
                            Basic onboarding, clear tier choice, instant payment
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm text-[#b6cae8] sm:text-base">
                            This flow captures only essential business details first. After payment success, you go
                            directly to your dashboard where we will enable advanced setup like PDF upload,
                            WhatsApp, and custom MCP tools based on your tier.
                        </p>
                    </div>

                    <div className="grid gap-2 border-b border-white/10 bg-black/15 px-6 py-4 sm:grid-cols-3 sm:px-10">
                        {steps.map((label, index) => (
                            <div
                                key={label}
                                className={`rounded-xl px-3 py-2 text-sm ${index === step
                                    ? "bg-[#8be4ff] text-[#0f1f3a]"
                                    : index < step
                                        ? "bg-[#2a7ca8]/40 text-[#d2efff]"
                                        : "bg-white/5 text-[#9fbbdf]"
                                    }`}
                            >
                                {index + 1}. {label}
                            </div>
                        ))}
                    </div>

                    <div className="px-6 py-7 sm:px-10 sm:py-10">
                        {error && (
                            <div className="mb-6 rounded-xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                                {error}
                            </div>
                        )}

                        {step === 0 && (
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field
                                    label="Business Name"
                                    value={business.businessName}
                                    onChange={(value) => setBusiness((prev) => ({ ...prev, businessName: value }))}
                                    placeholder="Ketan Barber Studio"
                                />
                                <Field
                                    label="City"
                                    value={business.city}
                                    onChange={(value) => setBusiness((prev) => ({ ...prev, city: value }))}
                                    placeholder="Ahmedabad"
                                />
                                <Field
                                    label="Phone"
                                    value={business.phone}
                                    onChange={(value) => setBusiness((prev) => ({ ...prev, phone: value }))}
                                    placeholder="+91 9876543210"
                                />
                                <label className="space-y-2">
                                    <span className="text-sm text-[#bfd5f4]">Category</span>
                                    <select
                                        value={business.category}
                                        onChange={(event) =>
                                            setBusiness((prev) => ({
                                                ...prev,
                                                category: event.target.value as Category,
                                            }))
                                        }
                                        className="w-full rounded-xl border border-white/20 bg-[#0e1f33] px-3 py-2 text-sm"
                                    >
                                        <option value="doctor">Doctor</option>
                                        <option value="hotel">Hotel</option>
                                        <option value="salon">Salon</option>
                                        <option value="other">Other</option>
                                    </select>
                                </label>
                                <label className="space-y-2">
                                    <span className="text-sm text-[#bfd5f4]">Timezone</span>
                                    <input
                                        value={business.timezone}
                                        onChange={(event) =>
                                            setBusiness((prev) => ({ ...prev, timezone: event.target.value }))
                                        }
                                        className="w-full rounded-xl border border-white/20 bg-[#0e1f33] px-3 py-2 text-sm"
                                    />
                                </label>
                                <label className="md:col-span-2 space-y-2">
                                    <span className="text-sm text-[#bfd5f4]">Assistant tone (optional)</span>
                                    <textarea
                                        value={business.systemPrompt}
                                        onChange={(event) =>
                                            setBusiness((prev) => ({ ...prev, systemPrompt: event.target.value }))
                                        }
                                        placeholder="Friendly, concise, and always mention estimated wait time."
                                        className="h-24 w-full rounded-xl border border-white/20 bg-[#0e1f33] px-3 py-2 text-sm"
                                    />
                                </label>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="grid gap-4 lg:grid-cols-2">
                                {tiers.map((plan) => (
                                    <button
                                        key={plan.id}
                                        type="button"
                                        onClick={() => setTier(plan.id)}
                                        className={`rounded-2xl border p-5 text-left transition ${tier === plan.id
                                            ? "border-[#89ecff] bg-[#102c46] shadow-[0_0_0_1px_rgba(139,236,255,0.35)]"
                                            : "border-white/15 bg-white/[0.03] hover:border-[#76bee9]/50"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.15em] text-[#8cd9ff]">Tier {plan.id}</p>
                                                <p className="mt-1 text-2xl font-semibold">{plan.name}</p>
                                            </div>
                                            <p className="rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1 text-sm font-medium text-cyan-100">
                                                {plan.price}
                                            </p>
                                        </div>
                                        <p className="mt-3 text-sm text-[#c5d7ef]">{plan.pitch}</p>
                                        <ul className="mt-3 space-y-1 text-sm text-[#9ec0e6]">
                                            {plan.benefits.map((item) => (
                                                <li key={item}>- {item}</li>
                                            ))}
                                        </ul>
                                    </button>
                                ))}
                            </div>
                        )}

                        {step === 2 && selectedTier && (
                            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                                <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
                                    <p className="text-xs uppercase tracking-[0.15em] text-[#8ed8ff]">Final check</p>
                                    <h2 className="mt-2 text-2xl font-semibold">Proceed to secure payment</h2>
                                    <div className="mt-5 space-y-2 text-sm text-[#d0e1f7]">
                                        <SummaryRow label="Business" value={business.businessName} />
                                        <SummaryRow label="Category" value={business.category} />
                                        <SummaryRow label="City" value={business.city} />
                                        <SummaryRow label="Phone" value={business.phone} />
                                        <SummaryRow label="Selected Tier" value={`Tier ${selectedTier.id} - ${selectedTier.name}`} />
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-[#8fe6ff]/35 bg-[linear-gradient(160deg,#12304a_0%,#0b2138_100%)] p-5">
                                    <p className="text-sm text-[#9ee7ff]">Amount</p>
                                    <p className="mt-1 text-4xl font-semibold">Rs {selectedTier.amount}</p>
                                    <p className="mt-2 text-sm text-[#bfd9f4]">{selectedTier.price}</p>
                                    <button
                                        type="button"
                                        onClick={() => void handlePayment()}
                                        disabled={isSaving || isPaying}
                                        className="mt-6 w-full rounded-xl bg-[#8bedff] px-4 py-3 text-sm font-semibold text-[#08213a] transition hover:bg-[#a4f1ff] disabled:opacity-60"
                                    >
                                        {isPaying ? "Processing payment..." : isSaving ? "Saving details..." : "Pay with Cashfree"}
                                    </button>
                                    <p className="mt-3 text-xs text-[#a8c1de]">After successful payment, you will be redirected to dashboard.</p>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5">
                            <button
                                type="button"
                                onClick={previousStep}
                                disabled={step === 0 || isPaying || isSaving}
                                className="rounded-full border border-white/20 px-5 py-2 text-sm text-[#dbe8fb] disabled:opacity-40"
                            >
                                Previous
                            </button>

                            {step < steps.length - 1 ? (
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    disabled={isPaying || isSaving}
                                    className="rounded-full bg-[#8be4ff] px-6 py-2 text-sm font-semibold text-[#08203a] disabled:opacity-60"
                                >
                                    Continue
                                </button>
                            ) : (
                                <Link
                                    href="/dashboard"
                                    className="rounded-full border border-white/20 px-6 py-2 text-sm text-[#d6e6ff] hover:bg-white/10"
                                >
                                    Open dashboard
                                </Link>
                            )}
                        </div>
                    </div>
                </motion.section>
            </div>
        </main>
    );
}

function Field({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="space-y-2">
            <span className="text-sm text-[#bfd5f4]">{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-white/20 bg-[#0e1f33] px-3 py-2 text-sm"
            />
        </label>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0b1d31] px-3 py-2">
            <span className="text-[#9fbde1]">{label}</span>
            <span className="font-medium text-[#ecf5ff]">{value}</span>
        </div>
    );
}
