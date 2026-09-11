import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { ProtocolStatusBadge } from "@/components/protocols/protocol-status-badge";
import { formatDate } from "@/lib/utils";
import type { ProtocolStatus } from "@/types/db";

interface ProtocolRowJoined {
  id: string;
  protocol_code: string;
  status: ProtocolStatus;
  created_at: string;
  order_code: string;
  customer_name: string;
}

export default async function ProtocolsPage({ searchParams }: PageProps<"/protocols">) {
  const { q } = await searchParams;
  const db = getDb();

  const stmt = q
    ? db
        .prepare(
          `SELECT DISTINCT p.id, p.protocol_code, p.status, p.created_at, o.order_code, c.name as customer_name
           FROM handover_protocols p
           JOIN orders o ON o.id = p.order_id
           JOIN customers c ON c.id = p.customer_id
           LEFT JOIN handover_protocol_devices d ON d.protocol_id = p.id
           WHERE p.protocol_code LIKE ? OR o.order_code LIKE ? OR c.name LIKE ? OR d.serial_number LIKE ?
           ORDER BY p.created_at DESC`
        )
        .bind(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
    : db.prepare(
        `SELECT p.id, p.protocol_code, p.status, p.created_at, o.order_code, c.name as customer_name
         FROM handover_protocols p
         JOIN orders o ON o.id = p.order_id
         JOIN customers c ON c.id = p.customer_id
         ORDER BY p.created_at DESC LIMIT 300`
      );
  const { results: protocols } = await stmt.all<ProtocolRowJoined>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Biên bản lắp đặt</h1>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Tìm theo khách hàng, mã đơn, Serial, số biên bản..."
          className="flex h-10 w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
        />
      </form>

      <div className="flex flex-col gap-2">
        {protocols.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-stone-500">Không có biên bản</CardContent>
          </Card>
        )}
        {protocols.map((p) => (
          <Link key={p.id} href={`/protocols/${p.id}`}>
            <Card className="hover:border-amber-300">
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{p.protocol_code}</div>
                  <div className="text-sm text-stone-500">
                    {p.customer_name} · Đơn {p.order_code} · {formatDate(p.created_at)}
                  </div>
                </div>
                <ProtocolStatusBadge status={p.status} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
