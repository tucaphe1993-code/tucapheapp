# Deploy — Tú Cà Phê CRM

This app is fully built and passes `lint` / `typecheck` / `build` / `test`,
and has been smoke-tested end-to-end against a **real local D1 database**
(migrations + seed + login + full order→pack→ship flow — see below). It has
**not** been deployed to a live Cloudflare account from this session, because
that requires credentials (a Cloudflare account + `wrangler login`, or an
API token) this session does not have. Below is exactly what is done, what
is left, and the exact commands to finish.

## What's already done

- [x] Full D1 schema + versioned migrations (`migrations/001..003`)
- [x] Auth (PBKDF2 password hashing, server-side sessions, RBAC)
- [x] Customers, Products/Variants/SKU, Orders, Tasks, Checklist, Reports,
      R2 image upload + client-side watermark, Inventory (with
      double-issue and negative-stock guards), Dashboard, Notifications,
      Audit log
- [x] PWA manifest + service worker (app-shell only, no sensitive caching)
- [x] `npm run lint` / `npm run typecheck` / `npm run build` all pass
- [x] `npm test` — 22 automated tests covering login/password hashing,
      SKU/order-code generation, checklist generation, and — most
      importantly — inventory issue idempotency, double-submit
      protection, insufficient-stock rejection, and adjustment guards
- [x] `opennextjs-cloudflare build` succeeds — produces a real
      `.open-next/worker.js` ready to deploy
- [x] Verified locally end-to-end against **real D1** (via `wrangler dev
      --local`, i.e. the actual Workers runtime, not a mock): login with
      hashed passwords, RBAC (employee blocked from admin actions, cost
      price hidden from employees, cross-employee task access blocked),
      create order → assign task → start packing → checklist gating →
      complete → ship → inventory decremented correctly → shipping twice
      rejected → audit log populated for every step

## What's left (needs your Cloudflare account)

### 1. Prerequisites

```bash
cd crm
npm install
npx wrangler login   # opens a browser to authorize this machine
```

### 2. Create the D1 database

```bash
npx wrangler d1 create tucaphe-crm-db
```

Copy the `database_id` it prints into `wrangler.jsonc` →
`d1_databases[0].database_id` (currently `REPLACE_WITH_REAL_D1_DATABASE_ID`).

This is a **separate database** from the existing `tucaphe-db` used by the
customer-facing order site at `order.tucaphe.vn` — the two apps are
intentionally isolated (different users, different data).

### 3. Create the R2 bucket

```bash
npx wrangler r2 bucket create tucaphe-crm-reports
```

Optional but recommended: enable public access (or bind a custom domain to
the bucket) so report photos load without going through the app's proxy
route, then set `R2_PUBLIC_BASE_URL` (step 5) to that URL. If you skip
this, images still work — they're served through
`/api/report-images/[...key]`, just with one extra hop.

### 4. Run migrations against the real (remote) database

```bash
npm run db:migrate:remote
```

This applies `migrations/001_initial_schema.sql`,
`002_indexes.sql`, `003_audit_logs.sql` — in order, tracked by Wrangler so
re-running is safe (already-applied migrations are skipped). **Do not**
hand-edit an already-applied migration file; add a new
`004_*.sql` instead.

### 5. Set secrets

```bash
npx wrangler secret put ADMIN_SETUP_TOKEN
# paste a long random value when prompted, e.g. `openssl rand -hex 32`
```

If you enabled public R2 access in step 3, also add the URL to
`wrangler.jsonc` → `vars.R2_PUBLIC_BASE_URL` (not secret, just a URL).

### 6. Deploy

```bash
npm run cf:deploy
```

This runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`,
which builds the Next.js app, bundles it for Workers, and pushes it live.
Wrangler will print the `*.workers.dev` URL it deployed to.

### 7. Create the first ADMIN account

The app has **no hard-coded password** anywhere in source (spec §32). Once
deployed, create the first admin via the one-time bootstrap endpoint:

```bash
curl -X POST https://<your-worker>.workers.dev/api/setup/admin \
  -H "Authorization: Bearer <the ADMIN_SETUP_TOKEN you set in step 5>" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tucaphe.vn","password":"<a strong password>","fullName":"Quản trị viên"}'
```

This endpoint refuses to run a second time once any ADMIN exists — it
cannot be used to mint extra admins later. Create additional employee/admin
accounts afterward from the app itself (Nhân viên → Thêm tài khoản), while
logged in as this first admin.

### 8. Point `crm.tucaphe.vn` at the Worker

In `wrangler.jsonc`, uncomment:

```jsonc
"routes": [
  { "pattern": "crm.tucaphe.vn/*", "zone_name": "tucaphe.vn" }
],
```

This requires the `tucaphe.vn` zone to already be on Cloudflare (it already
is, per the existing `order.tucaphe.vn` Worker route in the repo root
`wrangler.toml`). Then in the Cloudflare dashboard (or via `wrangler`), add
the DNS record for the new subdomain:

| Type  | Name | Content                          | Proxy status      |
| ----- | ---- | --------------------------------- | ------------------ |
| CNAME | crm  | `<your-worker>.workers.dev` (or any placeholder — Worker routes override it) | Proxied (orange cloud) |

Then redeploy (`npm run cf:deploy`) so the route takes effect. This
session does **not** modify DNS or the domain registrar — you'll need to
add that record yourself in the Cloudflare dashboard for `tucaphe.vn`.

### 9. Seed data — production vs. development

**Do not** run `npm run db:seed:local` (or its underlying SQL) against the
remote/production database — it inserts sample customers/orders/test
accounts and is explicitly development-only (spec §33). Production starts
empty; the first admin (step 7) creates real products, customers, and
employee accounts through the app itself.

## Local development

```bash
cd crm
npm install
npm run db:migrate:local   # applies migrations to a local simulated D1
npm run db:seed:local      # dev-only sample data + prints test logins
cp .dev.vars.example .dev.vars   # fill in ADMIN_SETUP_TOKEN for local use
npm run dev                 # next dev, with live D1/R2 bindings via
                             # initOpenNextCloudflareForDev()
```

Or to run against the actual Workers runtime locally (closer to
production):

```bash
npx opennextjs-cloudflare build
npx wrangler dev --local
```

Dev seed logins (printed by `npm run db:seed:local`, also here for
reference — **dev database only, not production**):

- ADMIN: `admin@tucaphe.vn` / `Admin@123456`
- EMPLOYEE: `nam@tucaphe.vn` / `Employee@123456`
- EMPLOYEE: `lan@tucaphe.vn` / `Employee@123456`

## Notes / known limitations to revisit

- **PWA icons** (`public/icons/*.png`) are programmatically generated
  placeholders (solid brand color + circle), not real artwork — swap them
  for a designed logo before shipping to real users.
- **Node.js middleware on Cloudflare** (`src/proxy.ts`) is flagged
  "experimental" by `@opennextjs/cloudflare` as of this build. It works
  (verified locally), but keep an eye on opennextjs-cloudflare release
  notes when upgrading.
- **Web Push / Email / Zalo notifications**: the notification service
  (`src/lib/services/notifications.ts`) is deliberately built as a small
  abstraction with only the in-app channel implemented, per spec §21
  ("Không cần tích hợp Zalo ở phiên bản này"). Adding a channel later
  means implementing one function, not restructuring call sites.
- **compatibility_date** in `wrangler.jsonc` should be bumped periodically
  — Wrangler warned during build that a more recent date is available.
