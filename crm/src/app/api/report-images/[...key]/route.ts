import { NextResponse } from "next/server";
import { getReportsBucket } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

/**
 * Fallback proxy for report images when no public R2.dev / custom domain
 * is configured (R2_PUBLIC_BASE_URL unset). Requires a logged-in session —
 * these are internal packing-report photos, not public assets.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/report-images/[...key]">) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const { key } = await ctx.params;
    const objectKey = key.join("/");

    const bucket = getReportsBucket();
    const object = await bucket.get(objectKey);
    if (!object) throw new NotFoundError("Không tìm thấy ảnh");

    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
