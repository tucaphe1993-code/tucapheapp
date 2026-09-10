"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstallationStatusBadge } from "@/components/installations/installation-status-badge";
import { ScheduleInstallationDialog } from "@/components/installations/schedule-installation-dialog";
import { formatDateTime } from "@/lib/utils";
import type { CustomerRow, InstallationChecklistRow, InstallationRow, OrderRow } from "@/types/db";

export function InstallationDetailClient({
  installation: initialInstallation,
  order,
  customer,
  checklist: initialChecklist,
  technicianName,
  isAdmin,
}: {
  installation: InstallationRow;
  order: OrderRow;
  customer: CustomerRow | null;
  checklist: InstallationChecklistRow[];
  technicianName: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [installation, setInstallation] = useState(initialInstallation);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [busy, setBusy] = useState(false);

  const requiredUnchecked = checklist.filter((c) => c.is_required && !c.is_checked);
  const canComplete = installation.status === "IN_PROGRESS" && requiredUnchecked.length === 0;
  const canStart = installation.status === "PENDING" || installation.status === "SCHEDULED";
  const canReschedule =
    isAdmin &&
    installation.status !== "COMPLETED" &&
    installation.status !== "HANDED_OVER" &&
    installation.status !== "CANCELLED";

  async function onStart() {
    setBusy(true);
    try {
      const res = await fetch(`/api/installations/${installation.id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      setInstallation(data.installation);
      toast.success("Đã bắt đầu lắp đặt");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleChecklist(item: InstallationChecklistRow, checked: boolean) {
    const prev = checklist;
    setChecklist((cur) => cur.map((c) => (c.id === item.id ? { ...c, is_checked: checked ? 1 : 0 } : c)));
    const res = await fetch(`/api/installations/${installation.id}/checklist/${item.id}`, {
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

  async function onComplete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/installations/${installation.id}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      setInstallation(data.installation);
      toast.success("Đã hoàn thành lắp đặt");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onHandover() {
    setBusy(true);
    try {
      const res = await fetch(`/api/installations/${installation.id}/handover`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      setInstallation(data.installation);
      toast.success("Đã bàn giao cho khách hàng");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{installation.equipment}</h1>
          <InstallationStatusBadge status={installation.status} />
        </div>
        <div className="mt-1 text-sm text-stone-500">Khách hàng: {customer?.name ?? "—"}</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin lắp đặt</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {installation.serial_number && <div>Serial: {installation.serial_number}</div>}
          <div>Địa điểm: {installation.location || order.customer_address_snapshot || "—"}</div>
          <div>Kỹ thuật viên: {technicianName ?? "Chưa phân công"}</div>
          {installation.scheduled_at && <div>Ngày/giờ lắp: {formatDateTime(installation.scheduled_at)}</div>}
          {installation.note && <div>Ghi chú: {installation.note}</div>}
          {installation.handed_over_at && (
            <div>Ngày bàn giao: {formatDateTime(installation.handed_over_at)}</div>
          )}
        </CardContent>
      </Card>

      {canReschedule && (
        <ScheduleInstallationDialog
          installationId={installation.id}
          currentTechnicianId={installation.technician_id}
          currentScheduledAt={installation.scheduled_at}
        />
      )}

      {canStart && (
        <Button size="lg" onClick={onStart} disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          BẮT ĐẦU LẮP ĐẶT
        </Button>
      )}

      {(installation.status === "IN_PROGRESS" ||
        installation.status === "COMPLETED" ||
        installation.status === "HANDED_OVER") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checklist lắp đặt</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {checklist.map((item) => (
              <label key={item.id} className="flex items-start gap-3">
                <Checkbox
                  checked={!!item.is_checked}
                  disabled={installation.status !== "IN_PROGRESS"}
                  onCheckedChange={(v) => onToggleChecklist(item, v === true)}
                />
                <span className="text-sm leading-6">{item.label}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {installation.status === "IN_PROGRESS" && (
        <>
          <Button size="lg" onClick={onComplete} disabled={!canComplete || busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            XÁC NHẬN HOÀN THÀNH
          </Button>
          {requiredUnchecked.length > 0 && (
            <p className="text-center text-xs text-red-600">
              Còn {requiredUnchecked.length} mục checklist bắt buộc chưa hoàn thành
            </p>
          )}
        </>
      )}

      {installation.status === "COMPLETED" && (
        <Button size="lg" onClick={onHandover} disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          XÁC NHẬN BÀN GIAO KHÁCH HÀNG
        </Button>
      )}
    </div>
  );
}
