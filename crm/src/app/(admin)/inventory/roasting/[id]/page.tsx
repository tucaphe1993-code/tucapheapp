import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoastBatchActions } from "@/components/inventory/roast-batch-actions";
import { formatDateTime, formatKg, formatVnd } from "@/lib/utils";
import type { RoastBatchRow, UserRow } from "@/types/db";

interface VariantInfo {
  id: string;
  sku: string;
  product_name: string;
}

export default async function RoastBatchDetailPage({ params }: PageProps<"/inventory/roasting/[id]">) {
  const { id } = await params;
  const db = getDb();

  const batch = await db.prepare(`SELECT * FROM roast_batches WHERE id = ?`).bind(id).first<RoastBatchRow>();
  if (!batch) notFound();

  const [green, roasted, createdBy] = await Promise.all([
    db
      .prepare(
        `SELECT pv.id, pv.sku, p.name as product_name FROM product_variants pv
         JOIN products p ON p.id = pv.product_id WHERE pv.id = ?`
      )
      .bind(batch.green_variant_id)
      .first<VariantInfo>(),
    db
      .prepare(
        `SELECT pv.id, pv.sku, p.name as product_name FROM product_variants pv
         JOIN products p ON p.id = pv.product_id WHERE pv.id = ?`
      )
      .bind(batch.roasted_variant_id)
      .first<VariantInfo>(),
    db.prepare(`SELECT * FROM users WHERE id = ?`).bind(batch.created_by).first<UserRow>(),
  ]);

  const costRows = [
    { label: "Nguyên liệu nhân xanh", value: batch.green_bean_cost },
    { label: "Gas", value: batch.gas_cost },
    { label: "Nhân công", value: batch.labor_cost },
    { label: "Bao bì", value: batch.packaging_cost },
    { label: "Chi phí khác", value: batch.other_cost },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Mẻ rang {batch.batch_code}</h1>
          <div className="text-sm text-stone-500">Tạo lúc {formatDateTime(batch.created_at)} · {createdBy?.full_name}</div>
        </div>
        <Badge variant={batch.status === "CONFIRMED" ? "success" : "secondary"}>
          {batch.status === "CONFIRMED" ? "Đã xác nhận" : "Nháp — chưa đụng tồn kho"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nguyên liệu &amp; thành phẩm</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Nhân xanh</span>
              <span className="font-medium">
                {green?.sku} — {formatKg(batch.input_kg)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Hao hụt</span>
              <span>
                {formatKg(batch.shrinkage_kg)} ({batch.shrinkage_percent}%)
              </span>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-2 font-semibold">
              <span>Thành phẩm</span>
              <span>
                {roasted?.sku} — {formatKg(batch.finished_kg)}
              </span>
            </div>
            {batch.roasted_by && (
              <div className="flex justify-between text-stone-500">
                <span>Người rang</span>
                <span>{batch.roasted_by}</span>
              </div>
            )}
            {batch.note && (
              <div className="border-t border-stone-100 pt-2 text-stone-500">Ghi chú: {batch.note}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chi phí mẻ rang</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {costRows.map((r) => (
              <div key={r.label} className="flex justify-between">
                <span className="text-stone-500">{r.label}</span>
                <span>{formatVnd(r.value)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-stone-100 pt-2 font-semibold">
              <span>Tổng chi phí</span>
              <span>{formatVnd(batch.total_cost)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-amber-800">
              <span>Giá vốn / kg thành phẩm</span>
              <span>{formatVnd(batch.cost_per_kg)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {batch.status === "DRAFT" && (
        <div className="flex justify-end">
          <RoastBatchActions batchId={batch.id} inputKg={batch.input_kg} />
        </div>
      )}
    </div>
  );
}
