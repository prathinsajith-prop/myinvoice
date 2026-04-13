# Plan: myinvoice.ae - UAE E-Invoicing Platform

## TL;DR
Build a production-ready **multi-tenant** e-invoicing SaaS platform for UAE businesses using **Next.js 14 + Tailwind CSS**, deployed on **Vercel** with **PostgreSQL (Neon)** backend. The platform will be fully compliant with **UAE FTA e-invoicing regulations**, support **Arabic RTL**, integrate multiple payment gateways (Stripe, PayBy, Tabby), and serve both SMBs and enterprises with complete data isolation per tenant.

**Timeline:** 3 months to production-ready release (12 weeks)

---

## Architecture Overview

```
Frontend (Next.js 14 App Router)
├── Public Pages (Marketing, Pricing, Auth)
├── Dashboard (Protected Routes)
├── Invoice Builder
├── Customer Management
└── Analytics & Reports

Backend (Next.js API Routes + Server Actions)
├── Authentication (NextAuth.js v5)
├── Invoice CRUD Operations
├── PDF Generation Service
├── Email Service (Resend/SendGrid)
├── Payment Processing
└── FTA Compliance Engine

Database (PostgreSQL via Neon)
├── Users & Organizations
├── Customers
├── Invoices & Line Items
├── Products/Services
└── Audit Logs (FTA Compliance)
```

---

## Multi-Tenant Architecture

### Tenancy Model: Shared Database, Shared Schema
All tenants share the same database with row-level isolation via `organizationId` foreign keys. This approach balances cost-efficiency with data isolation.

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  TenantContext Provider (React Context)                      │
│  ├── Current org from session/JWT                           │
│  ├── Passed to all data-fetching hooks                      │
│  └── Used in Server Components via headers/cookies          │
├─────────────────────────────────────────────────────────────┤
│  Data Access Layer (Prisma + Middleware)                     │
│  ├── Auto-inject organizationId on all queries              │
│  ├── Auto-filter results by organizationId                  │
│  └── Prevent cross-tenant data access                       │
├─────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL)                                       │
│  ├── All tenant tables have organizationId FK               │
│  ├── Composite indexes: (organizationId, ...)               │
│  └── Row-Level Security policies (optional extra layer)     │
└─────────────────────────────────────────────────────────────┘
```

### Tenant Isolation Strategy

| Layer | Isolation Mechanism |
|-------|--------------------|
| **Authentication** | User belongs to Organization; JWT contains `organizationId` |
| **API Routes** | Middleware validates tenant access before processing |
| **Database Queries** | Prisma extension auto-adds `WHERE organizationId = ?` |
| **File Storage** | S3/R2 paths prefixed with `org-{id}/` |
| **Billing** | Stripe Customer per Organization |
| **Subdomains** | Optional: `{tenant}.myinvoice.ae` routing |

### Key Multi-Tenant Features
- **Organization Switching:** Users can belong to multiple organizations
- **Invitation System:** Invite team members via email with role assignment
- **Tenant Onboarding:** Guided setup creates organization + first admin
- **Data Export:** Per-tenant data export for compliance/portability
- **Tenant Settings:** Custom branding, invoice templates, tax config per org
- **Usage Limits:** Plan-based limits (invoices/month, team seats, storage)

### Prisma Schema Pattern
```prisma
// All tenant-scoped models follow this pattern:
model Invoice {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  // ... other fields
  
  @@index([organizationId, createdAt])
  @@index([organizationId, status])
}
```

### Tenant-Aware Prisma Client
```typescript
// src/lib/db/tenant-client.ts
export function getTenantPrisma(organizationId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, organizationId };
          return query(args);
        },
        // ... other operations
      },
    },
  });
}
```

---

## Phase 1: Foundation (Weeks 1-3)

### 1.1 Project Setup & Infrastructure
- Initialize Next.js 14 with App Router, TypeScript, ESLint, Prettier
- Configure Tailwind CSS with custom design system (UAE-inspired palette)
- Setup PostgreSQL on Neon with Prisma ORM
- Configure Vercel deployment with preview environments
- Setup CI/CD pipeline with GitHub Actions
- Configure environment variables and secrets management

**Deliverables:** Running dev environment, deployed preview URL

### 1.2 Authentication System
- Implement NextAuth.js v5 with:
  - Email/password with magic links
  - Google OAuth
  - Apple OAuth (for iOS users)
  - UAE Pass integration (OAuth 2.0 flow)
- Organization/tenant setup post-registration
- Role-based access control (Owner, Admin, Accountant, Viewer)
- Session management and security headers

**Key Files:**
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/lib/auth/providers/`
- `prisma/schema.prisma` (User, Organization, Role models)

### 1.3 Database Schema Design (Multi-Tenant)

**Global Models (not tenant-scoped):**
- **User** - Authentication identity, can belong to multiple orgs
- **OrganizationMembership** - Links User ↔ Organization with role
- **Subscription** - Billing plan per organization

**Tenant-Scoped Models (all have organizationId FK):**
- **Organization** - Tenant entity, TRN, branding, settings
- **Customer** - Client details, TRN, billing addresses
- **Supplier** - Vendor details, TRN, bank info, payment terms
- **Quotation** - Estimates with conversion to invoice
- **Invoice** - Core invoice data, status workflow (Tax Invoice, Proforma)
- **InvoiceLineItem** - Products/services, quantities, VAT
- **CreditNote** - Refunds/corrections linked to invoices
- **DebitNote** - Price adjustments linked to invoices
- **Bill** - Supplier invoices (payables)
- **BillLineItem** - Bill details with VAT
- **Payment** - Payments received (for invoices)
- **PaymentOut** - Payments made (for bills)
- **PaymentPlan** - Scheduled payment installments
- **Product** - Reusable product/service catalog
- **Expense** - Quick expense entries
- **AuditLog** - FTA compliance tracking
- **InvoiceTemplate** - Custom PDF templates per org
- **OrganizationSettings** - Tax config, payment terms, defaults
- **Attachment** - Files linked to invoices/bills

**Tenant Isolation Rules:**
- Every tenant-scoped query MUST include `organizationId` filter
- Prisma middleware enforces this automatically
- Composite indexes on `(organizationId, <primary_lookup>)` for performance

### 1.4 Internationalization (i18n)
- Configure next-intl for EN/AR support
- RTL layout system with Tailwind CSS logical properties
- Date formatting (Gregorian + Hijri calendar option)
- Number/currency formatting for AED
- Translation management workflow

---

## Phase 2: Core Sales Documents (Weeks 4-6)

### 2.1 Document Types (Full Sales Cycle)

**Quotations/Estimates:**
- Create professional quotes with validity period
- Convert accepted quote → Invoice (one-click)
- Quote versioning (revisions tracked)
- Customer acceptance workflow (optional e-signature)
- Quote expiry notifications

**Proforma Invoices:**
- Pre-shipment/advance payment invoices
- Convert proforma → Tax Invoice after payment
- Required for UAE customs and imports
- Distinct numbering sequence (PI-XXXX)

**Tax Invoices:**
- Visual invoice builder with drag-and-drop line items
- Real-time VAT calculation (5% standard rate)
- Auto-generated invoice numbers (configurable format)
- Multiple currency support (AED primary, USD/EUR)
- Discount handling (percentage and fixed)
- Notes and terms fields
- Due date and payment terms selection
- Draft/Save/Send workflow
- Duplicate detection (warn on similar invoice)
- File attachments (contracts, POs, receipts)

**Credit Notes:**
- Issue refunds/corrections linked to original invoice
- Partial or full credit
- Auto-updates original invoice balance
- FTA-compliant credit note format

**Debit Notes:**
- Price increase adjustments (FTA required)
- Link to original invoice
- VAT recalculation on adjustments

**Delivery Notes:**
- Shipping documentation
- Link to invoice or standalone
- Proof of delivery tracking

### 2.2 Payment Tracking
- **Partial Payments:** Record multiple payments against one invoice
- **Payment History:** Full audit trail per invoice
- **Balance Tracking:** Outstanding amount auto-calculated
- **Late Payment Fees:** Auto-calculate penalty (configurable %)
- **Payment Plans:** Split invoice into scheduled installments
- **Activity Timeline:** Sent → Viewed → Reminded → Paid history

### 2.3 Customer Management (Mini-CRM)
- Customer CRUD operations
- Contact history timeline
- Multiple billing addresses
- TRN validation for B2B invoices
- Customer import (CSV/Excel)
- Quick customer creation from invoice editor
- Customer credit limit tracking
- Payment behavior analytics (average days to pay)

### 2.4 Product/Service Catalog
- Products and services management
- Default VAT treatment per item
- Pricing tiers (for enterprise plans)
- Bulk import capability
- SKU/barcode support
- Unit of measure (hours, pieces, kg, etc.)

### 2.5 PDF Generation
- Server-side PDF generation using React-PDF or Puppeteer
- Multiple templates (Professional, Minimal, Corporate)
- Automatic QR code generation (FTA compliance)
- Arabic RTL PDF support
- Digital signature placeholder
- Branding customization (logo, colors, footer)
- Batch PDF export (multiple invoices)

### 2.6 Bulk Operations
- Select multiple invoices for batch actions
- Bulk send/resend via email
- Bulk void/cancel
- Bulk export (PDF, CSV, Excel)
- Bulk status update

---

## Phase 3: UAE FTA Compliance (Weeks 7-8)

### 3.1 E-Invoicing Standards Implementation
UAE FTA requires certain fields and formats:
- **Mandatory Fields:**
  - Seller TRN
  - Buyer TRN (for B2B over AED 10,000)
  - Invoice date and unique number
  - Description of goods/services
  - VAT amount per line and total
  - Total invoice amount in AED
- **QR Code Requirements:**
  - Seller name
  - VAT registration number
  - Invoice timestamp
  - Total VAT amount
  - Total invoice amount

### 3.2 VAT Compliance Engine
- Automatic 5% VAT calculation
- VAT-exempt item handling
- Reverse charge mechanism for imports
- Credit note support (for refunds/corrections)
- VAT return period tracking
- Export-ready VAT reports

### 3.3 Audit & Compliance
- Immutable audit log for all invoice changes
- Invoice versioning (amendments create new versions)
- Digital timestamping
- Data retention policies (5+ years per FTA)
- Export functionality for FTA audits

---

## Phase 4: Supplier Bills & Payables (Week 9)

### 4.1 Supplier Management
- Supplier CRUD (similar to customers)
- Supplier TRN validation
- Payment terms per supplier
- Contact persons and addresses
- Supplier import (CSV/Excel)

### 4.2 Bill Upload & Processing
- **Upload Supplier Invoices:** PDF/image upload
- **OCR Extraction (Optional):** Auto-extract bill details from uploaded documents
- **Manual Entry:** Create bills from scratch
- **Bill Fields:**
  - Supplier reference/invoice number
  - Bill date and due date
  - Line items with VAT
  - Attachments (original invoice PDF)
- **Bill Matching:** Link to purchase orders (future)

### 4.3 Payment Plans (Payables)
- **Scheduled Payments:** Split bill into installments
- **Payment Calendar:** View upcoming payment obligations
- **Payment Reminders:** Alerts before due dates
- **Payment Recording:** Track partial/full payments made
- **Bank Details:** Store supplier bank info for payments

### 4.4 Payables Dashboard
- Total outstanding to suppliers
- Aging report (30/60/90 days overdue)
- Cash flow forecast (upcoming bills)
- Supplier-wise breakdown
- VAT input credits tracking

### 4.5 Expense Tracking (Simple)
- Quick expense entry (no supplier bill needed)
- Categorization (rent, utilities, travel, etc.)
- Receipt upload
- VAT recovery tracking

---

## Phase 5: Payments & Communications (Week 10)

### 5.1 Payment Gateway Integrations
**Stripe:**
- Payment links on invoices
- Card payments
- Webhook handling for payment status

**PayBy / Network International:**
- UAE-specific card processing
- Local bank integrations

**Tabby / Tamara:**
- Buy Now Pay Later options
- Split payment support

### 5.2 Communication Channels

**Email System:**
- Transactional emails via Resend/SendGrid
- Invoice delivery with PDF attachment
- Payment reminders (configurable schedule)
- Receipt confirmations
- Branded email templates
- Scheduled email sending

**WhatsApp Integration:**
- Share invoice link via WhatsApp (native share)
- WhatsApp Business API integration (optional)
- Payment reminder messages
- Invoice viewed notification
- Template messages for common scenarios

**SMS Notifications (Optional):**
- Payment reminders
- Invoice sent alerts
- Integration with UAE SMS providers

### 5.3 Customer Portal
- **Public Invoice View:** Customers view invoices via secure link
- **Online Payment:** Pay directly from portal
- **Invoice History:** Customer sees all their invoices
- **Download PDFs:** Self-service document access
- **Partial Payment:** Customer chooses amount to pay
- **Payment Plans:** View and pay scheduled installments
- **Dispute/Query:** Submit questions about invoices

### 5.4 Third-Party Integrations (Future-Ready)
- Accounting software webhooks (QuickBooks, Xero)
- Banking API integration points
- CRM integration connectors
- Public REST API with API keys
- Webhooks for external systems

---

## Phase 6: Dashboard & Analytics (Week 11)

### 6.1 Executive Dashboard
- Revenue overview (daily/weekly/monthly)
- Outstanding receivables summary (what customers owe you)
- Outstanding payables summary (what you owe suppliers)
- Net cash position
- Payment status breakdown
- Recent activity feed
- Quick actions (create invoice, add bill, add customer)
- Profit/Loss snapshot (revenue - expenses)

### 6.2 Reports & Analytics
- Invoice aging report (receivables)
- Bill aging report (payables)
- Customer payment history
- Supplier payment history
- Revenue by customer/product
- Expenses by category/supplier
- VAT liability summary (output - input VAT)
- Cash flow projections
- Scheduled report emails (weekly/monthly auto-send)
- Export to CSV/Excel/PDF

### 6.3 Notifications
- In-app notification center
- Invoice viewed tracking (read receipts)
- Payment received alerts
- Overdue invoice reminders
- Bill due date reminders
- Low cash flow alerts

---

## Phase 7: Security & Launch (Week 12)

### 7.1 Security & Authentication
- **Two-Factor Authentication (2FA/MFA):**
  - TOTP authenticator app support (Google Authenticator, Authy)
  - SMS OTP fallback
  - Backup codes
  - Enforce 2FA for admin roles
- **Session Security:**
  - Device tracking
  - Concurrent session limits
  - Force logout on password change
- **IP Whitelisting:** Enterprise feature
- **Audit Logs:** Track all user actions

### 7.2 Marketing Website
- Homepage with value proposition
- Features showcase
- Pricing page (Freemium/Pro/Enterprise)
- About, Contact, Support pages
- Blog/Resources section (SEO)
- Legal pages (Privacy, Terms, Cookie Policy)

### 7.3 Onboarding Experience
- Guided setup wizard
- Sample data for new accounts
- Interactive feature tour
- Help documentation
- Video tutorials

### 7.4 Performance & Security
- Image optimization and lazy loading
- API rate limiting
- CORS and security headers
- Penetration testing checklist
- GDPR/data protection compliance
- Backup and disaster recovery
- SOC 2 readiness checklist

### 7.5 Enterprise Features
- SAML 2.0 / SSO integration
- Team management with granular permissions
- Custom branding per organization
- API access with rate limits
- Dedicated support SLA
- Multi-branch support (multiple TRNs)

---

## Recommended Folder Structure

```
myinvoice.ae/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth pages (login, register)
│   │   ├── (marketing)/        # Public pages
│   │   ├── (dashboard)/        # Protected app routes
│   │   │   ├── invoices/
│   │   │   ├── quotes/
│   │   │   ├── bills/          # Supplier bills (payables)
│   │   │   ├── customers/
│   │   │   ├── suppliers/
│   │   │   ├── products/
│   │   │   ├── expenses/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── (portal)/           # Customer portal (public)
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── ui/                 # Shadcn/UI components
│   │   ├── forms/              # Form components
│   │   ├── invoices/           # Invoice-specific components
│   │   ├── quotes/             # Quotation components
│   │   ├── bills/              # Supplier bill components  
│   │   ├── portal/             # Customer portal components
│   │   └── layout/             # Layout components
│   ├── lib/
│   │   ├── auth/               # Authentication logic
│   │   ├── db/                 # Database utilities
│   │   │   ├── prisma.ts       # Base Prisma client
│   │   │   └── tenant.ts       # Tenant-aware Prisma extension
│   │   ├── tenant/             # Multi-tenant utilities
│   │   │   ├── context.ts      # TenantContext provider
│   │   │   ├── middleware.ts   # Tenant validation middleware
│   │   │   └── switcher.ts     # Organization switching logic
│   │   ├── pdf/                # PDF generation
│   │   ├── email/              # Email service
│   │   ├── payments/           # Payment integrations
│   │   └── fta/                # FTA compliance utilities
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # TypeScript types
│   └── i18n/                   # Translations
├── prisma/
│   └── schema.prisma           # Database schema
├── public/
│   └── locales/                # Translation files
└── tests/
```

---

## Key Dependencies

**Core:**
- next@14
- react@18
- typescript
- tailwindcss
- prisma + @prisma/client

**UI:**
- shadcn/ui (Radix-based components)
- lucide-react (icons)
- react-hook-form + zod (forms/validation)
- @tanstack/react-table (data tables)
- recharts (charts/analytics)

**Auth:**
- next-auth@5 (beta)
- @auth/prisma-adapter

**Internationalization:**
- next-intl
- date-fns

**PDF & Documents:**
- @react-pdf/renderer OR puppeteer
- qrcode (FTA QR codes)

**Payments:**
- stripe
- (PayBy/Tabby SDKs TBD)

**Email:**
- resend OR @sendgrid/mail

---

## Relevant Files to Create

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout with providers, i18n |
| `src/app/(dashboard)/invoices/page.tsx` | Invoice list view |
| `src/app/(dashboard)/invoices/[id]/page.tsx` | Invoice detail/edit |
| `src/app/(dashboard)/invoices/new/page.tsx` | New invoice creator |
| `src/components/invoices/InvoiceEditor.tsx` | Main invoice builder component |
| `src/lib/fta/compliance.ts` | UAE FTA validation & QR generation |
| `src/lib/pdf/generator.ts` | PDF invoice generation |
| `prisma/schema.prisma` | Database models |
| `src/i18n/en.json` | English translations |
| `src/i18n/ar.json` | Arabic translations |
| `src/lib/tenant/context.ts` | React context for current tenant |
| `src/lib/db/tenant.ts` | Tenant-scoped Prisma client extension |
| `src/middleware.ts` | Tenant resolution & route protection |
| `src/app/(dashboard)/quotes/page.tsx` | Quotations list |
| `src/app/(dashboard)/bills/page.tsx` | Supplier bills list |
| `src/app/(dashboard)/bills/upload/page.tsx` | Bill upload interface |
| `src/app/(dashboard)/suppliers/page.tsx` | Supplier management |
| `src/app/(portal)/[invoiceId]/page.tsx` | Customer portal invoice view |
| `src/lib/payments/partial.ts` | Partial payment logic |
| `src/lib/auth/2fa.ts` | Two-factor authentication |

---

## Verification Steps

1. **Authentication Flow:** Register → Login → Protected route access works
2. **Invoice CRUD:** Create, edit, duplicate, void invoice operations functional
3. **VAT Calculation:** Line item VAT + totals calculate correctly (5%)
4. **PDF Generation:** Download invoice PDF with QR code, both EN and AR
5. **RTL Support:** Arabic UI renders correctly with RTL layout
6. **Payment Link:** Stripe test payment completes and updates invoice status
7. **Email Delivery:** Invoice email sends with correct PDF attachment
8. **Mobile Responsive:** Dashboard usable on tablet and mobile
9. **FTA Compliance:** Invoices contain all mandatory fields, QR validates
10. **Performance:** Lighthouse score >90 on marketing pages
11. **Tenant Isolation:** User A cannot access User B's organization data
12. **Org Switching:** User in multiple orgs can switch between them
13. **Team Invites:** Invite flow creates membership with correct role
14. **Quote to Invoice:** Quote converts to invoice with all data preserved
15. **Partial Payment:** Pay 500 on 1000 AED invoice → 500 outstanding shows
16. **Supplier Bill:** Upload PDF, create bill, schedule payments
17. **Customer Portal:** Customer views and pays invoice via public link
18. **2FA Login:** Enable 2FA, logout, login requires OTP
19. **WhatsApp Share:** Invoice share link opens WhatsApp with message
20. **Debit/Credit Notes:** Create notes linked to original invoice, VAT adjusts

---

## Decisions & Scope

### Included in MVP:
- Full sales document cycle (Quotes → Proforma → Invoice → Credit/Debit Notes)
- Customer & supplier management
- Supplier bill upload and payment plans
- Partial payments and payment tracking
- UAE FTA compliance (QR codes, mandatory fields)
- Stripe payments + Customer Portal
- Email + WhatsApp share
- Basic analytics dashboard (receivables + payables)
- 2FA/MFA security
- EN/AR language support

### Excluded from MVP (Phase 2 roadmap):
- Mobile app (React Native)
- Recurring invoices (subscriptions)
- Inventory management
- Multi-currency auto-conversion
- Advanced reporting (custom report builder)
- QuickBooks/Xero sync
- White-label solution
- OCR for bill extraction
- Time tracking
- Project-based invoicing
- Bank reconciliation

### Technical Decisions:
- **Next.js App Router** over Pages Router for better server components
- **Prisma** for type-safe database access
- **shadcn/ui** for accessible, customizable components
- **Server Actions** for mutations where appropriate
- **Neon PostgreSQL** for serverless database with branching
- **Shared DB, Shared Schema** multi-tenancy for cost efficiency (not schema-per-tenant)
- **Prisma Extensions** for automatic tenant scoping vs manual WHERE clauses
- **JWT with organizationId** for stateless tenant context vs session lookup

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| UAE Pass integration delays | Implement email/OAuth first; UAE Pass as enhancement |
| FTA requirement changes | Abstract compliance logic; monitor FTA announcements |
| Payment gateway onboarding | Start Stripe integration early; parallelize PayBy setup |
| Arabic RTL complexity | Use Tailwind logical properties from day 1 |
| Scope creep | Strict MVP definition; defer nice-to-haves |
| Cross-tenant data leak | Prisma middleware + comprehensive test suite for isolation |
| Tenant DB performance | Composite indexes on organizationId; query plan analysis |

---

## Further Considerations

1. **UAE Pass priority** — UAE Pass OAuth requires separate approval process with UAE government. Start email/Google auth first; add UAE Pass when approved. *Recommended: Phase as enhancement*

2. **PayBy vs Stripe focus** — PayBy requires UAE business license and longer onboarding. *Recommended: Launch with Stripe, add PayBy post-launch*

3. **Hosting data residency** — Some UAE businesses require data stored in UAE. Vercel uses AWS global (no UAE region yet). *Option A: Accept Vercel global / Option B: AWS Middle East (Bahrain) / Option C: Defer enterprise requirement*

---

## Next Steps

1. **Approve this plan** or request modifications
2. Initialize Next.js project with proposed structure
3. Setup database schema and authentication
4. Begin Phase 1 implementation
