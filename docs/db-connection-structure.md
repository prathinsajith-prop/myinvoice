# Database Connection & Structure — myinvoice.ae

## Stack

| Component | Value |
|-----------|-------|
| Engine | PostgreSQL 18 |
| ORM | Prisma 7 |
| Adapter | `@prisma/adapter-pg` + `pg` connection pool |
| Client output | `src/generated/prisma` |
| Config file | `prisma.config.ts` |
| Schema file | `prisma/schema.prisma` |

---

## Connection Setup

### `prisma.config.ts`
Provides the datasource URL to Prisma's config system (Prisma 7+).

```ts
// prisma.config.ts
import defineConfig from "prisma/config";
import "dotenv/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  migrate: {
    async adapter() {
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const { PrismaPg } = await import("@prisma/adapter-pg");
      return new PrismaPg(pool);
    },
  },
});
```

### `src/lib/db/prisma.ts`
Singleton Prisma client with the `pg` Pool adapter for connection pooling.

```ts
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### `.env`
```
DATABASE_URL="postgresql://USER@localhost:5432/myinvoice_dev"
```

---

## Tenancy Model

**Shared database, shared schema, row-level isolation.**

Every tenant-scoped table has an `organizationId` column. All queries **must** include this field.

```ts
// ✅ Correct — always scope by org
const invoices = await prisma.invoice.findMany({
  where: { organizationId, deletedAt: null },
});

// ❌ Wrong — missing org scope
const invoices = await prisma.invoice.findMany();
```

For server-side contexts where you always know the org, use the Prisma Extension pattern from `src/lib/db/tenant.ts` to inject `organizationId` automatically.

---

## Schema Overview — 34 Models, 18 Enums

### Auth & Global (5 models)
| Model | Purpose |
|-------|---------|
| `User` | Platform user — auth, preferences, 2FA |
| `Account` | OAuth provider accounts (NextAuth v5) |
| `Session` | Active sessions with device metadata |
| `VerificationToken` | Email verification / password reset |
| `Notification` | Per-user in-app notifications with entity linking |

### Organization (3 models)
| Model | Purpose |
|-------|---------|
| `Organization` | Tenant root — TRN, branding, defaults |
| `Subscription` | Plan, Stripe fields, feature gates |
| `OrganizationMembership` | User↔Org with role + invite lifecycle |

### Tenant Settings (2 models)
| Model | Purpose |
|-------|---------|
| `OrganizationSettings` | VAT config, payment gateways, reminders, bank details |
| `DocumentSequence` | Gapless sequential numbering per document type per org |

### Core Entities (3 models)
| Model | Purpose |
|-------|---------|
| `Customer` | Clients — TRN, portal access, denormalized analytics |
| `Supplier` | Vendors — bank details, bill analytics |
| `Product` | Products & services — inventory, VAT treatment |

### Sales Documents (8 models)
| Model | Purpose |
|-------|---------|
| `Quotation` + `QuotationLineItem` | Sales quotes with validity, conversion to invoice |
| `Invoice` + `InvoiceLineItem` | Tax invoices — FTA-compliant, QR code, TRN snapshot |
| `CreditNote` + `CreditNoteLineItem` | Credit adjustments against invoices |
| `DebitNote` + `DebitNoteLineItem` | Debit adjustments against invoices |

### Payables (2 models)
| Model | Purpose |
|-------|---------|
| `Bill` + `BillLineItem` | Supplier invoices — input VAT tracking, reclaimable flag |

### Financial (8 models)
| Model | Purpose |
|-------|---------|
| `Payment` + `PaymentAllocation` | Payments received — split across multiple invoices |
| `PaymentOut` + `PaymentOutAllocation` | Payments made — split across multiple bills |
| `PaymentPlan` + `PaymentPlanInstallment` | Installment schedules for invoices or bills |
| `Expense` | Business expenses with receipt tracking |

### Supporting (4 models)
| Model | Purpose |
|-------|---------|
| `InvoiceTemplate` | PDF layout config per org |
| `Attachment` | File storage with explicit FK per entity type |
| `AuditLog` | Immutable event log (FTA 5-year retention) |
| `VatReturn` | Quarterly VAT filing tracker |

---

## Key Design Decisions

### 1. Soft Deletes (FTA Retention)
The following models use `deletedAt DateTime?` instead of hard deletes:
`Invoice`, `Bill`, `CreditNote`, `DebitNote`, `Customer`, `Supplier`, `Product`, `Expense`

Always include `deletedAt: null` in queries for active records:
```ts
where: { organizationId, deletedAt: null }
```

### 2. Gapless Document Numbering
`DocumentSequence` provides atomic sequential numbers. Never generate numbers at the application layer.

```ts
// src/lib/db/sequence.ts
export async function nextDocumentNumber(
  organizationId: string,
  type: DocumentType
): Promise<string> {
  const seq = await prisma.$executeRaw`
    UPDATE "DocumentSequence"
    SET "nextSequence" = "nextSequence" + 1, "updatedAt" = now()
    WHERE "organizationId" = ${organizationId} AND "documentType" = ${type}
    RETURNING "prefix", "nextSequence" - 1 AS seq, "padLength"
  `;
  // Return formatted: e.g. INV-0042
}
```

### 3. Partial Payments (Junction Tables)
`PaymentAllocation` and `PaymentOutAllocation` allow one payment to be split across multiple invoices/bills:

```
Payment ($1000) → PaymentAllocation → Invoice #42 ($600)
                → PaymentAllocation → Invoice #43 ($400)
```

The `amountPaid` and `outstanding` fields on `Invoice`/`Bill` are denormalized for fast queries and must be updated transactionally.

### 4. FTA Compliance Fields
On `Invoice`:
- `sellerTrn` / `buyerTrn` — snapshotted at issue time (immutable)
- `qrCodeData` — Base64 TLV encoded per FTA specification
- `ftaCompliant` — flag set after QR generation
- `invoiceType` — `TAX_INVOICE | SIMPLIFIED_TAX | PROFORMA`

### 5. Attachments — Explicit FK Pattern
`Attachment` uses optional FK columns (`invoiceId?`, `quotationId?`, `billId?`, etc.) instead of polymorphic `entityId: String`. This enables:
- Cascade deletes via Prisma relations
- Typed back-references on each parent model
- Indexed per entity type for fast retrieval

### 6. Customer/Supplier Analytics (Denormalized)
`Customer.totalInvoiced`, `.totalPaid`, `.totalOutstanding`, `.invoiceCount` are updated on every payment event. This avoids expensive aggregation queries on the invoices table for dashboard widgets.

---

## Common Query Patterns

### Overdue Invoices
```ts
const overdue = await prisma.invoice.findMany({
  where: {
    organizationId,
    deletedAt: null,
    status: { in: ["SENT", "PARTIALLY_PAID"] },
    dueDate: { lt: new Date() },
  },
  include: { customer: { select: { name: true, email: true } } },
  orderBy: { dueDate: "asc" },
});
```

### Dashboard Summary (use DB aggregation, not JS)
```ts
const [invoiceSum, collectedSum] = await prisma.$transaction([
  prisma.invoice.aggregate({
    where: { organizationId, deletedAt: null, status: { not: "VOID" } },
    _sum: { total: true, amountPaid: true, outstanding: true },
  }),
  prisma.payment.aggregate({
    where: { organizationId },
    _sum: { amount: true },
  }),
]);
```

### Quotation → Invoice Conversion
```ts
// Invoice.quotationId is @unique — one-to-one
const invoice = await prisma.invoice.create({
  data: {
    ...invoiceData,
    quotationId: quotation.id,
  },
});
await prisma.quotation.update({
  where: { id: quotation.id },
  data: { status: "CONVERTED", convertedAt: new Date() },
});
```

### Next Invoice Number
```ts
// Always use a transaction to prevent race conditions
await prisma.$transaction(async (tx) => {
  const seq = await tx.documentSequence.update({
    where: { organizationId_documentType: { organizationId, documentType: "INVOICE" } },
    data: { nextSequence: { increment: 1 } },
    select: { prefix: true, nextSequence: true, padLength: true },
  });
  const number = `${seq.prefix}-${String(seq.nextSequence - 1).padStart(seq.padLength, "0")}`;
  // ... create invoice with this number
});
```

---

## Index Strategy

Critical composite indexes defined in schema:

| Table | Index | Purpose |
|-------|-------|---------|
| `Invoice` | `(organizationId, status, dueDate)` | Overdue queries |
| `Invoice` | `(organizationId, customerId)` | Customer invoice list |
| `Invoice` | `(publicToken)` | Public invoice view |
| `Customer` | `(organizationId, isActive)` | Active customer list |
| `Customer` | `(portalToken)` | Self-service portal auth |
| `AuditLog` | `(organizationId, createdAt)` | Timeline queries |
| `Notification` | `(userId, isRead, createdAt)` | Unread badge count |
| `DocumentSequence` | `(organizationId, documentType)` | Unique per type per org |

---

## Migration Workflow

```bash
# Validate schema
pnpm exec prisma validate

# Create a named migration (interactive — dev only)
pnpm exec prisma migrate dev --name <description>

# Push schema directly to dev DB without migration history
pnpm exec prisma db push --accept-data-loss

# Deploy migrations in CI/production
pnpm exec prisma migrate deploy

# Regenerate Prisma client after schema changes
pnpm exec prisma generate

# View DB in browser
pnpm exec prisma studio
```

> **Note**: Always run `prisma generate` after any schema change. The generated client lives at `src/generated/prisma` (not `node_modules/@prisma/client`) due to pnpm isolation settings.

---

## Connection Pooling

The `pg.Pool` is created once at module scope in `src/lib/db/prisma.ts`. Default pool config:
- `max`: 10 connections (pg default)
- `idleTimeoutMillis`: 30000
- `connectionTimeoutMillis`: 2000

For production, set explicit pool limits via environment variables or pass a config object to `new Pool({ connectionString, max: 20 })`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | NextAuth JWT signing secret |
| `NEXTAUTH_SECRET` | ✅ | NextAuth legacy compat alias |
| `NEXTAUTH_URL` | ✅ | App base URL for auth callbacks |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public-facing app URL |
