import { getDb } from "@/lib/db/client";
import { newId, nextRoastBatchCode } from "@/lib/db/id";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { InventoryRow, LaborCostMode, ProductVariantRow, RoastBatchRow, RoastCostConfigRow } from "@/types/db";

export interface RoastCostBreakdown {
  finishedKg: number;
  shrinkageKg: number;
  greenBeanCost: number;
  gasCost: number;
  laborCost: number;
  packagingCost: number;
  otherCost: number;
  totalCost: number;
  costPerKg: number;
}

/**
 * Đây là nơi DUY NHẤT áp dụng hao hụt rang trong toàn hệ thống — không áp
 * dụng lúc nhập kho, không áp dụng lúc bán. Mọi giá trị (giá nhân xanh, cấu
 * hình gas/bao bì/nhân công) đều lấy từ dữ liệu thực tế đã cấu hình, không
 * hard-code trong code.
 *
 * Công thức (đã khớp ví dụ trong spec): với hao hụt 20%, 1kg thành phẩm cần
 * 1.25kg nhân xanh (hệ số = 1 / (1 - hao hụt%)) — áp dụng hệ số này cho cả
 * giá nhân xanh và gas (đều tính trên nhân xanh tiêu thụ), còn bao bì/nhân
 * công/chi phí khác đã là chi phí TRÊN KG THÀNH PHẨM nên không nhân hệ số.
 */
export function computeRoastCost(params: {
  inputKg: number;
  shrinkagePercent: number;
  greenCostPricePerKg: number;
  config: RoastCostConfigRow;
  laborHours?: number | null;
}): RoastCostBreakdown {
  const { inputKg, shrinkagePercent, greenCostPricePerKg, config, laborHours } = params;
  if (shrinkagePercent < 0 || shrinkagePercent >= 100) {
    throw new ValidationError("Hao hụt rang phải từ 0 đến dưới 100%");
  }

  const finishedKg = inputKg * (1 - shrinkagePercent / 100);
  const shrinkageKg = inputKg - finishedKg;

  const greenBeanCost = Math.round(greenCostPricePerKg * inputKg);
  const gasCost = Math.round(config.gas_cost_per_kg_green * inputKg);
  const packagingCost = Math.round(config.packaging_cost_per_kg_finished * finishedKg);
  const otherCost = Math.round(config.other_cost_per_kg_finished * finishedKg);

  let laborCost = 0;
  const mode: LaborCostMode = config.labor_cost_mode;
  if (mode === "PER_KG_FINISHED") {
    laborCost = Math.round(config.labor_cost_value * finishedKg);
  } else if (mode === "PER_KG_GREEN") {
    laborCost = Math.round(config.labor_cost_value * inputKg);
  } else if (mode === "PER_HOUR") {
    if (!laborHours || laborHours <= 0) {
      throw new ValidationError("Cấu hình nhân công đang tính theo giờ — vui lòng nhập số giờ rang");
    }
    laborCost = Math.round(config.labor_cost_value * laborHours);
  } else if (mode === "PER_DAY") {
    if (!laborHours || laborHours <= 0) {
      throw new ValidationError("Cấu hình nhân công đang tính theo ngày — vui lòng nhập số ngày rang");
    }
    laborCost = Math.round(config.labor_cost_value * laborHours);
  }

  const totalCost = greenBeanCost + gasCost + laborCost + packagingCost + otherCost;
  const costPerKg = finishedKg > 0 ? Math.round(totalCost / finishedKg) : 0;

  return {
    finishedKg: Math.round(finishedKg * 1000) / 1000,
    shrinkageKg: Math.round(shrinkageKg * 1000) / 1000,
    greenBeanCost,
    gasCost,
    laborCost,
    packagingCost,
    otherCost,
    totalCost,
    costPerKg,
  };
}

export async function getRoastCostConfig(db: D1Database = getDb()): Promise<RoastCostConfigRow> {
  const row = await db.prepare(`SELECT * FROM roast_cost_config WHERE id = 1`).first<RoastCostConfigRow>();
  if (!row) throw new NotFoundError("Chưa có cấu hình chi phí rang");
  return row;
}

async function loadVariant(db: D1Database, id: string, expectedStage: "GREEN" | "ROASTED", label: string) {
  const row = await db
    .prepare(
      `SELECT pv.*, p.product_type as product_type, p.coffee_stage as coffee_stage FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = ?`
    )
    .bind(id)
    .first<ProductVariantRow & { product_type: string; coffee_stage: string | null }>();
  if (!row) throw new NotFoundError(`Không tìm thấy SKU ${label}`);
  if (row.product_type !== "COFFEE" || row.coffee_stage !== expectedStage) {
    const expectedLabel = expectedStage === "GREEN" ? "nhân xanh" : "cà phê rang rời";
    throw new ValidationError(`SKU ${label} phải thuộc nhóm ${expectedLabel}`);
  }
  return row;
}

export async function createRoastBatchDraft(
  params: {
    greenVariantId: string;
    roastedVariantId: string;
    inputKg: number;
    shrinkagePercent?: number;
    laborHours?: number;
    roastedBy?: string;
    note?: string;
    createdBy: string;
  },
  db: D1Database = getDb()
): Promise<RoastBatchRow> {
  if (params.inputKg <= 0) throw new ValidationError("Số lượng nhân xanh đưa vào rang phải lớn hơn 0");

  const green = await loadVariant(db, params.greenVariantId, "GREEN", "nhân xanh");
  const roasted = await loadVariant(db, params.roastedVariantId, "ROASTED", "cà phê rang");

  const greenInv = await db
    .prepare(`SELECT * FROM inventory WHERE product_variant_id = ?`)
    .bind(green.id)
    .first<InventoryRow>();
  if (!greenInv || greenInv.quantity_on_hand < params.inputKg) {
    throw new ConflictError(
      `Không đủ tồn nhân xanh: cần ${params.inputKg}kg, còn ${greenInv?.quantity_on_hand ?? 0}kg`
    );
  }

  const config = await getRoastCostConfig(db);
  const shrinkagePercent = params.shrinkagePercent ?? config.default_shrinkage_percent;
  const cost = computeRoastCost({
    inputKg: params.inputKg,
    shrinkagePercent,
    greenCostPricePerKg: green.cost_price,
    config,
    laborHours: params.laborHours,
  });

  const id = newId();
  const batchCode = await nextRoastBatchCode(db);

  await db
    .prepare(
      `INSERT INTO roast_batches
         (id, batch_code, green_variant_id, roasted_variant_id, input_kg, shrinkage_percent, finished_kg,
          shrinkage_kg, green_bean_cost, gas_cost, labor_cost, packaging_cost, other_cost, total_cost,
          cost_per_kg, labor_hours, status, roasted_by, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`
    )
    .bind(
      id,
      batchCode,
      green.id,
      roasted.id,
      params.inputKg,
      shrinkagePercent,
      cost.finishedKg,
      cost.shrinkageKg,
      cost.greenBeanCost,
      cost.gasCost,
      cost.laborCost,
      cost.packagingCost,
      cost.otherCost,
      cost.totalCost,
      cost.costPerKg,
      params.laborHours ?? null,
      params.roastedBy ?? null,
      params.note ?? null,
      params.createdBy
    )
    .run();

  const batch = await db.prepare(`SELECT * FROM roast_batches WHERE id = ?`).bind(id).first<RoastBatchRow>();
  return batch!;
}

export async function deleteRoastBatchDraft(id: string, db: D1Database = getDb()): Promise<void> {
  const batch = await db.prepare(`SELECT * FROM roast_batches WHERE id = ?`).bind(id).first<RoastBatchRow>();
  if (!batch) throw new NotFoundError("Không tìm thấy mẻ rang");
  if (batch.status !== "DRAFT") throw new ValidationError("Chỉ được xóa mẻ rang ở trạng thái nháp (chưa xác nhận)");
  await db.prepare(`DELETE FROM roast_batches WHERE id = ? AND status = 'DRAFT'`).bind(id).run();
}

/**
 * Xác nhận mẻ rang: trừ nhân xanh, cộng cà phê rang — đúng 1 lần duy nhất
 * (compare-and-set trên status='DRAFT', giống hệt cơ chế issueInventoryForOrder).
 */
export async function confirmRoastBatch(
  id: string,
  actingUserId: string,
  db: D1Database = getDb()
): Promise<RoastBatchRow> {
  const batch = await db.prepare(`SELECT * FROM roast_batches WHERE id = ?`).bind(id).first<RoastBatchRow>();
  if (!batch) throw new NotFoundError("Không tìm thấy mẻ rang");
  if (batch.status !== "DRAFT") throw new ConflictError("Mẻ rang này đã được xác nhận trước đó");

  const greenInv = await db
    .prepare(`SELECT * FROM inventory WHERE product_variant_id = ?`)
    .bind(batch.green_variant_id)
    .first<InventoryRow>();
  if (!greenInv || greenInv.quantity_on_hand < batch.input_kg) {
    throw new ConflictError(
      `Không đủ tồn nhân xanh để xác nhận: cần ${batch.input_kg}kg, còn ${greenInv?.quantity_on_hand ?? 0}kg`
    );
  }

  const cas = await db
    .prepare(`UPDATE roast_batches SET status = 'CONFIRMED', confirmed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND status = 'DRAFT'`)
    .bind(id)
    .run();
  if (!cas.meta.changes) {
    throw new ConflictError("Mẻ rang này đã được xác nhận trước đó (double-submit)");
  }

  const [greenSku, roastedSku] = await Promise.all([
    db.prepare(`SELECT sku FROM product_variants WHERE id = ?`).bind(batch.green_variant_id).first<{ sku: string }>(),
    db.prepare(`SELECT sku FROM product_variants WHERE id = ?`).bind(batch.roasted_variant_id).first<{ sku: string }>(),
  ]);

  await db.batch([
    db
      .prepare(
        `INSERT INTO inventory_transactions
           (id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note)
         VALUES (?, ?, ?, ?, 'ROAST_CONSUMPTION', 'ROAST_BATCH', ?, ?, ?)`
      )
      .bind(
        newId(),
        batch.green_variant_id,
        greenSku!.sku,
        -batch.input_kg,
        id,
        actingUserId,
        `Tiêu thụ rang mẻ ${batch.batch_code}`
      ),
    db
      .prepare(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand - ?, updated_at = datetime('now')
         WHERE product_variant_id = ?`
      )
      .bind(batch.input_kg, batch.green_variant_id),
    db
      .prepare(
        `INSERT INTO inventory_transactions
           (id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note)
         VALUES (?, ?, ?, ?, 'ROAST_PRODUCTION', 'ROAST_BATCH', ?, ?, ?)`
      )
      .bind(
        newId(),
        batch.roasted_variant_id,
        roastedSku!.sku,
        batch.finished_kg,
        id,
        actingUserId,
        `Thành phẩm rang mẻ ${batch.batch_code}`
      ),
    db
      .prepare(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now')
         WHERE product_variant_id = ?`
      )
      .bind(batch.finished_kg, batch.roasted_variant_id),
  ]);

  const updated = await db.prepare(`SELECT * FROM roast_batches WHERE id = ?`).bind(id).first<RoastBatchRow>();
  return updated!;
}
