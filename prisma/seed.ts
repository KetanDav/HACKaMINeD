/**
 * Seed script — populates demo tenant data in the database.
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding demo tenant data...");

    // Upsert demo tenant
    const tenant = await prisma.tenant.upsert({
        where: { id: "demo-barber" },
        update: {
            name: "Ketan Barber Shop",
            industry: "barber",
            address: "MG Road, Ahmedabad, Gujarat",
            city: "Ahmedabad",
            openingHours: "Monday to Saturday, 9 AM to 9 PM. Closed on Sundays.",
            escalationPhone: process.env.ESCALATION_DEFAULT_NUMBER || undefined,
            contactPhone: "+919876543210",
            contactEmail: "info@ketanbarber.com",
        },
        create: {
            id: "demo-barber",
            name: "Ketan Barber Shop",
            industry: "barber",
            address: "MG Road, Ahmedabad, Gujarat",
            city: "Ahmedabad",
            defaultLanguage: "en-IN",
            tier: "TIER_2",
            openingHours: "Monday to Saturday, 9 AM to 9 PM. Closed on Sundays.",
            escalationPhone: process.env.ESCALATION_DEFAULT_NUMBER || undefined,
            contactPhone: "+919876543210",
            contactEmail: "info@ketanbarber.com",
        },
    });
    console.log(`  ✅ Tenant: ${tenant.name} (${tenant.id})`);

    // Services
    await prisma.service.deleteMany({ where: { tenantId: tenant.id } });
    const services = await prisma.service.createMany({
        data: [
            { tenantId: tenant.id, name: "Haircut", price: "199 INR", duration: "30 min" },
            { tenantId: tenant.id, name: "Beard Trim", price: "99 INR", duration: "15 min" },
            { tenantId: tenant.id, name: "Haircut + Beard", price: "249 INR", duration: "45 min" },
            { tenantId: tenant.id, name: "Hair Coloring", price: "499 INR", duration: "60 min" },
            { tenantId: tenant.id, name: "Head Massage", price: "149 INR", duration: "20 min" },
        ],
    });
    console.log(`  ✅ Services: ${services.count} created`);

    // Staff
    await prisma.staff.deleteMany({ where: { tenantId: tenant.id } });
    const staff = await prisma.staff.createMany({
        data: [
            { tenantId: tenant.id, name: "Ketan", role: "Owner & Senior Stylist" },
            { tenantId: tenant.id, name: "Ravi", role: "Stylist" },
            { tenantId: tenant.id, name: "Amit", role: "Junior Stylist" },
        ],
    });
    console.log(`  ✅ Staff: ${staff.count} created`);

    // FAQs
    await prisma.faq.deleteMany({ where: { tenantId: tenant.id } });
    const faqs = await prisma.faq.createMany({
        data: [
            {
                tenantId: tenant.id,
                question: "Do you have parking?",
                answer: "Yes, we have free parking available right in front of the shop.",
            },
            {
                tenantId: tenant.id,
                question: "Do I need to book in advance?",
                answer: "Walk-ins are welcome, but we recommend booking an appointment during weekends to avoid waiting.",
            },
            {
                tenantId: tenant.id,
                question: "What payment methods do you accept?",
                answer: "We accept cash, UPI, and all major credit and debit cards.",
            },
            {
                tenantId: tenant.id,
                question: "Do you offer home service?",
                answer: "Currently we do not offer home service. Please visit our shop at MG Road, Ahmedabad.",
            },
        ],
    });
    console.log(`  ✅ FAQs: ${faqs.count} created`);

    // Policies
    await prisma.policy.deleteMany({ where: { tenantId: tenant.id } });
    const policies = await prisma.policy.createMany({
        data: [
            {
                tenantId: tenant.id,
                title: "Cancellation Policy",
                content: "You may cancel or reschedule your appointment up to 2 hours before the scheduled time. Late cancellations may result in a small fee.",
            },
            {
                tenantId: tenant.id,
                title: "Refund Policy",
                content: "If you are not satisfied with the service, please let us know within the appointment itself. We will redo the service at no extra charge.",
            },
        ],
    });
    console.log(`  ✅ Policies: ${policies.count} created`);

    // Phone number (link Twilio number to tenant)
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    if (twilioNumber) {
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
        console.log(`  ✅ Phone: ${twilioNumber} → ${tenant.name}`);
    } else {
        console.log(`  ⚠️  TWILIO_PHONE_NUMBER not set — skipping phone link`);
    }

    console.log("\n🎉 Seed complete!");
}

main()
    .catch((e) => {
        console.error("Seed failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
