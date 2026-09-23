import { newId, nextOrderCode, nextQuoteCode } from "@/lib/db/id";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { OrderRow, QuotationItemRow, QuotationRow } from "@/types/db";

export interface QuoteLineInput {
  productVariantId?: string | null;
  productName: string;
  description?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  vatPercent?: number;
  // Dòng "chỉ để tham khảo giá" — hiển thị tên + đơn giá cho khách biết,
  // không cộng vào Tạm tính/Tổng cộng, không có "Thành tiền".
  isReference?: boolean;
}

export interface QuoteLineComputed extends QuoteLineInput {
  discountPercent: number;
  discountAmount: number;
  vatPercent: number;
  lineTotal: number;
  isReference: boolean;
}

export interface QuoteTotals {
  items: QuoteLineComputed[];
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  totalAmount: number;
}

/**
 * Tính tiền từng dòng + tổng báo giá — dùng chung cho tạo mới/sửa/nhân
 * bản. CK theo số tiền (discountAmount) ưu tiên hơn CK% nếu dòng đó có
 * điền cả hai — khớp đúng 2 chế độ chiết khấu mô tả trong spec (theo %
 * HOẶC theo số tiền, không cộng dồn cả hai).
 */
export function computeQuoteTotals(lines: QuoteLineInput[], shippingFee = 0): QuoteTotals {
  if (lines.length === 0) throw new ValidationError("Báo giá cần ít nhất 1 sản phẩm");

  let subtotal = 0;
  let totalDiscount = 0;
  let totalVat = 0;
  const items: QuoteLineComputed[] = lines.map((line) => {
    if (line.quantity <= 0) throw new ValidationError(`Số lượng "${line.productName}" phải lớn hơn 0`);
    if (line.unitPrice < 0) throw new ValidationError(`Đơn giá "${line.productName}" không hợp lệ`);

    // Dòng tham khảo: giữ nguyên tên/đơn giá để hiển thị, nhưng không tính
    // CK/VAT/Thành tiền và không cộng vào bất kỳ tổng nào bên dưới.
    if (line.isReference) {
      return {
        ...line,
        discountPercent: 0,
        discountAmount: 0,
        vatPercent: 0,
        lineTotal: 0,
        isReference: true,
      };
    }

    const lineSubtotal = line.unitPrice * line.quantity;
    const discountPercent = line.discountPercent ?? 0;
    const flatDiscount = line.discountAmount ?? 0;
    const discountAmount = flatDiscount > 0 ? Math.min(flatDiscount, lineSubtotal) : Math.round(lineSubtotal * (discountPercent / 100));
    const afterDiscount = lineSubtotal - discountAmount;
    const vatPercent = line.vatPercent ?? 0;
    const vatAmount = Math.round(afterDiscount * (vatPercent / 100));
    const lineTotal = afterDiscount + vatAmount;

    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
    totalVat += vatAmount;

    return {
      ...line,
      discountPercent: flatDiscount > 0 ? 0 : discountPercent,
      discountAmount,
      vatPercent,
      lineTotal,
      isReference: false,
    };
  });

  return {
    items,
    subtotal,
    discountAmount: totalDiscount,
    vatAmount: totalVat,
    totalAmount: subtotal - totalDiscount + totalVat + Math.max(0, shippingFee),
  };
}

export async function recordQuotationEvent(
  db: D1Database,
  params: { quotationId: string; action: string; note?: string | null; userId?: string | null }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO quotation_events (id, quotation_id, action, note, user_id) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(newId(), params.quotationId, params.action, params.note ?? null, params.userId ?? null)
    .run();
}

/**
 * Nhân bản báo giá — copy toàn bộ khách hàng/sản phẩm/giá/CK/VAT sang 1
 * báo giá Nháp mới, không đụng gì tới báo giá gốc.
 */
export async function duplicateQuotation(
  db: D1Database,
  params: { quotationId: string; createdBy: string }
): Promise<QuotationRow> {
  const source = await db
    .prepare(`SELECT * FROM quotations WHERE id = ?`)
    .bind(params.quotationId)
    .first<QuotationRow>();
  if (!source) throw new NotFoundError("Không tìm thấy báo giá");

  const { results: sourceItems } = await db
    .prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC`)
    .bind(params.quotationId)
    .all<QuotationItemRow>();

  const newQuoteId = newId();
  const newCode = await nextQuoteCode(db);
  const today = new Date().toISOString().slice(0, 10);

  await db
    .prepare(
      `INSERT INTO quotations
         (id, quote_code, customer_id, customer_name_snapshot, customer_phone_snapshot, customer_company_snapshot,
          customer_address_snapshot, customer_tax_code_snapshot, customer_email_snapshot, quote_date, valid_until,
          price_type, status, subtotal, discount_amount, vat_amount, shipping_fee, total_amount, note,
          public_token, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newQuoteId,
      newCode,
      source.customer_id,
      source.customer_name_snapshot,
      source.customer_phone_snapshot,
      source.customer_company_snapshot,
      source.customer_address_snapshot,
      source.customer_tax_code_snapshot,
      source.customer_email_snapshot,
      today,
      source.valid_until,
      source.price_type,
      source.subtotal,
      source.discount_amount,
      source.vat_amount,
      source.shipping_fee,
      source.total_amount,
      source.note,
      newId(),
      source.assigned_to,
      params.createdBy
    )
    .run();

  if (sourceItems.length > 0) {
    await db.batch(
      sourceItems.map((item) =>
        db
          .prepare(
            `INSERT INTO quotation_items
               (id, quotation_id, product_variant_id, product_name, description, unit, quantity, unit_price,
                discount_percent, discount_amount, vat_percent, line_total, sort_order, is_reference)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId(),
            newQuoteId,
            item.product_variant_id,
            item.product_name,
            item.description,
            item.unit,
            item.quantity,
            item.unit_price,
            item.discount_percent,
            item.discount_amount,
            item.vat_percent,
            item.line_total,
            item.sort_order,
            item.is_reference
          )
      )
    );
  }

  await recordQuotationEvent(db, {
    quotationId: newQuoteId,
    action: "CREATED",
    note: `Nhân bản từ báo giá ${source.quote_code}`,
    userId: params.createdBy,
  });

  const created = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(newQuoteId).first<QuotationRow>();
  return created!;
}

/**
 * Chuyển báo giá thành đơn hàng — CAS "khóa" trạng thái CONVERTED TRƯỚC
 * khi tạo order (giống hệt confirmPurchaseOrder: CAS trước, side-effect
 * sau) để 2 lần bấm liền nhau (double-submit) không bao giờ tạo 2 đơn.
 * Bấm lại sau khi đã chuyển sẽ trả về đúng đơn hàng đã tạo trước đó,
 * không lỗi, không tạo trùng.
 */
export async function convertQuotationToOrder(
  db: D1Database,
  params: { quotationId: string; actingUserId: string }
): Promise<{ order: OrderRow; created: boolean }> {
  const quotation = await db
    .prepare(`SELECT * FROM quotations WHERE id = ?`)
    .bind(params.quotationId)
    .first<QuotationRow>();
  if (!quotation) throw new NotFoundError("Không tìm thấy báo giá");

  if (quotation.status === "CONVERTED") {
    if (!quotation.converted_order_id) throw new ConflictError("Báo giá đã chuyển đơn nhưng thiếu liên kết đơn hàng");
    const existing = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(quotation.converted_order_id).first<OrderRow>();
    if (!existing) throw new ConflictError("Đơn hàng liên kết với báo giá này không còn tồn tại");
    return { order: existing, created: false };
  }
  if (!quotation.customer_id) {
    throw new ValidationError("Báo giá chưa gắn khách hàng có sẵn trong hệ thống — không thể chuyển thành đơn hàng");
  }

  const { results: allItems } = await db
    .prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC`)
    .bind(params.quotationId)
    .all<QuotationItemRow>();
  // Dòng "chỉ tham khảo giá" không phải hàng đang bán trong báo giá này —
  // bỏ qua, không đưa vào đơn hàng.
  const items = allItems.filter((i) => !i.is_reference);
  if (items.length === 0) throw new ValidationError("Báo giá chưa có sản phẩm nào (ngoài các dòng tham khảo giá)");
  const missingSku = items.find((i) => !i.product_variant_id);
  if (missingSku) {
    throw new ValidationError(
      `Dòng "${missingSku.product_name}" chưa gắn mã hàng có trong danh mục — sửa lại báo giá (chọn đúng sản phẩm trong danh mục) trước khi chuyển đơn`
    );
  }

  // CAS: khóa slot "đang chuyển đơn" trước khi làm gì khác.
  const cas = await db
    .prepare(`UPDATE quotations SET status = 'CONVERTED', converted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status != 'CONVERTED'`)
    .bind(params.quotationId)
    .run();
  if (!cas.meta.changes) {
    // Một request khác vừa chuyển xong trong lúc ta đang xử lý — đọc lại.
    const refreshed = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(params.quotationId).first<QuotationRow>();
    const existing = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(refreshed!.converted_order_id).first<OrderRow>();
    if (!existing) throw new ConflictError("Báo giá vừa được chuyển đơn ở nơi khác, vui lòng tải lại trang");
    return { order: existing, created: false };
  }

  // Cần sku thật (order_items.sku NOT NULL) — quotation_items không lưu
  // sku riêng, tra lại từ product_variants (đã đảm bảo mọi dòng đều có
  // product_variant_id ở bước validate phía trên).
  const variantIds = [...new Set(items.map((i) => i.product_variant_id as string))];
  const placeholders = variantIds.map(() => "?").join(",");
  const { results: variants } = await db
    .prepare(`SELECT id, sku, form, packaging, weight_grams FROM product_variants WHERE id IN (${placeholders})`)
    .bind(...variantIds)
    .all<{ id: string; sku: string; form: string | null; packaging: string | null; weight_grams: number | null }>();
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const orderId = newId();
  const orderCode = await nextOrderCode(db);

  await db
    .prepare(
      `INSERT INTO orders
         (id, order_code, customer_id, customer_phone_snapshot, customer_address_snapshot, note, status, total_amount, discount_amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?)`
    )
    .bind(
      orderId,
      orderCode,
      quotation.customer_id,
      quotation.customer_phone_snapshot,
      quotation.customer_address_snapshot,
      [quotation.note, `Chuyển từ báo giá ${quotation.quote_code}`].filter(Boolean).join(" — "),
      quotation.total_amount,
      quotation.discount_amount,
      params.actingUserId
    )
    .run();

  await db.batch(
    items.map((item) => {
      const variant = variantById.get(item.product_variant_id as string);
      return db
        .prepare(
          `INSERT INTO order_items
             (id, order_id, product_variant_id, sku, product_name, form, packaging, weight_grams, quantity, unit_price, discount_percent, tax_percent, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          newId(),
          orderId,
          item.product_variant_id,
          variant?.sku ?? item.product_name,
          item.product_name,
          variant?.form ?? null,
          variant?.packaging ?? null,
          variant?.weight_grams ?? null,
          item.quantity,
          item.unit_price,
          item.discount_percent,
          item.vat_percent,
          item.line_total
        );
    })
  );

  await db
    .prepare(`UPDATE quotations SET converted_order_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(orderId, params.quotationId)
    .run();

  await recordQuotationEvent(db, {
    quotationId: params.quotationId,
    action: "CONVERTED",
    note: `Đã tạo đơn hàng ${orderCode}`,
    userId: params.actingUserId,
  });

  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
  return { order: order!, created: true };
}
