# myInvoice.ae

**FTA-compliant e-invoicing platform built for UAE businesses.**

A production-grade multi-tenant SaaS covering the full invoicing lifecycle — from quotation to payment reconciliation — with built-in VAT engine, bilingual (English & Arabic) UI, and Stripe payment integration.

---

## Features

### Invoicing & Documents
- **Tax Invoices** — FTA Phase 1 compliant with TLV QR code, TRN fields, gapless sequential numbering
- **Quotations** → one-click conversion to invoice
- **Credit Notes & Debit Notes** — linked to original invoices with full VAT recalculation
- **Bills** — supplier invoice tracking with input VAT reclaim
- **Delivery Notes** — shipping and carrier tracking
- **Expenses** — categorised with VAT reclaim tracking
- **Recurring Invoices** — automated generation (weekly → annually) with auto-send

### Finance & Compliance
- **VAT Engine** — 5 treatments: standard, zero-rated, exempt, reverse charge, out-of-scope
- **VAT Returns** — quarterly computation from invoices + bills + expenses
- **FTA B2B Enforcement** — customer TRN required for B2B invoices > AED 10,000
- **Payment Tracking** — multi-method (Cash, Bank, Cheque, Card, Stripe, PayBy, Tabby, Tamara)
- **Payment Plans** — instalment schedules linked to invoices
- **Stripe Integration** — payment links, webhooks, automatic status updates

### Platform
- **Multi-tenant** — row-level isolation, unlimited organisations per user
- **5-tier RBAC** — Owner → Admin → Accountant → Member → Viewer
- **Subscription billing** — Free / Starter (AED 49) / Professional (AED 149) / Enterprise
- **Customer Portal** — token-based public portal with Stripe Pay Now
- **Global Search** — ⌘K search across all entity types
- **Export** — CSV, Excel, PDF for all list views
- **Audit Trail** — full before/after logging for every action
- **Document Versioning** — immutable snapshots on every revision

### Developer Experience
- **Bilingual** — English + Arabic with RTL layout (next-intl)
- **Dark / Light mode** — system-aware with toggle
- **29 UI components** — Radix + shadcn/ui + Tailwind CSS
- **2FA / TOTP** — authenticator app + backup codes
- **Security headers** — CSP, HSTS, X-Frame-Options, Permissions-Policy

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 6 |
| Database | PostgreSQL 18 + Redis 7 |
| Auth | NextAuth v5 (JWT) |
| UI | Radix UI + shadcn/ui + Tailwind CSS 4 |
| Forms | React Hook Form + Zod 4 |
| Charts | Recharts |
| Payments | Stripe |
| Email | Resend |
| i18n | next-intl |
| State | SWR + Zustand |
| PDF | jsPDF + pdf-lib |
| Package Manager | pnpm |

---

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm 10.33.0+
- Docker & Docker Compose
- Git

### 1. Clone & install

```bash
git clone https://github.com/your-org/myinvoice-ae.git
cd myinvoice-ae
pnpm install
```

### 2. Start services

```bash
# Start PostgreSQL 18 + Redis 7 in Docker
docker-compose up -d

# Verify
docker-compose ps
```

### 3. Configure environment

```bash
cp .env.example .env.local
# Default values work for local dev (see SETUP.md for details)
```

### 4. Set up database

```bash
# Run Prisma migrations (creates schema)
pnpm prisma migrate dev

# Seed sample data (optional)
pnpm db:seed
```

### 5. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, register
│   ├── (dashboard)/     # All authenticated pages
│   ├── api/             # REST API routes (50+ endpoints)
│   ├── onboarding/      # New user setup flow
│   └── portal/          # Public customer invoice portal
├── components/          # Reusable UI (29 components)
├── lib/
│   ├── api/             # API auth helpers, audit logging
│   ├── auth/            # NextAuth config, password utils
│   ├── db/              # Prisma client, tenant isolation
│   ├── email/           # Email templates + sending
│   ├── rbac.ts          # Role-based access control
│   ├── security/        # Rate limiting, TOTP
│   ├── services/        # Business logic (VAT, PDF, numbering, FTA QR)
│   ├── tenant/          # Server-side tenant context
│   └── validations/     # Zod schemas
├── i18n/                # Localization (en + ar)
└── types/               # TypeScript declarations
prisma/
├── schema.prisma        # 34-model database schema
└── seed.ts              # Development seed data
```

---

## Development Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:seed` | Seed development database |
| `npx prisma studio` | Open Prisma Studio |
| `npx prisma db push` | Sync schema to database |
| `npx prisma generate` | Regenerate Prisma client |

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions. Required variables:

- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` / `NEXTAUTH_SECRET` — NextAuth JWT signing secret
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — Stripe payment processing
- `RESEND_API_KEY` — Transactional email

Optional (feature-enabled when set):
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — Redis-backed rate limiting
- `SENTRY_DSN` — Error monitoring
- `R2_*` — Cloud file storage for images and PDFs

---

## Architecture

### Multi-tenancy
Shared database with row-level isolation. Every tenant-scoped query automatically receives an `organizationId` filter via the `getTenantPrisma()` Prisma extension in `src/lib/db/tenant.ts`.

### RBAC
Five roles with increasing permissions: `VIEWER → MEMBER → ACCOUNTANT → ADMIN → OWNER`. Permissions (`view`, `create`, `edit`, `delete`, `export`, `manage_team`, `manage_org`, `manage_billing`) are enforced at the API layer via `resolveApiContextWithPermission()`.

### VAT Engine
`src/lib/services/vat.ts` handles all tax calculations with full support for UAE FTA treatments (standard-rated 5%, zero-rated, exempt, reverse charge, out-of-scope) and VAT-inclusive pricing.

### Document Numbering
All document numbers (INV-0001, QT-0001, etc.) are generated atomically using PostgreSQL `FOR UPDATE` row locks in `src/lib/services/numbering.ts` — guaranteed gapless and sequential per FTA requirements.

---

## Deployment

The app is configured for Vercel with two cron jobs:

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/recurring-invoices` | Daily 06:00 UTC | Generate due recurring invoices |
| `/api/cron/payment-reminders` | Daily 07:00 + 14:00 UTC | Send payment reminder emails |

Set all environment variables in your Vercel project settings before deploying.

---

## Roadmap

See [`docs/PRODUCT-REVIEW-AND-ROADMAP.md`](docs/PRODUCT-REVIEW-AND-ROADMAP.md) for the full product review and improvement roadmap including:
- Phase 1: Production hardening (testing, monitoring, security)
- Phase 2: Product polish (accessibility, reports, portal v2)
- Phase 3: Global expansion (multi-currency, public API, GDPR)
- Phase 4: Scale & ecosystem (Redis caching, integrations, AI)

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for code conventions, branch strategy, and pull request guidelines.

---

## License

Private — all rights reserved.


## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
