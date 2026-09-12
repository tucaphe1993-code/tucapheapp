import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { COMPANY_INFO } from "@/lib/constants";
import { PROTOCOL_STATUS_LABEL } from "@/components/protocols/protocol-status-badge";
import { PrintButton } from "@/components/print-button";
import { formatDate, formatDateTime } from "@/lib/utils";
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

export default async function ProtocolPrintPage({ params }: PageProps<"/protocols/[id]/print">) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const db = getDb();

  const protocol = await db
    .prepare(`SELECT * FROM handover_protocols WHERE id = ?`)
    .bind(id)
    .first<HandoverProtocolRow>();
  if (!protocol) notFound();
  if (session.user.role === "EMPLOYEE" && protocol.technician_id !== session.user.id) notFound();

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

  const installItems = checklist.filter((c) => c.category === "INSTALL");
  const guideItems = checklist.filter((c) => c.category === "GUIDE");
  const showWarranty = protocol.status === "WARRANTY_ACTIVATED" || protocol.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-stone-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto flex max-w-3xl justify-end px-6 pb-3 print:hidden">
        <PrintButton />
      </div>
      <div className="mx-auto max-w-3xl bg-white p-10 text-[13px] leading-relaxed text-stone-900 shadow-sm print:max-w-none print:p-8 print:shadow-none">
        <div className="mb-6 flex items-start justify-between border-b-2 border-stone-900 pb-4">
          <div>
            <div className="text-lg font-bold">{COMPANY_INFO.name}</div>
            <div className="text-stone-600">{COMPANY_INFO.address}</div>
            <div className="text-stone-600">ĐT: {COMPANY_INFO.phone} · Email: {COMPANY_INFO.email}</div>
          </div>
          <div className="text-right text-xs text-stone-500">
            <div>Số: {protocol.protocol_code}</div>
            <div>Ngày lập: {formatDate(protocol.created_at)}</div>
            <div>Mã đơn hàng: {order.order_code}</div>
          </div>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold uppercase">Biên bản lắp đặt</h1>
          <h2 className="text-base font-semibold uppercase">Bàn giao &amp; kích hoạt bảo hành</h2>
          <div className="mt-1 text-xs text-stone-500">Trạng thái: {PROTOCOL_STATUS_LABEL[protocol.status]}</div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-6">
          <div>
            <div className="mb-1 font-bold uppercase">Bên A — Đơn vị cung cấp</div>
            <div>{COMPANY_INFO.name}</div>
            <div>Kỹ thuật viên: {technician?.full_name ?? "—"}</div>
            <div>Ngày lắp đặt: {protocol.installed_at ? formatDate(protocol.installed_at) : "—"}</div>
          </div>
          <div>
            <div className="mb-1 font-bold uppercase">Bên B — Khách hàng</div>
            <div>{customer?.name}</div>
            <div>Người liên hệ: {protocol.contact_name ?? "—"}</div>
            <div>SĐT: {protocol.contact_phone ?? "—"}</div>
            <div>Địa chỉ lắp đặt: {protocol.install_address ?? "—"}</div>
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-1 font-bold uppercase">Thiết bị bàn giao</div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border border-stone-400 bg-stone-100">
                <th className="border border-stone-400 p-1.5">STT</th>
                <th className="border border-stone-400 p-1.5">Tên thiết bị</th>
                <th className="border border-stone-400 p-1.5">Model</th>
                <th className="border border-stone-400 p-1.5">Serial Number</th>
                <th className="border border-stone-400 p-1.5">SL</th>
                <th className="border border-stone-400 p-1.5">Tình trạng</th>
                {showWarranty && <th className="border border-stone-400 p-1.5">Bảo hành đến</th>}
              </tr>
            </thead>
            <tbody>
              {devices.map((d, idx) => {
                const dev = d.device_id ? deviceWarranty.get(d.device_id) : undefined;
                return (
                  <tr key={d.id}>
                    <td className="border border-stone-400 p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-stone-400 p-1.5">{d.product_name}</td>
                    <td className="border border-stone-400 p-1.5">{d.model ?? "—"}</td>
                    <td className="border border-stone-400 p-1.5 font-mono">{d.serial_number}</td>
                    <td className="border border-stone-400 p-1.5 text-center">{d.quantity}</td>
                    <td className="border border-stone-400 p-1.5">{d.condition ?? "—"}</td>
                    {showWarranty && (
                      <td className="border border-stone-400 p-1.5">
                        {dev?.warranty_end_date ? formatDate(dev.warranty_end_date) : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {accessories.length > 0 && (
          <div className="mb-5">
            <div className="mb-1 font-bold uppercase">Phụ kiện / vật tư bàn giao</div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border border-stone-400 bg-stone-100">
                  <th className="border border-stone-400 p-1.5">STT</th>
                  <th className="border border-stone-400 p-1.5">Tên phụ kiện</th>
                  <th className="border border-stone-400 p-1.5">SL</th>
                  <th className="border border-stone-400 p-1.5">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {accessories.map((a, idx) => (
                  <tr key={a.id}>
                    <td className="border border-stone-400 p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-stone-400 p-1.5">{a.name}</td>
                    <td className="border border-stone-400 p-1.5 text-center">{a.quantity}</td>
                    <td className="border border-stone-400 p-1.5">{a.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-6">
          <div>
            <div className="mb-1 font-bold uppercase">Checklist lắp đặt</div>
            <ul className="flex flex-col gap-0.5">
              {installItems.map((item) => (
                <li key={item.id}>
                  {item.is_checked ? "☑" : "☐"} {item.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 font-bold uppercase">Hướng dẫn khách hàng</div>
            <ul className="flex flex-col gap-0.5">
              {guideItems.map((item) => (
                <li key={item.id}>
                  {item.is_checked ? "☑" : "☐"} {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-1 font-bold uppercase">Tình trạng thiết bị khi bàn giao</div>
          <div>{protocol.device_condition ?? "Chưa xác nhận"}</div>
          {protocol.exception_note && (
            <div className="mt-1">Ghi nhận ngoại lệ / vấn đề: {protocol.exception_note}</div>
          )}
        </div>

        {showWarranty && (
          <div className="mb-5">
            <div className="mb-1 font-bold uppercase">Kích hoạt bảo hành</div>
            <div>
              Ngày kích hoạt: {protocol.warranty_activated_at ? formatDateTime(protocol.warranty_activated_at) : "—"}
            </div>
            <ul className="mt-1 flex flex-col gap-0.5">
              {devices.map((d) => {
                const dev = d.device_id ? deviceWarranty.get(d.device_id) : undefined;
                return (
                  <li key={d.id}>
                    {d.product_name} — Serial {d.serial_number} — Bảo hành đến:{" "}
                    {dev?.warranty_end_date ? formatDate(dev.warranty_end_date) : "—"}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-6 text-center">
          <div>
            <div className="font-bold uppercase">Đại diện Bên A</div>
            <div className="text-xs text-stone-500">Nhân viên kỹ thuật — Ký và ghi rõ họ tên</div>
            {protocol.signature_a_data ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={protocol.signature_a_data} alt="Chữ ký bên A" className="mx-auto mt-2 h-20" />
            ) : (
              <div className="mt-2 h-20" />
            )}
            <div className="border-t border-stone-400 pt-1 text-xs">{protocol.signature_a_name ?? ""}</div>
          </div>
          <div>
            <div className="font-bold uppercase">Đại diện Bên B</div>
            <div className="text-xs text-stone-500">Khách hàng — Ký và ghi rõ họ tên</div>
            {protocol.signature_b_data ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={protocol.signature_b_data} alt="Chữ ký bên B" className="mx-auto mt-2 h-20" />
            ) : (
              <div className="mt-2 h-20" />
            )}
            <div className="border-t border-stone-400 pt-1 text-xs">{protocol.signature_b_name ?? ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
