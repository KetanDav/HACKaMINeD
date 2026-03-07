import { searchKnowledgeBase } from "@/lib/kb/retriever";
import { searchBusinessKnowledge } from "@/lib/kb/dbRetriever";
import { getAIProvider } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type RuntimeCustomTool = {
  name: string;
  description: string;
  prompt: string;
  requiredSlots?: string[];
  missingSlotPrompts?: Record<string, string>;
};

export type RuntimeBusinessContext = {
  businessProfileId?: string;
  callerNumber?: string;
  systemPrompt?: string;
  customTools?: RuntimeCustomTool[];
  allowedToolNames?: string[];
  confirmActions?: string[];
  knowledgeBaseId?: string;
  customContextText?: string;
  businessInfo?: {
    name?: string;
    address?: string;
    openingHours?: string;
    servicePricing?: Array<{ service: string; price: string }>;
  };
  appointments?: Array<{ date: string; time: string; name?: string }>;
  orders?: Array<{ orderId: string; status: string; eta?: string }>;
};

export type MCPExecutionResult = {
  ok: boolean;
  action: string;
  message: string;
  data?: Record<string, unknown>;
};

type MCPToolDefinition = {
  name: string;
  description: string;
  requiredSlots: string[];
  missingSlotPrompts: Record<string, string>;
};

export const DEFAULT_TOOLS: MCPToolDefinition[] = [
  {
    name: "search_knowledge",
    description: "Searches uploaded knowledge base documents for answers",
    requiredSlots: ["query"],
    missingSlotPrompts: {
      query: "Please tell me what information you want from the knowledge base.",
    },
  },
  {
    name: "get_business_info",
    description: "Returns business details",
    requiredSlots: [],
    missingSlotPrompts: {},
  },
  {
    name: "get_opening_hours",
    description: "Returns opening hours",
    requiredSlots: [],
    missingSlotPrompts: {},
  },
  {
    name: "check_available_slots",
    description: "Returns free appointment slots for a date",
    requiredSlots: ["date"],
    missingSlotPrompts: {
      date: "Please share the date for which you want appointment availability.",
    },
  },
  {
    name: "book_appointment",
    description: "Books appointment",
    requiredSlots: ["name", "date", "time"],
    missingSlotPrompts: {
      name: "May I know your name for booking?",
      date: "Please share the appointment date.",
      time: "Please tell me your preferred time.",
    },
  },
  {
    name: "get_order_status",
    description: "Returns status for an order id",
    requiredSlots: ["order_id"],
    missingSlotPrompts: {
      order_id: "Please tell me your order number.",
    },
  },
  {
    name: "send_whatsapp",
    description: "Sends WhatsApp notification",
    requiredSlots: ["phone", "message"],
    missingSlotPrompts: {
      phone: "Please share the phone number.",
      message: "Please tell me the message to send.",
    },
  },
  {
    name: "send_email",
    description: "Sends email notification",
    requiredSlots: ["to", "subject", "body"],
    missingSlotPrompts: {
      to: "Please share the recipient email address.",
      subject: "Please share the email subject.",
      body: "Please share the email content.",
    },
  },
];

function searchInCustomContext(customText: string, query: string) {
  const text = customText.trim();
  if (!text) {
    return {
      found: false,
      answer: "I could not find this information in the demo context.",
      matches: [],
    };
  }

  const queryTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);

  if (queryTokens.length === 0) {
    return {
      found: true,
      answer: text.slice(0, 1200),
      matches: [{ score: 1 }],
    };
  }

  const sentences = text
    .split(/[.!?\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const scored = sentences
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      let score = 0;
      for (const token of queryTokens) {
        if (lower.includes(token)) score += 1;
      }
      return { sentence, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (scored.length === 0) {
    return {
      found: false,
      answer: "I could not find this information in the demo context.",
      matches: [],
    };
  }

  return {
    found: true,
    answer: scored.map((item) => item.sentence).join(" ").slice(0, 1200),
    matches: scored.map((item) => ({ score: item.score })),
  };
}

export class MCPToolRouter {
  constructor(private readonly customTools: RuntimeCustomTool[] = []) {}

  private buildCustomToolDefinition(tool: RuntimeCustomTool): MCPToolDefinition {
    const normalizedName = `custom_${tool.name.toLowerCase().replace(/[^a-z0-9_]+/g, "_")}`;
    return {
      name: normalizedName,
      description: tool.description || `Custom tool: ${tool.name}`,
      requiredSlots: Array.isArray(tool.requiredSlots) ? tool.requiredSlots : [],
      missingSlotPrompts: tool.missingSlotPrompts || {},
    };
  }

  getTools() {
    const customDefs = this.customTools.map((tool) => this.buildCustomToolDefinition(tool));
    return [...DEFAULT_TOOLS, ...customDefs];
  }

  getToolByName(name: string) {
    return this.getTools().find((tool) => tool.name === name);
  }

  private normalizeDate(value: string) {
    const trimmed = String(value || "").trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  private normalizeTime(value: string) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";

    const ampmMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (ampmMatch) {
      let hour = Number(ampmMatch[1]);
      const minute = Number(ampmMatch[2] || "0");
      const ampm = ampmMatch[3].toLowerCase();
      if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) return "";
      if (hour < 1 || hour > 12) return "";
      if (ampm === "pm" && hour !== 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    }

    const hmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (hmMatch) {
      const hour = Number(hmMatch[1]);
      const minute = Number(hmMatch[2]);
      if (Number.isNaN(hour) || Number.isNaN(minute)) return "";
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    }

    return "";
  }

  private formatTimeForSpeech(timeValue: string) {
    const match = String(timeValue || "").match(/^(\d{2}):(\d{2})/);
    if (!match) return timeValue;
    const hour24 = Number(match[1]);
    const minute = Number(match[2]);
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    if (minute === 0) return `${hour12} ${suffix}`;
    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  async execute(
    action: string,
    slots: Record<string, string>,
    context: RuntimeBusinessContext,
  ): Promise<MCPExecutionResult> {
    switch (action) {
      case "search_knowledge": {
        const customContextText = context.customContextText?.trim();
        if (customContextText) {
          const result = searchInCustomContext(customContextText, slots.query || "");
          return {
            ok: result.found,
            action,
            message: result.answer,
            data: {
              matches: result.matches,
              source: "demo_custom_context",
            },
          };
        }

        if (context.businessProfileId) {
          const result = await searchBusinessKnowledge({
            businessProfileId: context.businessProfileId,
            query: slots.query,
          });

          return {
            ok: result.found,
            action,
            message: result.answer,
            data: {
              matches: result.matches,
              source: "supabase_kb_chunks",
            },
          };
        }

        if (!context.knowledgeBaseId) {
          return {
            ok: false,
            action,
            message: "Knowledge base is not configured for this business.",
          };
        }

        const result = await searchKnowledgeBase({
          knowledgeBaseId: context.knowledgeBaseId,
          query: slots.query,
        });

        return {
          ok: result.found,
          action,
          message: result.answer,
          data: {
            matches: result.matches,
          },
        };
      }

      case "get_business_info": {
        const info = context.businessInfo || {};
        const servicePricing = info.servicePricing || [];
        const pricingText =
          servicePricing.length > 0
            ? ` Services and pricing: ${servicePricing.map((item) => `${item.service} - ${item.price}`).join(", ")}.`
            : "";

        return {
          ok: true,
          action,
          message: `Business details loaded for ${info.name || "your business"}.${pricingText}`,
          data: {
            name: info.name || "Unknown",
            address: info.address || "Not available",
            opening_hours: info.openingHours || "Not available",
            service_pricing: servicePricing,
          },
        };
      }

      case "get_opening_hours": {
        const openingHours = context.businessInfo?.openingHours || "10:00 AM - 8:00 PM";
        return {
          ok: true,
          action,
          message: `Opening hours are ${openingHours}.`,
          data: { opening_hours: openingHours },
        };
      }

      case "check_available_slots": {
        const date = slots.date;

        if (context.businessProfileId) {
          const normalizedDate = this.normalizeDate(date);
          if (!normalizedDate) {
            return {
              ok: false,
              action,
              message: "Please provide date in YYYY-MM-DD format.",
            };
          }

          const admin = getSupabaseAdmin();
          const { data, error } = await admin
            .from("appointment_slots")
            .select("slot_time, status")
            .eq("business_profile_id", context.businessProfileId)
            .eq("slot_date", normalizedDate)
            .order("slot_time", { ascending: true });

          if (error) {
            return {
              ok: false,
              action,
              message: "I could not fetch available slots right now.",
            };
          }

          const free = (data || [])
            .filter((item) => item.status === "free")
            .map((item) => this.formatTimeForSpeech(String(item.slot_time)));

          return {
            ok: true,
            action,
            message:
              free.length > 0
                ? `Available slots on ${normalizedDate}: ${free.join(", ")}`
                : `No slots available on ${normalizedDate}.`,
            data: { date: normalizedDate, free_slots: free },
          };
        }

        const bookedForDate = (context.appointments || []).filter((a) => a.date === date);
        const defaultSlots = ["10:00", "11:30", "16:00", "18:00"];
        const free = defaultSlots.filter(
          (time) => !bookedForDate.some((appointment) => appointment.time === time),
        );
        return {
          ok: true,
          action,
          message:
            free.length > 0
              ? `Available slots on ${date}: ${free.join(", ")}`
              : `No slots available on ${date}.`,
          data: { date, free_slots: free },
        };
      }

      case "book_appointment": {
        if (context.businessProfileId) {
          const normalizedDate = this.normalizeDate(slots.date);
          const normalizedTime = this.normalizeTime(slots.time);

          if (!normalizedDate || !normalizedTime) {
            return {
              ok: false,
              action,
              message: "Please provide booking date as YYYY-MM-DD and a valid time.",
            };
          }

          const admin = getSupabaseAdmin();
          const { data: existing } = await admin
            .from("appointment_slots")
            .select("id, status")
            .eq("business_profile_id", context.businessProfileId)
            .eq("slot_date", normalizedDate)
            .eq("slot_time", normalizedTime)
            .limit(1)
            .maybeSingle<{ id: string; status: "free" | "booked" }>();

          if (existing?.status === "booked") {
            return {
              ok: false,
              action,
              message: `That slot on ${normalizedDate} at ${this.formatTimeForSpeech(normalizedTime)} is already booked.`,
            };
          }

          const bookingPayload = {
            business_profile_id: context.businessProfileId,
            slot_date: normalizedDate,
            slot_time: normalizedTime,
            status: "booked",
            customer_name: String(slots.name || "").trim() || "Caller",
            customer_phone: String(slots.phone || context.callerNumber || "").trim() || null,
            notes: "Booked via AI call assistant",
          };

          const saveResult = existing?.id
            ? await admin
                .from("appointment_slots")
                .update(bookingPayload)
                .eq("id", existing.id)
                .select("id")
                .single<{ id: string }>()
            : await admin
                .from("appointment_slots")
                .insert(bookingPayload)
                .select("id")
                .single<{ id: string }>();

          if (saveResult.error || !saveResult.data?.id) {
            return {
              ok: false,
              action,
              message: "I could not complete the booking due to a system issue.",
            };
          }

          return {
            ok: true,
            action,
            message: `Appointment booked for ${slots.name} on ${normalizedDate} at ${this.formatTimeForSpeech(normalizedTime)}.`,
            data: {
              booking_id: saveResult.data.id,
              name: slots.name,
              date: normalizedDate,
              time: normalizedTime,
            },
          };
        }

        return {
          ok: true,
          action,
          message: `Appointment booked for ${slots.name} on ${slots.date} at ${slots.time}.`,
          data: {
            booking_id: `apt_${Date.now()}`,
            name: slots.name,
            date: slots.date,
            time: slots.time,
          },
        };
      }

      case "get_order_status": {
        const found = (context.orders || []).find((order) => order.orderId === slots.order_id);
        if (found) {
          return {
            ok: true,
            action,
            message: `Order ${found.orderId} is ${found.status}${found.eta ? ` and expected by ${found.eta}` : ""}.`,
            data: {
              order_id: found.orderId,
              status: found.status,
              eta: found.eta || null,
            },
          };
        }

        return {
          ok: false,
          action,
          message: `I could not find order ${slots.order_id}.`,
          data: { order_id: slots.order_id },
        };
      }

      case "send_whatsapp": {
        return {
          ok: true,
          action,
          message: `WhatsApp message queued for ${slots.phone}.`,
          data: {
            provider: "mock",
            queued: true,
          },
        };
      }

      case "send_email": {
        return {
          ok: true,
          action,
          message: `Email queued for ${slots.to}.`,
          data: {
            provider: "mock",
            queued: true,
          },
        };
      }

      default:
        if (action.startsWith("custom_")) {
          const matched = this.customTools.find(
            (tool) => this.buildCustomToolDefinition(tool).name === action,
          );

          if (!matched) {
            return {
              ok: false,
              action,
              message: `Unknown custom MCP action: ${action}`,
            };
          }

          const ai = getAIProvider();
          const prompt = [
            `You are executing custom MCP tool: ${matched.name}`,
            `Tool instruction: ${matched.prompt}`,
            `Business name: ${context.businessInfo?.name || "Unknown"}`,
            `Customer request: ${slots.query || ""}`,
            `Extracted slots JSON: ${JSON.stringify(slots)}`,
            "Return a concise user-facing response only.",
          ].join("\n");

          const generated = await ai.generateText({
            system: context.systemPrompt,
            prompt,
          });

          return {
            ok: true,
            action,
            message: generated || `Executed custom MCP tool ${matched.name}.`,
            data: {
              customTool: matched.name,
            },
          };
        }

        return {
          ok: false,
          action,
          message: `Unknown MCP action: ${action}`,
        };
    }
  }
}
