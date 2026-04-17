# myInvoice.ae — Local Development Setup

This guide covers setting up a complete local development environment with PostgreSQL 18 and Redis.

## Prerequisites

- Node.js 22+ (from https://nodejs.org/)
- pnpm 10.33.0+ (install: `npm install -g pnpm`)
- Docker & Docker Compose (from https://docker.com/products/docker-desktop)
- Git

## Quick Start (5 minutes)

### 1. Clone & Install

```bash
git clone <repo-url>
cd myinvoice-ae
pnpm install
```

### 2. Start Services

```bash
# Start PostgreSQL 18 + Redis in Docker (background)
docker-compose up -d

# Verify services are running:
# - PostgreSQL: port 5432
# - Redis: port 6379
docker-compose ps
```

### 3. Setup Database

```bash
# Create .env.local from template (only needed first time)
cp .env.example .env.local

# Run Prisma migrations (creates schema + seed data)
pnpm prisma migrate dev

# Seed the database (optional — creates sample data)
pnpm db:seed
```

### 4. Start Development Server

```bash
pnpm dev
# Opens: http://localhost:3000
```

### 5. Stop Services (when done)

```bash
docker-compose down
```

---

## Detailed Setup

### Environment Variables (.env.local)

Copy `.env.example` and update with real values:

```bash
cp .env.example .env.local
```

**Minimal setup** (for local dev, pre-filled defaults):

```env
# Database (docker-compose provides these)
DATABASE_URL="postgresql://myinvoice:password@localhost:5432/myinvoice_dev?sslmode=disable"
DIRECT_URL="postgresql://myinvoice:password@localhost:5432/myinvoice_dev?sslmode=disable"

# Redis (docker-compose provides this)
REDIS_URL="redis://localhost:6379"

# Auth
AUTH_SECRET="dev-secret-32-character-minimum-ok"
NEXTAUTH_SECRET="dev-secret-32-character-minimum-ok"
NEXTAUTH_URL="http://localhost:3000"

# Email (dev mode — logs to console)
EMAIL_DEV_FALLBACK="true"

# Stripe (optional — skip for local dev)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# All other vars can stay empty for local dev
```

### Docker Compose Services

**Start all services:**

```bash
docker-compose up -d
```

**What's running:**

| Service | Port | User | Password | DB |
|---------|------|------|----------|-----|
| PostgreSQL 18 | 5432 | myinvoice | password | myinvoice_dev |
| Redis 7 | 6379 | — | — | (none) |

**Useful commands:**

```bash
# View logs
docker-compose logs -f postgres  # Watch PostgreSQL logs
docker-compose logs -f redis     # Watch Redis logs

# Connect to PostgreSQL directly
psql postgresql://myinvoice:password@localhost:5432/myinvoice_dev

# Connect to Redis directly
redis-cli -h localhost -p 6379

# Restart a service
docker-compose restart postgres
docker-compose restart redis

# Stop all services
docker-compose stop

# Destroy containers & volumes (⚠️ deletes all data)
docker-compose down -v
```

### Prisma Database Management

```bash
# Create a new migration (after schema changes)
pnpm prisma migrate dev --name description_of_change

# Run migrations without creating new one
pnpm prisma db push

# Reset database (⚠️ deletes all data)
pnpm prisma migrate reset

# Seed the database
pnpm db:seed

# Open Prisma Studio (visual DB editor)
pnpm prisma studio
```

---

## Development Workflow

### Code Quality

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Auto-fix lint issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting without modifying
pnpm format:check
```

### Building & Running

```bash
# Build for production
pnpm build

# Start production build locally
pnpm start

# Development server with hot-reload
pnpm dev
```

### Database Schema Changes

1. **Modify** `prisma/schema.prisma`
2. **Create migration:**
   ```bash
   pnpm prisma migrate dev --name add_new_field
   ```
3. **Push to database:**
   ```bash
   pnpm prisma db push
   ```
4. **Update types:**
   ```bash
   pnpm prisma generate
   ```

---

## Troubleshooting

### PostgreSQL Connection Issues

**Error: `connect ECONNREFUSED 127.0.0.1:5432`**

- Postgres container is not running. Start with: `docker-compose up -d postgres`
- Check status: `docker-compose ps postgres`
- View logs: `docker-compose logs postgres`

### Redis Connection Issues

**Error: `ECONNREFUSED 127.0.0.1:6379`**

- Redis container is not running. Start with: `docker-compose up -d redis`
- Rate limiting will fall back to in-memory mode (warning logged)
- For production, ensure Redis is always available

### Prisma Migration Issues

**Error: `no such table`**

- Run migrations: `pnpm prisma migrate dev`
- If stuck, reset: `pnpm prisma migrate reset` (⚠️ deletes data)

**Error: `database URL is invalid`**

- Check `DATABASE_URL` and `DIRECT_URL` in `.env.local`
- Verify PostgreSQL container is running: `docker-compose ps postgres`

### Node Modules Issues

**Error: `cannot find module` after git pull**

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## Advanced Configuration

### Using Remote PostgreSQL (Cloud Database)

If using Supabase, Neon, or AWS RDS instead of local Docker:

```env
DATABASE_URL="postgresql://user:password@host.region.rds.amazonaws.com:5432/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@host.region.rds.amazonaws.com:5432/dbname?sslmode=require"
```

Note: Use a non-pooled connection for `DIRECT_URL` to run migrations safely.

### Using Remote Redis (Cloud Database)

If using AWS ElastiCache, DigitalOcean Redis, or Upstash:

```env
# AWS ElastiCache
REDIS_URL="redis://HOST.cache.amazonaws.com:6379"

# DigitalOcean Managed Redis
REDIS_URL="redis://default:PASSWORD@HOST:PORT"

# With password auth
REDIS_URL="redis://:YOUR_PASSWORD@localhost:6379"
```

### Environment-Specific Configuration

**Production mode:**

```bash
NODE_ENV=production pnpm build && pnpm start
```

**Test mode:**

```bash
NODE_ENV=test pnpm test
```

---

## Performance Tips

### Database Queries

- Use Prisma Studio to visualize queries: `pnpm prisma studio`
- Enable slow query logging in PostgreSQL:
  ```sql
  SET log_min_duration_statement = 500;  -- Log queries > 500ms
  ```

### Caching

- Redis is automatically used for rate limiting
- Add custom Redis caching in API routes as needed

### Development Build

- Keep `pnpm dev` running in one terminal
- Run linting in another: `pnpm lint --watch`

---

## Deployment Notes

When deploying to production:

1. **PostgreSQL**: Use Supabase, Neon, or AWS RDS
2. **Redis**: Use AWS ElastiCache, DigitalOcean, or self-hosted Redis cluster
3. **Environment Variables**: Set all secrets in deployment platform (Vercel, Railway, etc.)
4. **Migrations**: Run `pnpm prisma migrate deploy` before each release

---

## Need Help?

- Check logs: `docker-compose logs`
- Reset everything: `docker-compose down -v && docker-compose up -d && pnpm prisma migrate dev`
- View database: `pnpm prisma studio`

