import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Real D1 binding for the current request. Throws loudly instead of
 * silently falling back to any in-memory/mock store — this app has no
 * mock data path for production business logic.
 */
export function getDb(): D1Database {
  const { env } = getCloudflareContext();
  if (!env.DB) {
    throw new Error(
      "D1 binding 'DB' is not available. Run via `wrangler dev` / deployed Worker, not plain `next start`."
    );
  }
  return env.DB;
}

export function getReportsBucket(): R2Bucket {
  const { env } = getCloudflareContext();
  if (!env.REPORTS_BUCKET) {
    throw new Error("R2 binding 'REPORTS_BUCKET' is not available.");
  }
  return env.REPORTS_BUCKET;
}

export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}
