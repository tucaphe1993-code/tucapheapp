// Minimal ambient types for the Cloudflare bindings this app actually uses
// (D1 + R2). Deliberately NOT importing the full `@cloudflare/workers-types`
// package globally — it redefines `fetch`/`Request`/`Response` for the
// workerd runtime, which conflicts with the DOM lib types needed by client
// components in the same tsconfig program (e.g. `Response.json()` becomes
// `Promise<unknown>` everywhere, including in the browser). Only the
// handful of D1/R2 members this codebase calls are declared here.
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes: number; duration: number; last_row_id: number; rows_read: number; rows_written: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface R2HTTPMetadata {
  contentType?: string;
}

interface R2Object {
  body: ReadableStream;
  httpMetadata?: R2HTTPMetadata;
}

interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: R2HTTPMetadata }
  ): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}

// Cloudflare bindings + secrets available to the Worker at runtime.
// Kept hand-written (instead of `wrangler types`) so it stays in the repo
// without requiring a live `wrangler login` to regenerate.
interface CloudflareEnv {
  DB: D1Database;
  REPORTS_BUCKET: R2Bucket;

  APP_ENV: string;
  APP_NAME: string;

  // Public base URL used to build R2 image links (e.g. https://r2-assets.tucaphe.vn
  // or the R2.dev public bucket URL). Set as a Cloudflare secret/var.
  R2_PUBLIC_BASE_URL?: string;

  // One-time bootstrap token used only by /api/setup/admin to create the
  // first ADMIN account. Set via `wrangler secret put ADMIN_SETUP_TOKEN`,
  // never committed, and should be rotated/removed after first use.
  ADMIN_SETUP_TOKEN?: string;

  // Lark (Feishu) group custom-bot webhook for task-assignment pings.
  // Optional: notifications degrade to IN_APP-only when unset.
  // Set via `wrangler secret put LARK_WEBHOOK_URL` (and LARK_SECRET if the
  // bot has "Signature Verification" enabled in Lark).
  LARK_WEBHOOK_URL?: string;
  LARK_SECRET?: string;
}
