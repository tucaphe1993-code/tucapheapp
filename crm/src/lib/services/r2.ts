import { getReportsBucket } from "@/lib/db/client";
import { getEnv } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { ValidationError } from "@/lib/api/errors";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — watermarked JPEG/WebP photos only

export async function uploadReportImage(params: {
  orderId: string;
  taskId: string;
  bytes: ArrayBuffer;
  contentType: string;
}): Promise<{ key: string; url: string }> {
  const ext = ALLOWED_MIME[params.contentType];
  if (!ext) {
    throw new ValidationError("Định dạng ảnh không hợp lệ (chỉ nhận JPEG/PNG/WebP)");
  }
  if (params.bytes.byteLength === 0) {
    throw new ValidationError("File ảnh rỗng");
  }
  if (params.bytes.byteLength > MAX_BYTES) {
    throw new ValidationError("Ảnh vượt quá dung lượng cho phép (8MB)");
  }

  const bucket = getReportsBucket();
  const key = `reports/${params.orderId}/${params.taskId}/${newId()}.${ext}`;
  await bucket.put(key, params.bytes, {
    httpMetadata: { contentType: params.contentType },
  });

  const env = getEnv();
  const url = env.R2_PUBLIC_BASE_URL
    ? `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
    : `/api/report-images/${key}`;

  return { key, url };
}
