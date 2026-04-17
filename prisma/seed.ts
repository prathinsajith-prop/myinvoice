import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Document sequence defaults per org ──────────────────────────────────────
const DOCUMENT_SEQUENCES = [
  { documentType: "INVOICE" as const, prefix: "INV", nextSequence: 1, padLength: 4 },
  { documentType: "PROFORMA" as const, prefix: "PI", nextSequence: 1, padLength: 4 },
  { documentType: "QUOTATION" as const, prefix: "QT", nextSequence: 1, padLength: 4 },
  { documentType: "CREDIT_NOTE" as const, prefix: "CN", nextSequence: 1, padLength: 4 },
  { documentType: "DEBIT_NOTE" as const, prefix: "DN", nextSequence: 1, padLength: 4 },
  { documentType: "BILL" as const, prefix: "BILL", nextSequence: 1, padLength: 4 },
  { documentType: "DELIVERY_NOTE" as const, prefix: "DLV", nextSequence: 1, padLength: 4 },
];

async function seedUser(email: string, name: string, orgSlug: string, orgName: string) {
  const hashedPassword = await hash("Test@123", 12);

  // 1. Upsert user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  // 2. Upsert organization — every user gets their own org
  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {},
    create: {
      name: orgName,
      slug: orgSlug,
      trn: "123456789012345",
      legalName: orgName,
      businessType: "LLC",
      addressLine1: "Business Bay, Tower A",
      addressLine2: "Floor 12, Office 1201",
      city: "Dubai",
      emirate: "Dubai",
      country: "AE",
      postalCode: "00000",
      phone: "+971501234567",
      email: `info@${orgSlug}.ae`,
      defaultCurrency: "AED",
      defaultVatRate: 5,
      defaultPaymentTerms: 30,
      invoicePrefix: "INV",
      proformaPrefix: "PI",
      quotePrefix: "QT",
      creditNotePrefix: "CN",
      debitNotePrefix: "DN",
      billPrefix: "BILL",
      paymentPrefix: "PAY",
    },
  });

  // 3. Upsert membership — OWNER, immediately accepted
  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: "OWNER",
      inviteStatus: "ACCEPTED",
      acceptedAt: new Date(),
      isActive: true,
    },
  });

  // 4. Upsert subscription — PROFESSIONAL trial
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      plan: "PROFESSIONAL",
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      monthlyInvoiceLimit: 500,
      teamMemberLimit: 10,
      storageGbLimit: 10,
      customersLimit: 500,
      hasApiAccess: true,
      hasCustomBranding: true,
      hasAdvancedReports: true,
      hasMultiCurrency: true,
    },
  });

  // 5. Upsert organization settings
  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      vatRegistered: true,
      vatEffectiveDate: new Date("2018-01-01"),
      showLogo: true,
      showQrCode: true,
      showBankDetails: false,
      autoReminders: true,
      reminderDaysBefore: [3, 7],
      reminderDaysAfter: [3, 7, 14],
      timezone: "Asia/Dubai",
      dateFormat: "DD/MM/YYYY",
      language: "en",
    },
  });

  // 6. Upsert document sequences — gapless numbering per type
  for (const seq of DOCUMENT_SEQUENCES) {
    await prisma.documentSequence.upsert({
      where: { organizationId_documentType: { organizationId: org.id, documentType: seq.documentType } },
      update: {},
      create: { organizationId: org.id, ...seq },
    });
  }

  return { user, org };
}

async function main() {
  console.log("🌱 Seeding database...");

  // ── Seed primary test user + org ─────────────────────────────────────────
  const { user: owner, org } = await seedUser(
    "test@myinvoice.ae",
    "Ali Hassan",
    "test-company",
    "Test Company LLC"
  );
  console.log("✅ Owner:", owner.email, "→ Org:", org.name);

  // ── Seed a second user + their own org (demonstrates multi-tenant) ────────
  const { user: user2, org: org2 } = await seedUser(
    "admin@myinvoice.ae",
    "Sara Ahmed",
    "sara-trading",
    "Sara Trading FZE"
  );
  console.log("✅ User2:", user2.email, "→ Org:", org2.name);

  // ── Add user2 as ADMIN on the primary org too ─────────────────────────────
  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: user2.id, organizationId: org.id } },
    update: {},
    create: {
      userId: user2.id,
      organizationId: org.id,
      role: "ADMIN",
      inviteStatus: "ACCEPTED",
      acceptedAt: new Date(),
      isActive: true,
    },
  });
  console.log("✅ user2 added as ADMIN to primary org");

  // ── Add owner (test@myinvoice.ae) as MEMBER on Sara Trading FZE ───────────
  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org2.id } },
    update: {},
    create: {
      userId: owner.id,
      organizationId: org2.id,
      role: "MEMBER",
      inviteStatus: "ACCEPTED",
      acceptedAt: new Date(),
      isActive: true,
    },
  });
  console.log("✅ owner added as MEMBER to Sara Trading FZE");

  // ── Customers ─────────────────────────────────────────────────────────────
  const [cust1, _cust2] = await Promise.all([
    prisma.customer.upsert({
      where: { organizationId_email: { organizationId: org.id, email: "accounts@dubaitech.ae" } },
      update: {},
      create: {
        organizationId: org.id,
        name: "Dubai Tech Solutions LLC",
        type: "BUSINESS",
        email: "accounts@dubaitech.ae",
        phone: "+971502345678",
        trn: "300000000000001",
        isVatRegistered: true,
        addressLine1: "Downtown Dubai, Emaar Square",
        city: "Dubai",
        emirate: "Dubai",
        country: "AE",
        defaultPaymentTerms: 30,
        currency: "AED",
        defaultVatTreatment: "STANDARD_RATED",
      },
    }),
    prisma.customer.upsert({
      where: { organizationId_email: { organizationId: org.id, email: "finance@emiratestrading.ae" } },
      update: {},
      create: {
        organizationId: org.id,
        name: "Emirates Trading Co",
        type: "BUSINESS",
        email: "finance@emiratestrading.ae",
        phone: "+971503456789",
        trn: "300000000000002",
        isVatRegistered: true,
        addressLine1: "Business Bay, Churchill Tower",
        city: "Dubai",
        emirate: "Dubai",
        country: "AE",
        defaultPaymentTerms: 15,
        currency: "AED",
      },
    }),
  ]);
  console.log("✅ Created 2 customers");

  // ── Supplier ──────────────────────────────────────────────────────────────
  const supplier = await prisma.supplier.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "billing@cloudhost.ae" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "CloudHost UAE",
      type: "BUSINESS",
      email: "billing@cloudhost.ae",
      phone: "+97142345678",
      trn: "100000000000001",
      isVatRegistered: true,
      addressLine1: "DIFC, Gate Village",
      city: "Dubai",
      country: "AE",
      defaultPaymentTerms: 30,
      currency: "AED",
    },
  });
  console.log("✅ Created supplier:", supplier.name);

  // ── Products ──────────────────────────────────────────────────────────────
  const [prod1, prod2] = await Promise.all([
    prisma.product.upsert({
      where: { organizationId_sku: { organizationId: org.id, sku: "WEB-DEV-001" } },
      update: {},
      create: {
        organizationId: org.id,
        sku: "WEB-DEV-001",
        name: "Web Development Services",
        description: "Custom web application development — per project",
        type: "SERVICE",
        unitPrice: 5000,
        unitOfMeasure: "project",
        vatTreatment: "STANDARD_RATED",
        vatRate: 5,
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { organizationId_sku: { organizationId: org.id, sku: "CONSULT-001" } },
      update: {},
      create: {
        organizationId: org.id,
        sku: "CONSULT-001",
        name: "Consulting Hours",
        description: "Professional consulting services — per hour",
        type: "SERVICE",
        unitPrice: 500,
        unitOfMeasure: "hour",
        vatTreatment: "STANDARD_RATED",
        vatRate: 5,
        isActive: true,
      },
    }),
  ]);
  console.log("✅ Created 2 products");

  // ── Sample Invoice (SENT, with line items) ────────────────────────────────
  const existingInvoice = await prisma.invoice.findUnique({
    where: { organizationId_invoiceNumber: { organizationId: org.id, invoiceNumber: "INV-0001" } },
  });

  if (!existingInvoice) {
    const lineItem1Subtotal = 5000;
    const lineItem1Vat = lineItem1Subtotal * 0.05;
    const lineItem1Total = lineItem1Subtotal + lineItem1Vat;

    const lineItem2Subtotal = 1000; // 2 hours × 500
    const lineItem2Vat = lineItem2Subtotal * 0.05;
    const lineItem2Total = lineItem2Subtotal + lineItem2Vat;

    const subtotal = lineItem1Subtotal + lineItem2Subtotal;
    const totalVat = lineItem1Vat + lineItem2Vat;
    const total = lineItem1Total + lineItem2Total;

    await prisma.invoice.create({
      data: {
        organizationId: org.id,
        customerId: cust1.id,
        invoiceNumber: "INV-0001",
        invoiceType: "TAX_INVOICE",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "SENT",
        currency: "AED",
        sellerTrn: "123456789012345",
        buyerTrn: cust1.trn ?? undefined,
        subtotal,
        totalVat,
        discount: 0,
        total,
        amountPaid: 0,
        outstanding: total,
        sentAt: new Date(),
        lineItems: {
          create: [
            {
              productId: prod1.id,
              description: prod1.name,
              quantity: 1,
              unitPrice: prod1.unitPrice,
              unitOfMeasure: "project",
              vatTreatment: "STANDARD_RATED",
              vatRate: 5,
              discount: 0,
              subtotal: lineItem1Subtotal,
              vatAmount: lineItem1Vat,
              total: lineItem1Total,
              sortOrder: 0,
            },
            {
              productId: prod2.id,
              description: `${prod2.name} — 2 hours`,
              quantity: 2,
              unitPrice: prod2.unitPrice,
              unitOfMeasure: "hour",
              vatTreatment: "STANDARD_RATED",
              vatRate: 5,
              discount: 0,
              subtotal: lineItem2Subtotal,
              vatAmount: lineItem2Vat,
              total: lineItem2Total,
              sortOrder: 1,
            },
          ],
        },
      },
    });

    // Update the invoice sequence counter
    await prisma.documentSequence.update({
      where: { organizationId_documentType: { organizationId: org.id, documentType: "INVOICE" } },
      data: { nextSequence: 2 },
    });

    // Update customer analytics
    await prisma.customer.update({
      where: { id: cust1.id },
      data: {
        totalInvoiced: { increment: total },
        totalOutstanding: { increment: total },
        invoiceCount: { increment: 1 },
        lastInvoiceDate: new Date(),
      },
    });

    console.log("✅ Created sample invoice INV-0001 (AED", total.toFixed(2), ")");
  }

  // ── Sample Bill ───────────────────────────────────────────────────────────
  const existingBill = await prisma.bill.findUnique({
    where: { organizationId_billNumber: { organizationId: org.id, billNumber: "BILL-0001" } },
  });

  if (!existingBill) {
    const billSubtotal = 2000;
    const billVat = billSubtotal * 0.05;
    const billTotal = billSubtotal + billVat;

    await prisma.bill.create({
      data: {
        organizationId: org.id,
        supplierId: supplier.id,
        billNumber: "BILL-0001",
        supplierInvoiceNumber: "CH-INV-2024-001",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "RECEIVED",
        currency: "AED",
        supplierTrn: supplier.trn ?? undefined,
        vatReclaimable: true,
        subtotal: billSubtotal,
        totalVat: billVat,
        discount: 0,
        total: billTotal,
        amountPaid: 0,
        outstanding: billTotal,
        inputVatAmount: billVat,
        lineItems: {
          create: [
            {
              description: "Cloud Hosting — Annual Plan",
              quantity: 1,
              unitPrice: billSubtotal,
              unitOfMeasure: "year",
              vatTreatment: "STANDARD_RATED",
              vatRate: 5,
              discount: 0,
              subtotal: billSubtotal,
              vatAmount: billVat,
              total: billTotal,
              isReclaimable: true,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    // Update bill sequence counter
    await prisma.documentSequence.update({
      where: { organizationId_documentType: { organizationId: org.id, documentType: "BILL" } },
      data: { nextSequence: 2 },
    });

    // Update supplier analytics
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        totalBilled: { increment: billTotal },
        totalOutstanding: { increment: billTotal },
        billCount: { increment: 1 },
        lastBillDate: new Date(),
      },
    });

    console.log("✅ Created sample bill BILL-0001 (AED", billTotal.toFixed(2), ")");
  }

  console.log("\n🎉 Seeding complete!");
  console.log("\n📧 Test Credentials (password: Test@123):");
  console.log("   Owner   → test@myinvoice.ae  (Test Company LLC)");
  console.log("   Admin   → admin@myinvoice.ae (Sara Trading FZE + Admin on Test Company)\n");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
