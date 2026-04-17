# Contributing to myInvoice.ae

Thank you for contributing. This document covers everything you need to work on this codebase effectively.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Branch Strategy](#branch-strategy)
- [Commit Conventions](#commit-conventions)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Code Style](#code-style)
- [Architecture Conventions](#architecture-conventions)
- [Testing](#testing)
- [Environment Variables](#environment-variables)

---

## Getting Started

```bash
# 1. Clone and install
git clone https://github.com/your-org/myinvoice.ae.git
cd myinvoice.ae
pnpm install

# 2. Copy env template and fill in required values
cp .env.example .env.local

# 3. Set up the database
pnpm prisma generate
pnpm prisma migrate dev

# 4. Start development server
pnpm dev
```

**Required tools:**
- Node.js 22+
- pnpm 10+
- PostgreSQL 15+

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production. Auto-deploys to Vercel on merge. Protected. |
| `develop` | Integration branch. All feature branches merge here first. |
| `feat/<description>` | New features |
| `fix/<description>` | Bug fixes |
| `chore/<description>` | Tooling, deps, non-functional changes |
| `docs/<description>` | Documentation only |
| `hotfix/<description>` | Urgent production fixes — branch from `main` |

**Rules:**
- Never commit directly to `main` or `develop`.
- All changes go through a pull request with at least 1 reviewer.
- Rebase feature branches on `develop` before opening a PR (no merge commits).

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer: BREAKING CHANGE / closes #issue]
```

**Types:**

| Type | When to use |
|------|-------------|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither adds a feature nor fixes a bug |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `docs` | Documentation changes only |
| `chore` | Build process, tooling, dependency updates |
| `ci` | CI/CD pipeline changes |
| `style` | Formatting (no logic change) |

**Scope examples:** `invoices`, `auth`, `vat`, `billing`, `middleware`, `prisma`, `pdf`, `email`

**Examples:**
```
feat(invoices): add bulk void action
fix(vat): correct reverse charge calculation for imported services
chore(deps): upgrade stripe to v23
docs(contributing): add branch strategy
```

---

## Pull Request Guidelines

1. **Title** — must follow the commit convention format (`feat(scope): description`).
2. **Description** — explain *why*, link the relevant issue (`closes #123`).
3. **Checklist before requesting review:**
   - [ ] `pnpm lint` passes with 0 errors
   - [ ] `pnpm typecheck` passes
   - [ ] `pnpm format:check` passes
   - [ ] `pnpm build` succeeds locally
   - [ ] Self-review completed (read your own diff)
4. **PR size** — keep PRs focused. If a PR touches >10 files unrelated to a single concern, split it.
5. **Migrations** — if you add a Prisma migration, include `prisma migrate dev --name <name>` output in the PR description. Never edit existing migration files.

---

## Code Style

All formatting is handled by **Prettier** and **ESLint**. Run before committing:

```bash
pnpm format          # auto-format all files
pnpm lint:fix        # auto-fix lint issues
pnpm typecheck       # TypeScript type check
```

**Key rules (enforced by ESLint):**

- `no-console` — use `logger` from `@/lib/logger` instead of `console.log/error`.
- `@typescript-eslint/no-explicit-any` — avoid `any`. Use `unknown` and narrow types.
- `@typescript-eslint/consistent-type-imports` — use `import type` for type-only imports.
- `eqeqeq` — always use `===`, never `==`.

**Prettier settings:** 100 char line width, 2-space indent, double quotes, trailing commas.

---

## Architecture Conventions

### API Routes

Every API route must:

1. Authenticate via `resolveApiContext()` or `resolveApiContextWithPermission()`.
2. Validate inputs with a **Zod schema** before using any data.
3. Use `getTenantPrisma(orgId)` — never the base `prisma` client for org data.
4. Throw typed errors from `@/lib/errors` (never raw strings).
5. Log meaningful events with `requestLogger`.

```typescript
// ✅ Correct pattern
export async function POST(req: NextRequest) {
  const { userId, orgId } = await resolveApiContextWithPermission(req, "MEMBER");
  const body = InvoiceCreateSchema.parse(await req.json());
  const db = getTenantPrisma(orgId);
  // ...
}
```

### Logging

Use the structured logger, not `console`:

```typescript
import { logger, requestLogger } from "@/lib/logger";

// In API routes (includes requestId, IP)
const log = requestLogger(req, "invoices");
log.info({ invoiceId }, "Invoice created");
log.error({ err, userId }, "Invoice creation failed");

// In services / utilities
logger.warn({ orgId }, "Plan limit reached");
```

### Error Handling

Throw the appropriate typed error class from `@/lib/errors`:

```typescript
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";

throw new NotFoundError("Invoice not found");
throw new ForbiddenError("Insufficient permissions");
throw new ValidationError("TRN must be 15 digits");
```

### Database

- Use `getTenantPrisma(orgId)` in all API routes that access org-scoped data.
- Use the base `prisma` client only for auth-related lookups (User, Account) and cross-org operations.
- Never put raw SQL in route handlers — use Prisma query API or a service function.
- All new models must include `organizationId`, `createdAt`, `updatedAt`, and `deletedAt` (for soft deletes) unless there is a clear reason not to.

### Component Structure

- **Server Components** by default. Add `"use client"` only when you need browser APIs or React hooks.
- **No direct `fetch()` in components** — use SWR hooks. API calls belong in hooks, not inline in JSX.
- **No modal state in list pages** — extract modals with their own state to separate components.
- Page components should be <200 lines. Extract sub-components when they grow.

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components | kebab-case | `invoice-list.tsx` |
| Hooks | `use-` prefix | `use-invoice-list.ts` |
| API routes | `route.ts` | `src/app/api/invoices/route.ts` |
| Services | kebab-case | `src/lib/services/vat.ts` |
| Validation schemas | kebab-case | `src/lib/validations/invoice.ts` |

---

## Testing

> **Note:** The test suite is being set up as part of Phase 1. This section describes the target state.

**Framework:** Vitest (unit/integration) + Playwright (E2E)

```bash
pnpm test          # run all tests
pnpm test:unit     # unit tests only
pnpm test:e2e      # Playwright E2E tests
pnpm test:coverage # coverage report
```

**What to test:**
- Business logic in `src/lib/services/` — 100% coverage expected.
- RBAC rules in `src/lib/rbac.ts`.
- API routes — test happy path + auth failure + validation failure.
- Critical user flows in E2E: login, create invoice, record payment.

**What not to test:**
- UI rendering (snapshot tests are brittle and slow).
- Prisma generated code.
- Third-party library internals.

---

## Environment Variables

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local` or `.env`.

Required for full local functionality:

| Variable | How to get |
|----------|-----------|
| `DATABASE_URL` | Local PostgreSQL connection string |
| `AUTH_SECRET` | Run `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | Same value as AUTH_SECRET |
| `STRIPE_SECRET_KEY` | [Stripe test key](https://dashboard.stripe.com/test/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Run `stripe listen --forward-to localhost:3000/api/stripe/webhooks` |

Optional (falls back gracefully when absent):

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — rate limiting falls back to in-memory
- `SENTRY_DSN` — error monitoring
- `RESEND_API_KEY` — emails fall back to Nodemailer/console in dev
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — file storage falls back to base64 in dev

---

## Questions?

Open a [GitHub Discussion](../../discussions) or ping the engineering channel in Slack.
