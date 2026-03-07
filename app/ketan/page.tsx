"use client";

import { useState } from "react";

export default function KetanPage() {
    const [name, setName] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !date || !time) {
            setMessage("Please fill all fields.");
            setStatus("error");
            return;
        }

        setStatus("loading");
        setMessage("");

        try {
            const res = await fetch("/api/ketan/book", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), date, time }),
            });

            const data = await res.json();
            if (!res.ok) {
                setStatus("error");
                setMessage(data.error || "Failed to book.");
                return;
            }

            setStatus("success");
            setMessage(`Appointment booked for ${name} on ${date} at ${time}`);
            setName("");
            setDate("");
            setTime("");
        } catch {
            setStatus("error");
            setMessage("Network error. Try again.");
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-8"
            >
                <h1 className="text-center text-2xl font-semibold text-white">Book Appointment</h1>

                <div>
                    <label className="mb-1 block text-sm text-slate-300">Patient Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ketan"
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm text-slate-300">Date</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm text-slate-300">Time</label>
                    <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    />
                </div>

                <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full rounded-lg bg-cyan-500 py-2.5 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                >
                    {status === "loading" ? "Booking..." : "Submit"}
                </button>

                {message && (
                    <p className={`text-center text-sm ${status === "success" ? "text-emerald-400" : "text-red-400"}`}>
                        {message}
                    </p>
                )}
            </form>
        </div>
    );
}
