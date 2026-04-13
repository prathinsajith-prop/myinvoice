import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create test user
  const hashedPassword = await hash("Test@123", 12);

  const user = await prisma.user.upsert({
    where: { email: "test@myinvoice.ae" },
    update: {},
    create: {
      email: "test@myinvoice.ae",
      name: "Test User",
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  console.log("✅ Created test user:", user.email);

  // Create organization for user
  const org = await prisma.organization.upsert({
    where: { slug: "test-company" },
    update: {},
    create: {
      name: "Test Company LLC",
      slug: "test-company",
      trn: "123456789012345",
      addressLine1: "Business Bay",
      city: "Dubai",
      emirate: "Dubai",
      country: "AE",
      phone: "+971501234567",
      email: "info@testcompany.ae",
      website: "https://testcompany.ae",
      defaultCurrency: "AED",
      plan: "PROFESSIONAL",
    },
  });

  console.log("✅ Created organization:", org.name);

  // Link user to organization as owner
  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: "OWNER",
    },
  });

  console.log("✅ Linked user to organization as OWNER");

  // Create sample customers
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: "cust-1" },
      update: {},
      create: {
        id: "cust-1",
        organizationId: org.id,
        name: "Dubai Tech Solutions",
        email: "accounts@dubaitech.ae",
        phone: "+971502345678",
        trn: "300000000000001",
        addressLine1: "Downtown Dubai",
        city: "Dubai",
        country: "AE",
      },
    }),
    prisma.customer.upsert({
      where: { id: "cust-2" },
      update: {},
      create: {
        id: "cust-2",
        organizationId: org.id,
        name: "Emirates Trading Co",
        email: "finance@emiratestrading.ae",
        phone: "+971503456789",
        trn: "300000000000002",
        addressLine1: "Business Bay",
        city: "Dubai",
        country: "AE",
      },
    }),
  ]);

  console.log("✅ Created", customers.length, "sample customers");

  // Create sample products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: "prod-1" },
      update: {},
      create: {
        id: "prod-1",
        organizationId: org.id,
        name: "Web Development Services",
        description: "Custom web application development",
        type: "SERVICE",
        unitPrice: 5000,
        vatRate: 5,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod-2" },
      update: {},
      create: {
        id: "prod-2",
        organizationId: org.id,
        name: "Consulting Hours",
        description: "Professional consulting services",
        type: "SERVICE",
        unitPrice: 500,
        vatRate: 5,
      },
    }),
  ]);

  console.log("✅ Created", products.length, "sample products");

  console.log("\n🎉 Seeding complete!");
  console.log("\n📧 Test Login Credentials:");
  console.log("   Email: test@myinvoice.ae");
  console.log("   Password: Test@123\n");
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
