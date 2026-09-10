import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";

/** Fixed installation checklist (spec: LẮP ĐẶT). */
export function buildInstallationChecklistLabels(): { label: string; required: boolean }[] {
  return [
    { label: "Kiểm tra điện", required: true },
    { label: "Kiểm tra nước", required: true },
    { label: "Lắp máy", required: true },
    { label: "Test vận hành", required: true },
    { label: "Cài đặt", required: true },
    { label: "Hướng dẫn khách", required: true },
    { label: "Chụp ảnh bàn giao", required: true },
  ];
}

export async function createChecklistForInstallation(installationId: string) {
  const db = getDb();
  const labels = buildInstallationChecklistLabels();
  await db.batch(
    labels.map((l, idx) =>
      db
        .prepare(
          `INSERT INTO installation_checklists (id, installation_id, label, is_required, sort_order) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(newId(), installationId, l.label, l.required ? 1 : 0, idx)
    )
  );
}
