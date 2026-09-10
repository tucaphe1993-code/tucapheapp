import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import type { OrderItemRow } from "@/types/db";

/** Packing checklist (spec §12). Fixed for every task, regardless of line items. */
export function buildChecklistLabels(_items: OrderItemRow[]): { label: string; required: boolean }[] {
  return [
    { label: "Đủ số lượng", required: true },
    { label: "Đã ghi tên khách hàng đầy đủ", required: true },
  ];
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
