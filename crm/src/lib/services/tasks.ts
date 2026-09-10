import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import type { OrderItemRow } from "@/types/db";

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

/** Packing checklist auto-generated from the order's line items (spec §12). */
export function buildChecklistLabels(items: OrderItemRow[]): { label: string; required: boolean }[] {
  const lines: { label: string; required: boolean }[] = [];
  for (const item of items) {
    const weight = item.weight_grams >= 1000 ? `${item.weight_grams / 1000}kg` : `${item.weight_grams}g`;
    lines.push({
      label: `Đúng SKU ${item.sku} — ${item.product_name}, ${FORM_LABEL[item.form]}, ${PACKAGING_LABEL[item.packaging]}, ${weight} x ${item.quantity}`,
      required: true,
    });
  }
  lines.push({ label: "Dán tem sản phẩm", required: true });
  lines.push({ label: "Kiểm tra địa chỉ giao hàng", required: true });
  return lines;
}

export async function createChecklistForTask(taskId: string, items: OrderItemRow[]) {
  const db = getDb();
  const labels = buildChecklistLabels(items);
  await db.batch(
    labels.map((l, idx) =>
      db
        .prepare(
          `INSERT INTO task_checklists (id, task_id, label, is_required, sort_order) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(newId(), taskId, l.label, l.required ? 1 : 0, idx)
    )
  );
}
