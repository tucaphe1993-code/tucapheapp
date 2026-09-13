/**
 * Client-side (Canvas API) watermark engine — runs entirely in the
 * employee's browser before the photo ever leaves the device. The result
 * is stored as a base64 data URL directly in D1 (R2 isn't enabled for
 * this deployment — same reasoning as protocol e-signatures), so the
 * image is also downscaled here to keep each row well within D1's
 * per-value size limits. Kept as a small, swappable module (single
 * `applyWatermark` entry point + a `WatermarkOptions` shape) so the
 * layout/branding can be adjusted later without touching call sites.
 */

// Report photos are proof-of-packing snapshots, not prints — capping the
// longest edge keeps the watermarked JPEG comfortably small (well under
// MAX_REPORT_IMAGE_BYTES in the upload route) without visible quality loss
// on a phone screen.
const MAX_DIMENSION = 1440;

export interface WatermarkOptions {
  brand?: string;
  orderCode: string;
  employeeName: string;
  date?: Date;
}

function formatVnDateTime(d: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export async function applyWatermark(
  file: File,
  options: WatermarkOptions
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas không khả dụng trên trình duyệt này");

  ctx.drawImage(bitmap, 0, 0, width, height);

  const lines = [
    options.brand ?? "TÚ CÀ PHÊ",
    options.orderCode,
    formatVnDateTime(options.date ?? new Date()),
    options.employeeName,
  ];

  const padding = Math.max(12, Math.round(canvas.width * 0.015));
  const fontSize = Math.max(14, Math.round(canvas.width * 0.028));
  // Vietnamese diacritics (ệ, ữ, ố...) stack taller/deeper than plain
  // Latin glyphs, so this needs more headroom than a typical 1.2-1.35
  // line-height or descenders/accents from one line bleed into the next.
  const lineHeight = fontSize * 1.7;

  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";

  const boxHeight = lines.length * lineHeight + padding * 1.5;
  const boxY = canvas.height - boxHeight;

  const gradient = ctx.createLinearGradient(0, boxY, 0, canvas.height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, boxY, canvas.width, boxHeight);

  lines.forEach((line, idx) => {
    const y = canvas.height - padding - (lines.length - 1 - idx) * lineHeight;
    ctx.font = idx === 0 ? `700 ${fontSize * 1.1}px sans-serif` : `500 ${fontSize}px sans-serif`;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(line, padding + 1, y + 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line, padding, y);
  });

  return canvas.toDataURL("image/jpeg", 0.82);
}
