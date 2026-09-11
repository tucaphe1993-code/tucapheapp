"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtocolStatusBadge } from "@/components/protocols/protocol-status-badge";
import { EditProtocolDialog } from "@/components/protocols/edit-protocol-dialog";
import { SignDialog } from "@/components/protocols/sign-dialog";
import { COMPANY_INFO } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  CustomerRow,
  DeviceRow,
  HandoverProtocolAccessoryRow,
  HandoverProtocolChecklistRow,
  HandoverProtocolDeviceRow,
  HandoverProtocolRow,
  OrderRow,
} from "@/types/db";

export function ProtocolDetailClient({
  protocol: initialProtocol,
  order,
  customer,
  devices: protocolDevices,
  accessories,
  checklist: initialChecklist,
  deviceWarranty,
  technicianName,
  isAdmin,
}: {
  protocol: HandoverProtocolRow;
  order: OrderRow;
  customer: CustomerRow | null;
  devices: HandoverProtocolDeviceRow[];
  accessories: HandoverProtocolAccessoryRow[];
  checklist: HandoverProtocolChecklistRow[];
  deviceWarranty: Map<string, DeviceRow>;
  technicianName: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [protocol, setProtocol] = useState(initialProtocol);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [busy, setBusy] = useState(false);

  const installItems = checklist.filter((c) => c.category === "INSTALL");
  const guideItems = checklist.filter((c) => c.category === "GUIDE");
  const allChecked = checklist.every((c) => c.is_checked);
  const canEditChecklist = protocol.status === "INSTALLING";
  const canEditInfo = isAdmin && protocol.status !== "HANDED_OVER" && protocol.status !== "WARRANTY_ACTIVATED" && protocol.status !== "COMPLETED";

  async function onToggleChecklist(item: HandoverProtocolChecklistRow, checked: boolean) {
    const prev = checklist;
    setChecklist((cur) => cur.map((c) => (c.id === item.id ? { ...c, is_checked: checked ? 1 : 0 } : c)));
    const res = await fetch(`/api/protocols/${protocol.id}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
    if (!res.ok) {
      setChecklist(prev);
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Không thể cập nhật checklist");
    }
  }

  async function callAction(path: string, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/protocols/${protocol.id}/${path}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      setProtocol(data.protocol);
      toast.success(successMsg);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">BIÊN BẢN LẮP ĐẶT — BÀN GIAO &amp; KÍCH HOẠT BẢO HÀNH</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
            <span>
              Số: <span className="font-medium text-stone-700">{protocol.protocol_code}</span>
            </span>
            <span>Ngày lập: {formatDate(protocol.created_at)}</span>
            <Link href={`/orders/${order.id}`} className="text-amber-800 hover:underline">
              Đơn hàng {order.order_code}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProtocolStatusBadge status={protocol.status} />
          {canEditInfo && <EditProtocolDialog protocol={protocol} />}
          <Link href={`/protocols/${protocol.id}/print`} target="_blank">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-4 w-4" /> Xuất biên bản PDF
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bên A — Đơn vị cung cấp</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div className="font-medium">{COMPANY_INFO.name}</div>
            <div className="text-stone-600">{COMPANY_INFO.address}</div>
            <div className="text-stone-600">ĐT: {COMPANY_INFO.phone}</div>
            <div className="text-stone-600">Email: {COMPANY_INFO.email}</div>
            <div className="text-stone-600">Kỹ thuật viên: {technicianName ?? "Chưa phân công"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bên B — Khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <Link href={`/customers/${customer?.id}`} className="font-medium text-amber-800 hover:underline">
              {customer?.name}
            </Link>
            <div className="text-stone-600">Người liên hệ: {protocol.contact_name ?? "—"}</div>
            <div className="text-stone-600">SĐT: {protocol.contact_phone ?? "—"}</div>
            <div className="text-stone-600">Địa chỉ lắp đặt: {protocol.install_address ?? "—"}</div>
            {protocol.note && <div className="text-stone-500">Ghi chú: {protocol.note}</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thiết bị bàn giao</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-1.5 pr-3">#</th>
                  <th className="py-1.5 pr-3">Tên thiết bị</th>
                  <th className="py-1.5 pr-3">Model</th>
                  <th className="py-1.5 pr-3">Serial</th>
                  <th className="py-1.5 pr-3">SL</th>
                  <th className="py-1.5 pr-3">Tình trạng</th>
                  {protocol.status === "WARRANTY_ACTIVATED" || protocol.status === "COMPLETED" ? (
                    <th className="py-1.5 pr-3">Bảo hành đến</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {protocolDevices.map((d, idx) => {
                  const dev = d.device_id ? deviceWarranty.get(d.device_id) : undefined;
                  return (
                    <tr key={d.id} className="border-b border-stone-100">
                      <td className="py-1.5 pr-3">{idx + 1}</td>
                      <td className="py-1.5 pr-3">{d.product_name}</td>
                      <td className="py-1.5 pr-3">{d.model ?? "—"}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">
                        {d.device_id ? (
                          <Link href={`/devices/${d.device_id}`} className="text-amber-800 hover:underline">
                            {d.serial_number}
                          </Link>
                        ) : (
                          d.serial_number
                        )}
                      </td>
                      <td className="py-1.5 pr-3">{d.quantity}</td>
                      <td className="py-1.5 pr-3">{d.condition ?? "—"}</td>
                      {protocol.status === "WARRANTY_ACTIVATED" || protocol.status === "COMPLETED" ? (
                        <td className="py-1.5 pr-3">
                          {dev?.warranty_end_date ? formatDate(dev.warranty_end_date) : "—"}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {accessories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phụ kiện / vật tư bàn giao</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-1.5 pr-3">#</th>
                  <th className="py-1.5 pr-3">Tên phụ kiện</th>
                  <th className="py-1.5 pr-3">SL</th>
                  <th className="py-1.5 pr-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {accessories.map((a, idx) => (
                  <tr key={a.id} className="border-b border-stone-100">
                    <td className="py-1.5 pr-3">{idx + 1}</td>
                    <td className="py-1.5 pr-3">{a.name}</td>
                    <td className="py-1.5 pr-3">{a.quantity}</td>
                    <td className="py-1.5 pr-3 text-stone-500">{a.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checklist lắp đặt</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {installItems.map((item) => (
              <label key={item.id} className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={!!item.is_checked}
                  disabled={!canEditChecklist}
                  onCheckedChange={(v) => onToggleChecklist(item, v === true)}
                />
                {item.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hướng dẫn khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {guideItems.map((item) => (
              <label key={item.id} className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={!!item.is_checked}
                  disabled={!canEditChecklist}
                  onCheckedChange={(v) => onToggleChecklist(item, v === true)}
                />
                {item.label}
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      {(protocol.device_condition || protocol.exception_note) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Xác nhận tình trạng thiết bị</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {protocol.device_condition && <div>Tình trạng khi bàn giao: {protocol.device_condition}</div>}
            {protocol.exception_note && (
              <div className="text-red-700">Ngoại lệ/vấn đề: {protocol.exception_note}</div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chữ ký xác nhận</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-2 text-center text-sm">
            <div className="font-semibold">ĐẠI DIỆN BÊN A — Nhân viên kỹ thuật</div>
            {protocol.signature_a_data ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={protocol.signature_a_data} alt="Chữ ký bên A" className="h-24 border-b border-stone-300" />
            ) : protocol.status === "PENDING_CONFIRMATION" ? (
              <SignDialog protocolId={protocol.id} party="A" label="Ký (Bên A)" defaultName={technicianName ?? ""} />
            ) : (
              <div className="h-24 w-full rounded-lg border border-dashed border-stone-300" />
            )}
            {protocol.signature_a_name && (
              <div className="text-xs text-stone-500">
                {protocol.signature_a_name} · {formatDateTime(protocol.signature_a_signed_at!)}
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-2 text-center text-sm">
            <div className="font-semibold">ĐẠI DIỆN BÊN B — Khách hàng</div>
            {protocol.signature_b_data ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={protocol.signature_b_data} alt="Chữ ký bên B" className="h-24 border-b border-stone-300" />
            ) : protocol.status === "PENDING_CONFIRMATION" ? (
              <SignDialog protocolId={protocol.id} party="B" label="Ký (Bên B)" defaultName={customer?.name ?? ""} />
            ) : (
              <div className="h-24 w-full rounded-lg border border-dashed border-stone-300" />
            )}
            {protocol.signature_b_name && (
              <div className="text-xs text-stone-500">
                {protocol.signature_b_name} · {formatDateTime(protocol.signature_b_signed_at!)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2 pb-4">
        {protocol.status === "PENDING_INSTALL" && (
          <Button onClick={() => callAction("start", "Đã bắt đầu lắp đặt")} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Bắt đầu lắp đặt
          </Button>
        )}
        {protocol.status === "INSTALLING" && (
          <Button
            onClick={() => callAction("submit-for-confirmation", "Đã gửi chờ xác nhận")}
            disabled={busy || !allChecked}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Hoàn tất lắp đặt — Chờ xác nhận
          </Button>
        )}
        {protocol.status === "HANDED_OVER" && isAdmin && (
          <Button onClick={() => callAction("activate-warranty", "Đã kích hoạt bảo hành")} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Kích hoạt bảo hành
          </Button>
        )}
        {protocol.status === "WARRANTY_ACTIVATED" && isAdmin && (
          <Button onClick={() => callAction("complete", "Đã hoàn tất biên bản")} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Hoàn tất
          </Button>
        )}
      </div>
    </div>
  );
}
