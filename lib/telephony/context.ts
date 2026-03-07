/**
 * Tenant Context — loads structured business data from PostgreSQL.
 *
 * This replaces the env-var-based context with real DB queries.
 * Structured data (hours, prices, staff) is served directly via MCP tools.
 * Free-form data (FAQs, policies) will be served via RAG.
 */

import { prisma } from "@/lib/prisma";
import type { RuntimeBusinessContext } from "@/lib/mcp/router";

/**
 * Load tenant context from the database by phone number.
 * Falls back to env-var defaults if no tenant is found.
 */
export async function loadTenantContext(dialedNumber: string): Promise<{
  tenantId: string;
  context: RuntimeBusinessContext;
}> {
  try {
    const phoneRecord = await prisma.phoneNumber.findUnique({
      where: { number: dialedNumber },
      include: {
        tenant: {
          include: {
            services: { where: { available: true } },
            staff: true,
            appointments: true,
          },
        },
      },
    });

    if (phoneRecord?.tenant) {
      const tenant = phoneRecord.tenant;
      return {
        tenantId: tenant.id,
        context: {
          knowledgeBaseId: tenant.id,
          businessInfo: {
            name: tenant.name,
            address: tenant.address || undefined,
            openingHours: tenant.openingHours || undefined,
            escalationPhone: tenant.escalationPhone || undefined,
            servicePricing: tenant.services.map((s) => ({
              service: s.name,
              price: s.price,
            })),
          },
          appointments: tenant.appointments.map((a) => ({
            date: a.date,
            time: a.time,
            name: a.name,
          })),
          orders: [],
        },
      };
    }
  } catch (error) {
    console.error("Failed to load tenant context from DB:", error);
  }

  // Fallback to env-var defaults (for demo / no DB scenario)
  return {
    tenantId: "default",
    context: getDefaultRuntimeContext(),
  };
}

/**
 * Env-var-based default context (backwards compatible).
 */
export function getDefaultRuntimeContext(): RuntimeBusinessContext {
  const ordersRaw = process.env.RUNTIME_DEFAULT_ORDERS || "";
  const pricingRaw = process.env.RUNTIME_SERVICE_PRICING || "";

  const orders = ordersRaw
    ? ordersRaw.split(";").map((entry) => {
      const [orderId, status, eta] = entry.split(":");
      return {
        orderId: (orderId || "").trim(),
        status: (status || "pending").trim(),
        eta: (eta || "").trim() || undefined,
      };
    })
    : [];

  const servicePricing = pricingRaw
    ? pricingRaw
      .split(";")
      .map((entry) => {
        const [service, price] = entry.split(":");
        return {
          service: (service || "").trim(),
          price: (price || "").trim(),
        };
      })
      .filter((item) => item.service && item.price)
    : [
      { service: "Haircut", price: "199 INR" },
      { service: "Beard Trim", price: "99 INR" },
      { service: "Haircut + Beard", price: "249 INR" },
    ];

  return {
    knowledgeBaseId: process.env.RUNTIME_DEFAULT_KB_ID || "demo-barber",
    businessInfo: {
      name: process.env.RUNTIME_BUSINESS_NAME || "Ketan Barber Shop",
      openingHours: process.env.RUNTIME_OPENING_HOURS || "9 AM - 9 PM",
      address: process.env.RUNTIME_BUSINESS_ADDRESS || "Ahmedabad, Gujarat",
      servicePricing,
    },
    orders,
  };
}
