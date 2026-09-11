import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { ProtocolDetailClient } from "@/components/protocols/protocol-detail-client";
import type {
  CustomerRow,
  DeviceRow,
  HandoverProtocolAccessoryRow,
  HandoverProtocolChecklistRow,
  HandoverProtocolDeviceRow,
  HandoverProtocolRow,
  OrderRow,
  UserRow,
} from "@/types/db";

export default async function AdminProtocolDetailPage({ params }: PageProps<"/protocols/[id]">) {
  const { id } = await params;
  const db = getDb();

  const protocol = await db
    .prepare(`SELECT * FROM handover_protocols WHERE id = ?`)
    .bind(id)
    .first<HandoverProtocolRow>();
  if (!protocol) notFound();

  const [order, customer, technician, { results: devices }, { results: accessories }, { results: checklist }] =
    await Promise.all([
      db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(protocol.order_id).first<OrderRow>(),
      db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(protocol.customer_id).first<CustomerRow>(),
      protocol.technician_id
        ? db.prepare(`SELECT * FROM users WHERE id = ?`).bind(protocol.technician_id).first<UserRow>()
        : Promise.resolve(null),
      db
        .prepare(`SELECT * FROM handover_protocol_devices WHERE protocol_id = ? ORDER BY sort_order ASC`)
        .bind(id)
        .all<HandoverProtocolDeviceRow>(),
      db
        .prepare(`SELECT * FROM handover_protocol_accessories WHERE protocol_id = ? ORDER BY sort_order ASC`)
        .bind(id)
        .all<HandoverProtocolAccessoryRow>(),
      db
        .prepare(`SELECT * FROM handover_protocol_checklist WHERE protocol_id = ? ORDER BY category ASC, sort_order ASC`)
        .bind(id)
        .all<HandoverProtocolChecklistRow>(),
    ]);
  if (!order) notFound();

  const deviceIds = devices.map((d) => d.device_id).filter((v): v is string => !!v);
  const deviceWarranty = new Map<string, DeviceRow>();
  if (deviceIds.length > 0) {
    const placeholders = deviceIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT * FROM devices WHERE id IN (${placeholders})`)
      .bind(...deviceIds)
      .all<DeviceRow>();
    results.forEach((d) => deviceWarranty.set(d.id, d));
  }

  return (
    <ProtocolDetailClient
      protocol={protocol}
      order={order}
      customer={customer}
      devices={devices}
      accessories={accessories}
      checklist={checklist}
      deviceWarranty={deviceWarranty}
      technicianName={technician?.full_name ?? null}
      isAdmin
    />
  );
}
