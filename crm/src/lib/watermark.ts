/**
 * Client-side (Canvas API) watermark engine — runs entirely in the
 * employee's browser before the photo ever leaves the device, so only
 * watermarked images reach R2 (spec §14). Kept as a small, swappable
 * module (single `applyWatermark` entry point + a `WatermarkOptions`
 * shape) so the layout/branding can be adjusted later without touching
 * call sites.
 */

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
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas không khả dụng trên trình duyệt này");

  ctx.drawImage(bitmap, 0, 0);

  const lines = [
    options.brand ?? "TÚ CÀ PHÊ",
    options.orderCode,
    formatVnDateTime(options.date ?? new Date()),
    options.employeeName,
  ];

  const padding = Math.max(12, Math.round(canvas.width * 0.015));
  const fontSize = Math.max(14, Math.round(canvas.width * 0.028));
  const lineHeight = fontSize * 135 / 1000;

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

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không thể xử lý watermark"))),
      "image/jpeg",
      0.9
    );
  });
}
