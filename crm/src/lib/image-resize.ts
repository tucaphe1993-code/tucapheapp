/**
 * Nén/thu nhỏ ảnh phía trình duyệt (Canvas API) trước khi gửi lên server —
 * dùng cho ảnh sản phẩm (không cần watermark như ảnh báo cáo đóng gói).
 * Lưu thẳng base64 data URL vào D1 (R2 chưa bật cho deployment này, cùng
 * lý do đã áp dụng cho report_images/watermark.ts) nên phải nén đủ nhỏ.
 */
const MAX_DIMENSION = 1024;

export async function resizeImageToDataUrl(file: File): Promise<string> {
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

  return canvas.toDataURL("image/jpeg", 0.8);
}
