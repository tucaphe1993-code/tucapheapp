import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { DeviceStatusBadge } from "@/components/devices/device-status-badge";
import { QuickSaleDialog } from "@/components/devices/quick-sale-dialog";
import { DEVICE_STATUS_LABEL } from "@/lib/services/devices";
import { formatDate } from "@/lib/utils";
import type { DeviceStatus } from "@/types/db";

interface DeviceRowJoined {
  id: string;
  serial_number: string;
  status: DeviceStatus;
  product_name: string;
  sku: string;
  customer_name: string | null;
  sold_at: string | null;
}

export default async function DevicesPage({ searchParams }: PageProps<"/devices">) {
  const { status, variantId, q } = await searchParams;
  const db = getDb();

  const conditions: string[] = [];
  const binds: unknown[] = [];
  if (status) {
    conditions.push("d.status = ?");
    binds.push(status);
  }
  if (variantId) {
    conditions.push("d.product_variant_id = ?");
    binds.push(variantId);
  }
  if (q) {
    conditions.push("d.serial_number LIKE ?");
    binds.push(`%${q}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { results: devices } = await db
    .prepare(
      `SELECT d.id, d.serial_number, d.status, d.sold_at, pv.sku, p.name as product_name, c.name as customer_name
       FROM devices d
       JOIN product_variants pv ON pv.id = d.product_variant_id
       JOIN products p ON p.id = d.product_id
       LEFT JOIN customers c ON c.id = d.customer_id
       ${where}
       ORDER BY d.created_at DESC LIMIT 300`
    )
    .bind(...binds)
    .all<DeviceRowJoined>();

  const tabs: { label: string; value: DeviceStatus | "" }[] = [
    { label: "Tất cả", value: "" },
    ...(Object.entries(DEVICE_STATUS_LABEL) as [DeviceStatus, string][]).map(([value, label]) => ({
      label,
      value,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Thiết bị / Serial</h1>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Tìm theo Serial..."
          className="flex h-10 w-full max-w-xs rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
        />
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/devices?status=${t.value}` : "/devices"}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              (status ?? "") === t.value ? "bg-amber-800 text-white" : "bg-white text-stone-600 border border-stone-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {devices.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-stone-500">Không có thiết bị</CardContent>
          </Card>
        )}
        {devices.map((d) => (
          <Card key={d.id} className="hover:border-amber-300">
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <Link href={`/devices/${d.id}`} className="min-w-0 flex-1">
                <div className="font-mono font-medium">{d.serial_number}</div>
                <div className="truncate text-sm text-stone-500">
                  {d.product_name} ({d.sku})
                  {d.customer_name ? ` · ${d.customer_name}` : ""}
                </div>
                {d.sold_at && <div className="text-xs text-stone-400">Bán: {formatDate(d.sold_at)}</div>}
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {d.status === "IN_STOCK" && <QuickSaleDialog deviceId={d.id} serialNumber={d.serial_number} />}
                <DeviceStatusBadge status={d.status} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
