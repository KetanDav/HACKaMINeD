"use client";

import { useState } from "react";
import Link from "next/link";

export default function TestUploadPage() {
    const [businessName, setBusinessName] = useState("Ketan Test Clinic");
    const [city, setCity] = useState("Ahmedabad");
    const [phone, setPhone] = useState("+911234567890");
    const [email, setEmail] = useState("test@clinic.com");
    const [category, setCategory] = useState<"doctor" | "hotel">("doctor");
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (files.length === 0) {
            setStatus("Please select at least one PDF or TXT file.");
            return;
        }

        setLoading(true);
        setStatus("Uploading business data and processing PDF...");

        try {
            const formData = new FormData();
            formData.append(
                "business",
                JSON.stringify({
                    businessName,
                    ownerName: "Test Owner",
                    email,
                    phone,
                    city,
                    category,
                })
            );
            formData.append("tier", "1");
            formData.append("integrationConfig", JSON.stringify({}));

            files.forEach((file) => formData.append("kbFiles", file));

            const res = await fetch("/api/onboarding", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Upload failed");

            setStatus(
                `✅ Success! Created Business ID: ${data.knowledgeBaseId}. PDF parsed into ${data.kbIngestion?.chunksCreated || 0} chunks.`
            );
        } catch (err: any) {
            setStatus(`❌ Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
            <div className="mx-auto max-w-2xl rounded-2xl border border-white/20 bg-slate-900 p-8 shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-cyan-400">Twilio KB Tester</h1>
                    <Link href="/" className="text-sm text-slate-400 hover:text-white">
                        ← Home
                    </Link>
                </div>

                <p className="mb-8 text-sm text-slate-400">
                    This simple interface creates a business profile in the database and uploads
                    your PDF/TXT file so your Twilio voice agent can answer questions about it.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-sm text-slate-300">Business Name</span>
                            <input
                                type="text"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                className="mt-1 w-full rounded border border-white/20 bg-black/30 p-2 text-white"
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm text-slate-300">Category</span>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as "doctor" | "hotel")}
                                className="mt-1 w-full rounded border border-white/20 bg-black/30 p-2 text-white"
                            >
                                <option value="doctor">Clinic / Doctor</option>
                                <option value="hotel">Hotel</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-sm text-slate-300">City</span>
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="mt-1 w-full rounded border border-white/20 bg-black/30 p-2 text-white"
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm text-slate-300">Contact Phone</span>
                            <input
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="mt-1 w-full rounded border border-white/20 bg-black/30 p-2 text-white"
                                required
                            />
                        </label>
                    </div>

                    <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-4">
                        <label className="block font-medium text-cyan-200">
                            Upload Knowledge Base (PDF, TXT)
                            <input
                                type="file"
                                accept=".pdf,.txt"
                                multiple
                                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                                className="mt-2 block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-black hover:file:bg-cyan-300"
                            />
                        </label>
                        {files.length > 0 && (
                            <p className="mt-2 text-xs text-slate-400">
                                Selected: {files.map((f) => f.name).join(", ")}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded bg-cyan-500 py-3 font-bold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
                    >
                        {loading ? "Processing..." : "Save & Process Knowledge"}
                    </button>
                </form>

                {status && (
                    <div
                        className={`mt-6 rounded p-4 text-sm ${status.includes("❌")
                                ? "bg-red-500/20 text-red-200"
                                : status.includes("✅")
                                    ? "bg-emerald-500/20 text-emerald-200"
                                    : "bg-blue-500/20 text-blue-200"
                            }`}
                    >
                        {status}
                    </div>
                )}
            </div>
        </main>
    );
}
