import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { ProtocolStatusBadge } from "@/components/protocols/protocol-status-badge";
import type { ProtocolStatus } from "@/types/db";

interface ProtocolWithCustomer {
  id: string;
  protocol_code: string;
  status: ProtocolStatus;
  customer_name: string;
}

const SECTIONS: { statuses: ProtocolStatus[]; icon: string; title: string }[] = [
  { statuses: ["PENDING_INSTALL"], icon: "🔴", title: "CHỜ LẮP ĐẶT" },
  { statuses: ["INSTALLING", "PENDING_CONFIRMATION"], icon: "🟡", title: "ĐANG XỬ LÝ" },
  { statuses: ["HANDED_OVER", "WARRANTY_ACTIVATED", "COMPLETED"], icon: "🟢", title: "ĐÃ BÀN GIAO" },
];

export default async function MyProtocolsPage() {
  const session = await getSession();
  const db = getDb();

  const { results: protocols } = await db
    .prepare(
      `SELECT p.id, p.protocol_code, p.status, c.name as customer_name
       FROM handover_protocols p
       JOIN customers c ON c.id = p.customer_id
       WHERE p.technician_id = ?
       ORDER BY p.created_at DESC`
    )
    .bind(session!.user.id)
    .all<ProtocolWithCustomer>();

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="text-lg font-bold text-stone-900">📋 Biên bản của tôi</div>

      {SECTIONS.map((section) => {
        const items = protocols.filter((p) => section.statuses.includes(p.status));
        return (
          <div key={section.title} className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-stone-700">
              {section.icon} {section.title} ({items.length})
            </div>
            {items.length === 0 && (
              <div className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400">
                Không có biên bản nào
              </div>
            )}
            {items.map((p) => (
              <Link key={p.id} href={`/my-protocols/${p.id}`}>
                <Card className="active:scale-[0.99] transition-transform">
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-semibold">{p.protocol_code}</div>
                      <div className="text-sm text-stone-600">{p.customer_name}</div>
                    </div>
                    <ProtocolStatusBadge status={p.status} />
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
