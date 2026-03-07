import { searchKnowledgeBase } from "@/lib/kb/retriever";

export type RuntimeBusinessContext = {
  knowledgeBaseId?: string;
  businessInfo?: {
    name?: string;
    address?: string;
    openingHours?: string;
    servicePricing?: Array<{ service: string; price: string }>;
    escalationPhone?: string;
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

export class MCPToolRouter {
  getTools() {
    return DEFAULT_TOOLS;
  }

  getToolByName(name: string) {
    return DEFAULT_TOOLS.find((tool) => tool.name === name);
  }

  async execute(
    action: string,
    slots: Record<string, string>,
    context: RuntimeBusinessContext,
  ): Promise<MCPExecutionResult> {
    switch (action) {
      case "search_knowledge": {
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
        return {
          ok: false,
          action,
          message: `Unknown MCP action: ${action}`,
        };
    }
  }
}
