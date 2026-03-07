"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardDoc = {
    id: string;
    title: string | null;
    file_name: string;
    document_kind: string;
    status: string;
    created_at: string;
};

type ToolConfig = {
    name: string;
    description: string;
    prompt: string;
};

type AppointmentSlot = {
    id: string;
    slot_date: string;
    slot_time: string;
    status: "free" | "booked";
    customer_name: string | null;
    customer_phone: string | null;
};

type Props = {
    tier: number;
    tierName: string;
    whatsappEnabled: boolean;
    documents: DashboardDoc[];
    appointmentSlots: AppointmentSlot[];
    customTools: ToolConfig[];
};

const docKinds = ["general", "policy", "faq", "manual", "pricing"] as const;

function formatLocalIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export default function DashboardClient({
    tier,
    tierName,
    whatsappEnabled,
    documents,
    appointmentSlots,
    customTools,
}: Props) {
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [kind, setKind] = useState<(typeof docKinds)[number]>("general");
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState("");

    const [whatsapp, setWhatsapp] = useState(whatsappEnabled);
    const [savingWhatsapp, setSavingWhatsapp] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState("");

    const [toolsText, setToolsText] = useState(JSON.stringify(customTools, null, 2));
    const [savingTools, setSavingTools] = useState(false);
    const [toolsMessage, setToolsMessage] = useState("");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthDays = monthEnd.getDate();

    const [slotDate, setSlotDate] = useState(formatLocalIsoDate(monthStart));
    const [slotTime, setSlotTime] = useState("10:00");
    const [slotStatus, setSlotStatus] = useState<"free" | "booked">("free");
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [bookingMessage, setBookingMessage] = useState("");
    const [savingBooking, setSavingBooking] = useState(false);

    const sortedDocs = useMemo(
        () => [...documents].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
        [documents],
    );

    const bookedDates = useMemo(() => {
        const map = new Map<string, number>();
        for (const slot of appointmentSlots) {
            if (slot.status !== "booked") continue;
            map.set(slot.slot_date, (map.get(slot.slot_date) || 0) + 1);
        }
        return map;
    }, [appointmentSlots]);

    const bookedSlots = useMemo(
        () => appointmentSlots.filter((slot) => slot.status === "booked").slice(0, 15),
        [appointmentSlots],
    );

    async function onUploadPdf(event: React.FormEvent) {
        event.preventDefault();
        setUploadMessage("");

        if (!file) {
            setUploadMessage("Please choose a PDF file.");
            return;
        }

        const formData = new FormData();
        formData.append("title", title);
        formData.append("kind", kind);
        formData.append("file", file);

        setUploading(true);

        try {
            const res = await fetch("/api/dashboard/kb/upload", {
                method: "POST",
                body: formData,
            });
            const data = (await res.json()) as { error?: string; chunksCreated?: number };

            if (!res.ok) {
                throw new Error(data.error || "Upload failed.");
            }

            setUploadMessage(`PDF indexed successfully (${data.chunksCreated || 0} chunks).`);
            setFile(null);
            setTitle("");
            router.refresh();
        } catch (error) {
            setUploadMessage(error instanceof Error ? error.message : "Upload failed.");
        } finally {
            setUploading(false);
        }
    }

    async function onSaveWhatsapp() {
        setSavingWhatsapp(true);
        setWhatsappMessage("");

        try {
            const res = await fetch("/api/dashboard/features", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ whatsappEnabled: whatsapp }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) throw new Error(data.error || "Failed to save WhatsApp setting.");

            setWhatsappMessage("WhatsApp setting saved.");
            router.refresh();
        } catch (error) {
            setWhatsappMessage(error instanceof Error ? error.message : "Failed to save WhatsApp setting.");
        } finally {
            setSavingWhatsapp(false);
        }
    }

    async function onSaveTools() {
        setSavingTools(true);
        setToolsMessage("");

        try {
            const parsed = JSON.parse(toolsText) as ToolConfig[];
            const res = await fetch("/api/dashboard/custom-tools", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tools: parsed }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) throw new Error(data.error || "Failed to save custom tools.");

            setToolsMessage("Custom MCP tools saved.");
            router.refresh();
        } catch (error) {
            setToolsMessage(error instanceof Error ? error.message : "Failed to save custom tools.");
        } finally {
            setSavingTools(false);
        }
    }

    async function onSaveSlot(event: React.FormEvent) {
        event.preventDefault();
        setSavingBooking(true);
        setBookingMessage("");

        try {
            const res = await fetch("/api/dashboard/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slotDate,
                    slotTime,
                    status: slotStatus,
                    customerName,
                    customerPhone,
                }),
            });
            const data = (await res.json()) as { error?: string };
            if (!res.ok) {
                throw new Error(data.error || "Failed to save time slot.");
            }

            setBookingMessage(slotStatus === "booked" ? "Booking saved." : "Free slot saved.");
            router.refresh();
        } catch (error) {
            setBookingMessage(error instanceof Error ? error.message : "Failed to save time slot.");
        } finally {
            setSavingBooking(false);
        }
    }

    return (
        <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-semibold">Knowledge Base PDF Upload</h2>
                    <p className="mt-2 text-sm text-[#b8cdea]">Upload PDFs to teach your AI assistant business-specific answers.</p>
                    <form className="mt-4 space-y-3" onSubmit={onUploadPdf}>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Document title (optional)"
                            className="w-full rounded-lg border border-white/20 bg-[#0d1e32] px-3 py-2 text-sm"
                        />
                        <select
                            value={kind}
                            onChange={(e) => setKind(e.target.value as (typeof docKinds)[number])}
                            className="w-full rounded-lg border border-white/20 bg-[#0d1e32] px-3 py-2 text-sm"
                        >
                            {docKinds.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="w-full rounded-lg border border-white/20 bg-[#0d1e32] px-3 py-2 text-sm"
                        />
                        <button
                            type="submit"
                            disabled={uploading}
                            className="rounded-lg bg-[#8de8ff] px-4 py-2 text-sm font-semibold text-[#08203a] disabled:opacity-50"
                        >
                            {uploading ? "Uploading..." : "Upload and Index PDF"}
                        </button>
                    </form>
                    {uploadMessage ? <p className="mt-3 text-sm text-[#bfe7ff]">{uploadMessage}</p> : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-semibold">Uploaded Documents</h2>
                    <div className="mt-3 space-y-2">
                        {sortedDocs.length === 0 ? (
                            <p className="text-sm text-[#9db8da]">No documents uploaded yet.</p>
                        ) : (
                            sortedDocs.slice(0, 8).map((doc) => (
                                <div key={doc.id} className="rounded-lg border border-white/10 bg-[#0b182a] px-3 py-2 text-sm">
                                    <p className="font-medium">{doc.title || doc.file_name}</p>
                                    <p className="text-[#95b2d5]">{doc.document_kind} • {doc.status}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-semibold">Monthly Booking Calendar</h2>
                    <p className="mt-2 text-sm text-[#b8cdea]">
                        {monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}
                    </p>
                    <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-[#9db8da]">
                        {Array.from({ length: monthDays }).map((_, index) => {
                            const day = index + 1;
                            const date = new Date(now.getFullYear(), now.getMonth(), day);
                            const isoDate = formatLocalIsoDate(date);
                            const bookedCount = bookedDates.get(isoDate) || 0;
                            return (
                                <div
                                    key={isoDate}
                                    className={`rounded-lg border px-2 py-2 ${bookedCount > 0 ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-[#0b182a]"}`}
                                >
                                    <p className="font-medium">{day}</p>
                                    <p>{bookedCount > 0 ? `${bookedCount} booked` : "free"}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-semibold">Time Booking</h2>
                    <form className="mt-3 grid gap-3" onSubmit={onSaveSlot}>
                        <input
                            type="date"
                            value={slotDate}
                            onChange={(e) => setSlotDate(e.target.value)}
                            className="w-full rounded-lg border border-white/20 bg-[#0d1e32] px-3 py-2 text-sm"
                            required
                        />
                        <input
                            type="time"
                            value={slotTime}
                            onChange={(e) => setSlotTime(e.target.value)}
                            className="w-full rounded-lg border border-white/20 bg-[#0d1e32] px-3 py-2 text-sm"
                            required
                        />
                        <select
                            value={slotStatus}
                            onChange={(e) => setSlotStatus(e.target.value as "free" | "booked")}
                            className="w-full rounded-lg border border-white/20 bg-[#0d1e32] px-3 py-2 text-sm"
                        >
                            <option value="free">Free slot</option>
                            <option value="booked">Booked slot</option>
                        </select>
                        {slotStatus === "booked" ? (
                            <>
                                <input
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="Customer name"
                                    className="w-full rounded-lg border border-white/20 bg-[#0d1e32] px-3 py-2 text-sm"
                                />
                                <input
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="Customer phone"
                                    className="w-full rounded-lg border border-white/20 bg-[#0d1e32] px-3 py-2 text-sm"
                                />
                            </>
                        ) : null}
                        <button
                            type="submit"
                            disabled={savingBooking}
                            className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                        >
                            {savingBooking ? "Saving..." : "Save Time Slot"}
                        </button>
                    </form>
                    {bookingMessage ? <p className="mt-2 text-sm text-[#bfe7ff]">{bookingMessage}</p> : null}
                    <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">Recent Bookings</p>
                        {bookedSlots.length === 0 ? (
                            <p className="text-sm text-[#9db8da]">No booked appointments yet.</p>
                        ) : (
                            bookedSlots.map((slot) => (
                                <div key={slot.id} className="rounded-lg border border-white/10 bg-[#0b182a] px-3 py-2 text-sm">
                                    <p className="font-medium">
                                        {slot.slot_date} at {String(slot.slot_time).slice(0, 5)}
                                    </p>
                                    <p className="text-[#95b2d5]">
                                        {slot.customer_name || "Caller"}
                                        {slot.customer_phone ? ` • ${slot.customer_phone}` : ""}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-semibold">Tier Features</h2>
                    <p className="mt-2 text-sm text-[#b8cdea]">Current plan: Tier {tier} ({tierName})</p>
                    <div className="mt-3 space-y-2 text-sm text-[#c5d9f3]">
                        <p>Tier 1+: PDF knowledge base upload</p>
                        <p>Tier 2+: WhatsApp automation controls</p>
                        <p>Tier 4: Custom MCP tools editor</p>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-semibold">WhatsApp Settings</h2>
                    {tier < 2 ? (
                        <p className="mt-2 text-sm text-[#ffcc9e]">Upgrade to Tier 2 or higher to enable WhatsApp.</p>
                    ) : (
                        <>
                            <label className="mt-3 flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={whatsapp}
                                    onChange={(e) => setWhatsapp(e.target.checked)}
                                />
                                Enable WhatsApp actions
                            </label>
                            <button
                                type="button"
                                onClick={onSaveWhatsapp}
                                disabled={savingWhatsapp}
                                className="mt-3 rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                            >
                                {savingWhatsapp ? "Saving..." : "Save WhatsApp Setting"}
                            </button>
                            {whatsappMessage ? <p className="mt-2 text-sm text-[#bfe7ff]">{whatsappMessage}</p> : null}
                        </>
                    )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-semibold">Custom MCP Tools</h2>
                    {tier < 4 ? (
                        <p className="mt-2 text-sm text-[#ffcc9e]">Upgrade to Tier 4 to configure custom MCP tools.</p>
                    ) : (
                        <>
                            <textarea
                                value={toolsText}
                                onChange={(e) => setToolsText(e.target.value)}
                                className="mt-3 h-48 w-full rounded-lg border border-white/20 bg-[#0d1e32] px-3 py-2 font-mono text-xs"
                            />
                            <button
                                type="button"
                                onClick={onSaveTools}
                                disabled={savingTools}
                                className="mt-3 rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
                            >
                                {savingTools ? "Saving..." : "Save Custom Tools"}
                            </button>
                            {toolsMessage ? <p className="mt-2 text-sm text-[#bfe7ff]">{toolsMessage}</p> : null}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
