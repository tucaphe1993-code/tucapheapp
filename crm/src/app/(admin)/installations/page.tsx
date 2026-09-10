import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { InstallationStatusBadge } from "@/components/installations/installation-status-badge";
import { formatDateTime } from "@/lib/utils";
import type { InstallationStatus } from "@/types/db";

interface InstallationRowJoined {
  id: string;
  equipment: string;
  serial_number: string | null;
  scheduled_at: string | null;
  status: InstallationStatus;
  customer_name: string;
  technician_name: string | null;
}

export default async function InstallationsPage({ searchParams }: PageProps<"/installations">) {
  const { status } = await searchParams;
  const db = getDb();

  const stmt = status
    ? db
        .prepare(
          `SELECT i.id, i.equipment, i.serial_number, i.scheduled_at, i.status,
                  c.name as customer_name, u.full_name as technician_name
           FROM installations i
           JOIN customers c ON c.id = i.customer_id
           LEFT JOIN users u ON u.id = i.technician_id
           WHERE i.status = ?
           ORDER BY i.created_at DESC`
        )
        .bind(status)
    : db.prepare(
        `SELECT i.id, i.equipment, i.serial_number, i.scheduled_at, i.status,
                c.name as customer_name, u.full_name as technician_name
         FROM installations i
         JOIN customers c ON c.id = i.customer_id
         LEFT JOIN users u ON u.id = i.technician_id
         WHERE i.status != 'CANCELLED'
         ORDER BY i.created_at DESC LIMIT 300`
      );
  const { results: installations } = await stmt.all<InstallationRowJoined>();

  const tabs = [
    { label: "Tất cả", value: "" },
    { label: "Chờ lắp đặt", value: "PENDING" },
    { label: "Đã lên lịch", value: "SCHEDULED" },
    { label: "Đang lắp", value: "IN_PROGRESS" },
    { label: "Hoàn thành", value: "COMPLETED" },
    { label: "Đã bàn giao", value: "HANDED_OVER" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Lắp đặt</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/installations?status=${t.value}` : "/installations"}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              (status ?? "") === t.value
                ? "bg-amber-800 text-white"
                : "bg-white text-stone-600 border border-stone-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {installations.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-stone-500">Không có job lắp đặt</CardContent>
          </Card>
        )}
        {installations.map((i) => (
          <Link key={i.id} href={`/installations/${i.id}`}>
            <Card className="hover:border-amber-300">
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{i.equipment}</div>
                  <div className="text-sm text-stone-500">
                    {i.customer_name} · {i.technician_name ?? "Chưa phân công"}
                  </div>
                  {i.scheduled_at && (
                    <div className="text-xs text-stone-400">Ngày lắp: {formatDateTime(i.scheduled_at)}</div>
                  )}
                </div>
                <InstallationStatusBadge status={i.status} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
