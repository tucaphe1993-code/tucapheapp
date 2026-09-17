import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { recordCashVoucher } from "@/lib/services/cash";
import { handleApiError, ValidationError } from "@/lib/api/errors";

interface CashVoucherListRow {
  id: string;
  voucher_code: string;
  direction: string;
  voucher_date: string;
  category: string;
  expense_group: string | null;
  payment_method_code: string | null;
  amount: number;
  description: string | null;
  note: string | null;
  is_auto: number;
  customer_name: string | null;
  supplier_name: string | null;
  created_by_name: string | null;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const direction = req.nextUrl.searchParams.get("direction");
    const isAuto = req.nextUrl.searchParams.get("isAuto");

    const conditions: string[] = [];
    const binds: unknown[] = [];
    if (direction) {
      conditions.push("v.direction = ?");
      binds.push(direction);
    }
    if (isAuto !== null) {
      conditions.push("v.is_auto = ?");
      binds.push(isAuto === "true" ? 1 : 0);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { results } = await db
      .prepare(
        `SELECT v.id, v.voucher_code, v.direction, v.voucher_date, v.category, v.expense_group,
                v.payment_method_code, v.amount, v.description, v.note, v.is_auto,
                c.name as customer_name, s.name as supplier_name, u.full_name as created_by_name
         FROM cash_vouchers v
         LEFT JOIN customers c ON c.id = v.customer_id
         LEFT JOIN suppliers s ON s.id = v.supplier_id
         LEFT JOIN users u ON u.id = v.created_by
         ${where}
         ORDER BY v.voucher_date DESC, v.created_at DESC
         LIMIT 300`
      )
      .bind(...binds)
      .all<CashVoucherListRow>();

    return NextResponse.json({ vouchers: results });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  direction: z.enum(["IN", "OUT"]),
  customerId: z.string().min(1).optional(),
  supplierId: z.string().min(1).optional(),
  expenseGroup: z.string().trim().optional(),
  paymentMethodCode: z.string().trim().optional(),
  amount: z.number().int().positive(),
  description: z.string().trim().optional(),
  note: z.string().trim().optional(),
  voucherDate: z.string().trim().optional(),
});

/**
 * Chỉ dùng để tạo phiếu THỦ CÔNG, KHÔNG gắn đơn bán/đơn mua (Thu khác /
 * Chi phí hoạt động) — thu tiền đơn bán vẫn qua /api/orders/[id]/payments,
 * trả nợ NCC vẫn qua /api/purchase-orders/[id]/payments (tự động mirror
 * vào đây), tránh 2 luồng cùng ghi đè công nợ.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const d = parsed.data;

    const voucher = await recordCashVoucher(
      {
        direction: d.direction,
        category: "OTHER",
        customerId: d.customerId ?? null,
        supplierId: d.supplierId ?? null,
        expenseGroup: d.expenseGroup ?? null,
        paymentMethodCode: d.paymentMethodCode ?? null,
        amount: d.amount,
        description: d.description ?? null,
        note: d.note ?? null,
        isAuto: false,
        createdBy: session.user.id,
        voucherDate: d.voucherDate ? new Date(d.voucherDate).toISOString() : undefined,
      },
      getDb()
    );

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_CASH_VOUCHER",
      entity: "cash_voucher",
      metadata: { direction: d.direction, amount: d.amount },
    });

    return NextResponse.json({ voucher }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
