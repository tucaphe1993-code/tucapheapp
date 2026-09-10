import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { InstallationStatusBadge } from "@/components/installations/installation-status-badge";
import { formatDateTime } from "@/lib/utils";
import type { InstallationStatus } from "@/types/db";

interface InstallationWithCustomer {
  id: string;
  equipment: string;
  scheduled_at: string | null;
  status: InstallationStatus;
  customer_name: string;
}

const SECTIONS: { statuses: InstallationStatus[]; icon: string; title: string }[] = [
  { statuses: ["PENDING", "SCHEDULED"], icon: "🔴", title: "CHỜ LẮP ĐẶT" },
  { statuses: ["IN_PROGRESS"], icon: "🟡", title: "ĐANG LẮP" },
  { statuses: ["COMPLETED", "HANDED_OVER"], icon: "🟢", title: "HOÀN THÀNH" },
];

export default async function MyInstallationsPage() {
  const session = await getSession();
  const db = getDb();

  const { results: installations } = await db
    .prepare(
      `SELECT i.id, i.equipment, i.scheduled_at, i.status, c.name as customer_name
       FROM installations i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.technician_id = ? AND i.status != 'CANCELLED'
       ORDER BY i.created_at DESC`
    )
    .bind(session!.user.id)
    .all<InstallationWithCustomer>();

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <div className="text-lg font-bold text-stone-900">🔧 Lắp đặt của tôi</div>
      </div>

      {SECTIONS.map((section) => {
        const items = installations.filter((i) => section.statuses.includes(i.status));
        return (
          <div key={section.title} className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-stone-700">
              {section.icon} {section.title} ({items.length})
            </div>
            {items.length === 0 && (
              <div className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400">
                Không có job nào
              </div>
            )}
            {items.map((i) => (
              <Link key={i.id} href={`/my-installations/${i.id}`}>
                <Card className="active:scale-[0.99] transition-transform">
                  <CardContent className="py-3">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="font-semibold">{i.equipment}</div>
                      <InstallationStatusBadge status={i.status} />
                    </div>
                    <div className="text-sm text-stone-600">Khách hàng: {i.customer_name}</div>
                    {i.scheduled_at && (
                      <div className="mt-1 text-xs text-stone-400">Ngày lắp: {formatDateTime(i.scheduled_at)}</div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
