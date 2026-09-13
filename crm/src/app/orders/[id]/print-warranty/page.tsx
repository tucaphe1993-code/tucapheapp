import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { COMPANY_INFO } from "@/lib/constants";
import { PrintButton } from "@/components/print-button";
import { formatDate } from "@/lib/utils";
import { addWarrantyMonths } from "@/lib/warranty";
import { Phone, ClipboardList, SearchCheck, CheckCircle2 } from "lucide-react";
import type {
  CustomerRow,
  DeviceRow,
  HandoverProtocolDeviceRow,
  HandoverProtocolRow,
  OrderItemRow,
  OrderRow,
  UserRow,
} from "@/types/db";

const GREEN = "#085D18";
const GREEN_LIGHT = "#E9F4EA";
const CREAM = "#FBF6EC";

interface WarrantyItemJoined extends OrderItemRow {
  model: string | null;
  warranty_months: number;
}

const REQUEST_STEPS = [
  { icon: Phone, label: "Liên hệ Tú Cà Phê" },
  { icon: ClipboardList, label: "Cung cấp mã phiếu hoặc Serial + mô tả lỗi" },
  { icon: SearchCheck, label: "Kỹ thuật viên kiểm tra" },
  { icon: CheckCircle2, label: "Xử lý theo chính sách bảo hành" },
];

const COVERED = [
  "Bảo hành lỗi kỹ thuật do thiết bị/linh kiện trong điều kiện sử dụng bình thường.",
  "Kiểm tra, sửa chữa, thay thế linh kiện lỗi thuộc phạm vi bảo hành.",
  "Hỗ trợ kỹ thuật và hướng dẫn sử dụng.",
];

const NOT_COVERED = [
  "Máy rơi, va đập, móp méo hoặc hư hỏng vật lý.",
  "Sử dụng sai điện áp hoặc nguồn điện không phù hợp.",
  "Hư hỏng do nguồn nước, nguồn điện hoặc môi trường bên ngoài.",
  "Tự ý tháo lắp, sửa chữa hoặc thay đổi kết cấu.",
  "Sử dụng sai hướng dẫn, không vệ sinh/bảo dưỡng đúng cách.",
  "Hư hỏng do linh kiện/phụ kiện không phù hợp.",
  "Hao mòn tự nhiên hoặc nguyên nhân bất khả kháng.",
];

export default async function OrderWarrantyPrintPage({ params }: PageProps<"/orders/[id]/print-warranty">) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/my-tasks");

  const { id } = await params;
  const db = getDb();

  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
  if (!order) notFound();

  const [customer, { results: items }, employee, protocol] = await Promise.all([
    db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first<CustomerRow>(),
    db
      .prepare(
        `SELECT oi.*, pv.model, pv.warranty_months FROM order_items oi
         JOIN product_variants pv ON pv.id = oi.product_variant_id
         WHERE oi.order_id = ? AND pv.warranty_months IS NOT NULL`
      )
      .bind(id)
      .all<WarrantyItemJoined>(),
    db.prepare(`SELECT * FROM users WHERE id = ?`).bind(order.created_by).first<UserRow>(),
    db.prepare(`SELECT * FROM handover_protocols WHERE order_id = ?`).bind(id).first<HandoverProtocolRow>(),
  ]);

  if (items.length === 0) notFound();

  const deviceIds = items.map((i) => i.device_id).filter((v): v is string => !!v);
  const devices = new Map<string, DeviceRow>();
  if (deviceIds.length > 0) {
    const placeholders = deviceIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT * FROM devices WHERE id IN (${placeholders})`)
      .bind(...deviceIds)
      .all<DeviceRow>();
    results.forEach((d) => devices.set(d.id, d));
  }

  const protocolDeviceConditions = new Map<string, string>();
  if (protocol) {
    const { results: protocolDevices } = await db
      .prepare(`SELECT * FROM handover_protocol_devices WHERE protocol_id = ?`)
      .bind(protocol.id)
      .all<HandoverProtocolDeviceRow>();
    protocolDevices.forEach((pd) => {
      if (pd.device_id && pd.condition) protocolDeviceConditions.set(pd.device_id, pd.condition);
    });
  }

  const technician =
    protocol?.technician_id && protocol.technician_id !== order.created_by
      ? await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(protocol.technician_id).first<UserRow>()
      : null;

  const contactName = protocol?.contact_name || customer?.name || "—";
  const contactPhone = protocol?.contact_phone || order.customer_phone_snapshot || "—";
  const installAddress = protocol?.install_address || order.customer_address_snapshot || "—";
  const billingAddress =
    customer?.address && customer.address !== installAddress ? customer.address : null;
  const assignedStaff = technician?.full_name || employee?.full_name || "—";

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const warrantyLookupUrl = `${proto}://${host}/warranty/${order.id}`;
  const warrantyQrSvg = await QRCode.toString(warrantyLookupUrl, {
    type: "svg",
    margin: 0,
    color: { dark: GREEN, light: "#ffffff" },
  });

  return (
    <div className="min-h-screen bg-stone-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          tr, .avoid-break { break-inside: avoid; }
        }
      `}</style>

      <div className="mx-auto flex max-w-[186mm] justify-end px-4 pb-3 print:hidden">
        <PrintButton />
      </div>

      <div className="relative mx-auto max-w-[186mm] overflow-hidden bg-white p-8 text-[11px] leading-snug text-stone-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {/* Subtle coffee-bean decoration, top-right */}
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="pointer-events-none absolute -top-4 right-0 h-28 w-28 opacity-[0.06] print:opacity-[0.06]"
          style={{ color: GREEN }}
        >
          <ellipse cx="50" cy="50" rx="42" ry="48" fill="currentColor" />
          <path d="M50 4 Q40 50 50 96" stroke="white" strokeWidth="4" fill="none" />
        </svg>

        {/* Header */}
        <div className="relative flex items-start gap-4 border-b-2 pb-4" style={{ borderColor: GREEN }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-tucaphe.png" alt="Tú Cà Phê" className="h-20 w-20 shrink-0" />
          <div>
            <div className="text-xl font-bold" style={{ color: GREEN }}>
              {COMPANY_INFO.brandName}
            </div>
            <div className="text-[11px] italic text-amber-800">{COMPANY_INFO.slogan}</div>
            <div className="mt-1 text-[10px] font-semibold tracking-wide text-stone-500">
              {COMPANY_INFO.tagline}
            </div>
            <div className="mt-1 text-[10px] text-stone-600">
              Địa chỉ: {COMPANY_INFO.address} &nbsp;·&nbsp; Hotline: {COMPANY_INFO.phone}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide" style={{ color: GREEN }}>
            Phiếu bảo hành
          </h1>
          <div className="mt-1 text-[9.5px] font-semibold tracking-[0.15em] text-amber-800">
            SẢN PHẨM CHÍNH HÃNG · DỊCH VỤ TẬN TÂM · HỖ TRỢ LÂU DÀI
          </div>
        </div>

        <div className="mt-3 flex justify-between border-b border-dashed border-stone-300 pb-2 text-[11px]">
          <div>
            <span className="text-stone-500">Mã phiếu / Mã đơn hàng: </span>
            <span className="font-semibold">{order.order_code}</span>
          </div>
          <div>
            <span className="text-stone-500">Ngày mua: </span>
            <span className="font-semibold">{formatDate(order.created_at)}</span>
          </div>
        </div>

        {/* Section 1 + 2: customer & order info, side by side */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-stone-200 p-3" style={{ backgroundColor: CREAM }}>
            <div className="mb-1.5 text-[10.5px] font-bold uppercase" style={{ color: GREEN }}>
              Thông tin khách hàng
            </div>
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                <tr>
                  <td className="w-[42%] py-0.5 align-top text-stone-500">Tên khách hàng</td>
                  <td className="py-0.5 font-medium">{customer?.name ?? "Khách lẻ"}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-top text-stone-500">Người liên hệ</td>
                  <td className="py-0.5">{contactName}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-top text-stone-500">Số điện thoại</td>
                  <td className="py-0.5">{contactPhone}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-top text-stone-500">Địa chỉ lắp đặt</td>
                  <td className="py-0.5">{installAddress}</td>
                </tr>
                {billingAddress && (
                  <tr>
                    <td className="py-0.5 align-top text-stone-500">Địa chỉ xuất hóa đơn</td>
                    <td className="py-0.5">{billingAddress}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-stone-200 p-3">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase" style={{ color: GREEN }}>
              Thông tin đơn hàng
            </div>
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                <tr>
                  <td className="w-[42%] py-0.5 align-top text-stone-500">Ngày mua</td>
                  <td className="py-0.5">{formatDate(order.created_at)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-top text-stone-500">Ngày giao hàng</td>
                  <td className="py-0.5">{order.delivery_date ? formatDate(order.delivery_date) : "—"}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-top text-stone-500">Ngày lắp đặt</td>
                  <td className="py-0.5">{protocol?.installed_at ? formatDate(protocol.installed_at) : "—"}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-top text-stone-500">Nhân viên phụ trách</td>
                  <td className="py-0.5">{assignedStaff}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-top text-stone-500">Hình thức giao hàng</td>
                  <td className="py-0.5">{order.delivery_method ?? "—"}</td>
                </tr>
                <tr>
                  <td className="py-0.5 align-top text-stone-500">Ghi chú</td>
                  <td className="py-0.5">{order.note ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: device table */}
        <div className="mt-3">
          <div className="mb-1.5 text-[10.5px] font-bold uppercase" style={{ color: GREEN }}>
            Thông tin thiết bị
          </div>
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr style={{ backgroundColor: GREEN_LIGHT }}>
                <th className="border border-stone-300 p-1.5 text-center" style={{ color: GREEN }}>
                  STT
                </th>
                <th className="border border-stone-300 p-1.5 text-left" style={{ color: GREEN }}>
                  Thiết bị
                </th>
                <th className="border border-stone-300 p-1.5 text-left" style={{ color: GREEN }}>
                  Model
                </th>
                <th className="border border-stone-300 p-1.5 text-left" style={{ color: GREEN }}>
                  Serial
                </th>
                <th className="border border-stone-300 p-1.5 text-center" style={{ color: GREEN }}>
                  SL
                </th>
                <th className="border border-stone-300 p-1.5 text-left" style={{ color: GREEN }}>
                  Tình trạng
                </th>
                <th className="border border-stone-300 p-1.5 text-center" style={{ color: GREEN }}>
                  Bảo hành
                </th>
                <th className="border border-stone-300 p-1.5 text-right" style={{ color: GREEN }}>
                  Đến ngày
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const device = item.device_id ? devices.get(item.device_id) : undefined;
                const activated = !!device?.warranty_end_date;
                const endDate = activated
                  ? new Date(device!.warranty_end_date!.replace(" ", "T") + "Z")
                  : addWarrantyMonths(order.created_at, item.warranty_months);
                const condition = (device && protocolDeviceConditions.get(device.id)) ?? "—";
                return (
                  <tr key={item.id}>
                    <td className="border border-stone-300 p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-stone-300 p-1.5">{item.product_name}</td>
                    <td className="border border-stone-300 p-1.5">{item.model ?? "—"}</td>
                    <td className="border border-stone-300 p-1.5 font-mono">
                      {device?.serial_number ?? "—"}
                    </td>
                    <td className="border border-stone-300 p-1.5 text-center">{item.quantity}</td>
                    <td className="border border-stone-300 p-1.5">{condition}</td>
                    <td className="border border-stone-300 p-1.5 text-center">{item.warranty_months} tháng</td>
                    <td className="border border-stone-300 p-1.5 text-right">
                      {formatDate(endDate.toISOString())}
                      {!activated && <div className="text-[9px] text-stone-400">(dự kiến)</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Section 4: warranty policy */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="avoid-break rounded-lg border border-stone-200 p-3" style={{ backgroundColor: GREEN_LIGHT }}>
            <div className="mb-1 text-[10.5px] font-bold uppercase" style={{ color: GREEN }}>
              Phạm vi bảo hành
            </div>
            <ul className="flex flex-col gap-0.5 text-[10px] text-stone-700">
              {COVERED.map((line) => (
                <li key={line} className="flex gap-1">
                  <span style={{ color: GREEN }}>•</span> {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="avoid-break rounded-lg border border-stone-200 p-3" style={{ backgroundColor: CREAM }}>
            <div className="mb-1 text-[10.5px] font-bold uppercase text-amber-900">
              Các trường hợp không bảo hành
            </div>
            <ul className="flex flex-col gap-0.5 text-[10px] text-stone-700">
              {NOT_COVERED.map((line) => (
                <li key={line} className="flex gap-1">
                  <span className="text-amber-800">•</span> {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Section 5: warranty request steps */}
        <div className="avoid-break mt-3">
          <div className="mb-1.5 text-[10.5px] font-bold uppercase" style={{ color: GREEN }}>
            Yêu cầu bảo hành
          </div>
          <div className="grid grid-cols-4 gap-2">
            {REQUEST_STEPS.map((step, idx) => (
              <div
                key={step.label}
                className="flex flex-col items-center gap-1 rounded-lg border border-stone-200 p-2 text-center"
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: GREEN }}
                >
                  {idx + 1}
                </div>
                <step.icon className="h-4 w-4" style={{ color: GREEN }} />
                <div className="text-[9.5px] leading-tight text-stone-700">{step.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 6: handover confirmation + QR */}
        <div className="avoid-break mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="font-bold uppercase" style={{ color: GREEN }}>
              Đại diện {COMPANY_INFO.brandName}
            </div>
            <div className="mt-8 border-t border-stone-400 pt-1 text-[10px] text-stone-500">
              Ký và ghi rõ họ tên
            </div>
          </div>
          <div className="text-center">
            <div className="font-bold uppercase" style={{ color: GREEN }}>
              Khách hàng
            </div>
            <div className="text-[9.5px] text-stone-500">Đã nhận thiết bị và được hướng dẫn sử dụng</div>
            <div className="mt-4 text-[10px] text-stone-500">
              Ngày: ____ / ____ / ______
            </div>
            <div className="mt-2 border-t border-stone-400 pt-1 text-[10px] text-stone-500">
              Ký và ghi rõ họ tên
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-stone-200 p-2 text-center">
            <div
              className="h-16 w-16"
              // SVG được server tự sinh từ đúng URL tra cứu của đơn hàng này
              // (qua thư viện qrcode), không phải nội dung do người dùng nhập.
              dangerouslySetInnerHTML={{ __html: warrantyQrSvg }}
            />
            <div className="text-[9px] font-semibold uppercase text-stone-500">
              Quét QR để tra cứu bảo hành
            </div>
            <div className="text-[9px] font-mono text-stone-400">{order.order_code}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 border-t border-dashed border-stone-300 pt-2 text-center text-[10px] text-stone-500">
          <span className="font-bold" style={{ color: GREEN }}>
            {COMPANY_INFO.brandName}
          </span>{" "}
          · <span className="italic">{COMPANY_INFO.slogan}</span> · Hotline: {COMPANY_INFO.phone} · {COMPANY_INFO.address}
        </div>
      </div>
    </div>
  );
}
