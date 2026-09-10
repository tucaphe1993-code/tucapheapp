# Tú Cà Phê CRM

Internal CRM for **CÔNG TY TNHH SX - TM - DV TÚ CÀ PHÊ** — order intake,
task assignment, packing (with checklist + photo reports), and inventory,
built mobile-first for warehouse staff and desktop-capable for managers.

Not the customer-facing site (that's the static site + Worker at the repo
root, serving `order.tucaphe.vn`) — this is a separate internal app,
intended for `crm.tucaphe.vn`.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Cloudflare Workers (via `@opennextjs/cloudflare`), Cloudflare D1 (SQLite),
  Cloudflare R2 (report photo storage)
- Session-based auth (PBKDF2-SHA256 password hashing via Web Crypto, no
  plaintext passwords, no client-exposed secrets)
- PWA (installable, mobile-first employee UI with bottom navigation)

## Business flow

ĐƠN HÀNG (order) → GIAO VIỆC (assign) → ĐÓNG GÓI (pack, with checklist +
photos) → BÁO CÁO (report) → KHO (inventory, deducted only at
ship-out, never twice — see `src/lib/services/inventory.ts`).

## Getting started

```bash
npm install
npm run db:migrate:local
npm run db:seed:local      # dev-only sample data; prints test logins
npm run dev
```

Open http://localhost:3000 and log in with one of the seeded accounts
(printed by `db:seed:local`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server (D1/R2 bindings proxied via `wrangler`) |
| `npm run build` | Production Next.js build |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest — business logic (inventory idempotency, RBAC data-shape, checklist/SKU generation, password hashing) |
| `npm run db:migrate:local` / `:remote` | Apply `migrations/*.sql` to local or the real Cloudflare D1 database |
| `npm run db:seed:local` | Regenerate + apply `seed/dev-seed.sql` (**dev only**) |
| `npm run cf:preview` / `npm run cf:deploy` | Build + preview/deploy the actual Cloudflare Worker |

## Project structure

```
migrations/        Versioned D1 schema (001, 002, 003…)
seed/               Generated dev-only seed SQL (gitignored; scripts/seed-dev.mjs regenerates it)
src/app/            Routes: (admin)/* for managers, (employee)/* for staff, api/* for the backend
src/components/     UI (shadcn-style) + feature components
src/lib/            auth, db client, services (orders/tasks/inventory/notifications/r2), watermark engine
src/types/          DB row types
test/               Vitest tests + a D1-compatible SQLite shim for testing real SQL logic
```

See `DEPLOY.md` for what's needed to actually put this on Cloudflare and
`crm.tucaphe.vn`.
