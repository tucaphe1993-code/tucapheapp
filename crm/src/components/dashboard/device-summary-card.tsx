import Link from "next/link";
import { DEVICE_STATUS_LABEL } from "@/lib/services/devices";
import type { DeviceStatus } from "@/types/db";

const ROWS: DeviceStatus[] = [
  "IN_STOCK",
  "SOLD",
  "AWAITING_INSTALL",
  "INSTALLING",
  "IN_USE",
  "UNDER_WARRANTY",
  "IN_REPAIR",
];

export function DeviceSummaryCard({ counts }: { counts: Partial<Record<DeviceStatus, number>> }) {
  const total = ROWS.reduce((s, status) => s + (counts[status] ?? 0), 0);

  if (total === 0) {
    return <div className="py-6 text-center text-sm text-stone-400">Chưa có thiết bị nào</div>;
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      {ROWS.map((status) => (
        <Link
          key={status}
          href={`/devices?status=${status}`}
          className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-stone-50"
        >
          <span className="text-stone-500">{DEVICE_STATUS_LABEL[status]}</span>
          <span className="font-semibold text-stone-900">{counts[status] ?? 0}</span>
        </Link>
      ))}
    </div>
  );
}
