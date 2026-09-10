"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { applyWatermark } from "@/lib/watermark";
import { formatDateTime, formatVnd } from "@/lib/utils";
import type {
  CustomerRow,
  OrderItemRow,
  OrderRow,
  ReportImageRow,
  TaskChecklistRow,
  TaskRow,
} from "@/types/db";

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };
const FORM_VARIANT: Record<string, "warning" | "secondary"> = { HAT: "warning", BOT: "secondary" };
const PACKAGING_VARIANT: Record<string, "success" | "info"> = { TUI_XANH: "success", TUI_ZIP: "info" };

export function TaskDetailClient({
  task: initialTask,
  order,
  items,
  checklist: initialChecklist,
  customer,
  images: initialImages,
  employeeName,
}: {
  task: TaskRow;
  order: OrderRow;
  items: OrderItemRow[];
  checklist: TaskChecklistRow[];
  customer: CustomerRow | null;
  images: ReportImageRow[];
  employeeName: string;
}) {
  const router = useRouter();
  const [task, setTask] = useState(initialTask);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [images, setImages] = useState(initialImages);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredUnchecked = checklist.filter((c) => c.is_required && !c.is_checked);
  const canComplete = task.status === "IN_PROGRESS" && requiredUnchecked.length === 0 && note.trim().length > 0;

  async function onStart() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      setTask(data.task);
      toast.success("Đã bắt đầu đóng gói");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleChecklist(item: TaskChecklistRow, checked: boolean) {
    const prev = checklist;
    setChecklist((cur) => cur.map((c) => (c.id === item.id ? { ...c, is_checked: checked ? 1 : 0 } : c)));
    const res = await fetch(`/api/tasks/${task.id}/checklist/${item.id}`, {
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

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploadingCount(files.length);
    for (const file of files) {
      try {
        const watermarked = await applyWatermark(file, {
          orderCode: order.order_code,
          employeeName,
        });
        const form = new FormData();
        form.append("image", watermarked, `report-${Date.now()}.jpg`);
        const res = await fetch(`/api/tasks/${task.id}/report-images`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Tải ảnh thất bại");
          continue;
        }
        setImages((cur) => [...cur, data.image]);
      } catch {
        toast.error("Không thể xử lý watermark cho ảnh này");
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    }
  }

  async function onComplete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      setTask(data.task);
      toast.success("Đã xác nhận hoàn thành!");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{order.order_code}</h1>
          <TaskStatusBadge status={task.status} />
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-stone-500">
          <TaskPriorityBadge priority={task.priority} />
          {task.due_at && <span>Hạn: {formatDateTime(task.due_at)}</span>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="font-medium">{customer?.name}</div>
          <div className="text-stone-500">{order.customer_phone_snapshot}</div>
          <div className="text-stone-500">{order.customer_address_snapshot}</div>
          {order.delivery_method && (
            <div className="text-stone-500">Hình thức giao: {order.delivery_method}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sản phẩm cần đóng gói</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b border-stone-100 pb-3 last:border-0">
              <div className="flex flex-col gap-1.5">
                <div className="font-medium">{item.product_name}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={FORM_VARIANT[item.form]} className="text-sm font-bold">
                    {FORM_LABEL[item.form]}
                  </Badge>
                  <Badge variant={PACKAGING_VARIANT[item.packaging]} className="text-sm font-bold">
                    {PACKAGING_LABEL[item.packaging]}
                  </Badge>
                  <Badge className="text-sm font-bold">
                    {item.weight_grams >= 1000 ? `${item.weight_grams / 1000}kg` : `${item.weight_grams}g`}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">x{item.quantity}</div>
                <div className="text-xs text-stone-400">{formatVnd(item.line_total)}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {task.status === "TODO" && (
        <Button size="lg" onClick={onStart} disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          BẮT ĐẦU ĐÓNG GÓI
        </Button>
      )}

      {(task.status === "IN_PROGRESS" || task.status === "COMPLETED") && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklist đóng gói</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {checklist.map((item) => (
                <label key={item.id} className="flex items-start gap-3">
                  <Checkbox
                    checked={!!item.is_checked}
                    disabled={task.status !== "IN_PROGRESS"}
                    onCheckedChange={(v) => onToggleChecklist(item, v === true)}
                  />
                  <span className="text-sm leading-6">
                    {item.label}
                    {!item.is_required && <span className="ml-1 text-stone-400">(tùy chọn)</span>}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">📷 Ảnh báo cáo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
                    <Image src={img.image_url} alt="Ảnh báo cáo" fill className="object-cover" unoptimized />
                  </div>
                ))}
                {uploadingCount > 0 &&
                  Array.from({ length: uploadingCount }).map((_, i) => (
                    <div
                      key={`uploading-${i}`}
                      className="flex aspect-square items-center justify-center rounded-lg bg-stone-100"
                    >
                      <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                    </div>
                  ))}
              </div>
              {task.status === "IN_PROGRESS" && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={onFilesSelected}
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="h-4 w-4" /> CHỤP ẢNH BÁO CÁO
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {task.status === "IN_PROGRESS" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ghi chú hoàn thành</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Nhập ghi chú..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>
          )}

          {task.status === "IN_PROGRESS" && (
            <Button size="lg" onClick={onComplete} disabled={!canComplete || busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              XÁC NHẬN HOÀN THÀNH
            </Button>
          )}
          {task.status === "IN_PROGRESS" && requiredUnchecked.length > 0 && (
            <p className="text-center text-xs text-red-600">
              Còn {requiredUnchecked.length} mục checklist bắt buộc chưa hoàn thành
            </p>
          )}
        </>
      )}
    </div>
  );
}
