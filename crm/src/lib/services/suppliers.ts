import { getDb } from "@/lib/db/client";
import { newId, nextSupplierCode } from "@/lib/db/id";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import type { SupplierRow } from "@/types/db";

export async function createSupplier(
  params: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
    note?: string;
  },
  db: D1Database = getDb()
): Promise<SupplierRow> {
  if (!params.name.trim()) throw new ValidationError("Tên nhà cung cấp bắt buộc");

  const id = newId();
  const code = await nextSupplierCode(db);
  await db
    .prepare(
      `INSERT INTO suppliers (id, code, name, phone, email, address, credit_limit, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      code,
      params.name.trim(),
      params.phone?.trim() || null,
      params.email?.trim() || null,
      params.address?.trim() || null,
      params.creditLimit ?? 0,
      params.note?.trim() || null
    )
    .run();

  const supplier = await db.prepare(`SELECT * FROM suppliers WHERE id = ?`).bind(id).first<SupplierRow>();
  return supplier!;
}

export async function updateSupplier(
  id: string,
  params: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
    note?: string;
  },
  db: D1Database = getDb()
): Promise<SupplierRow> {
  const existing = await db.prepare(`SELECT * FROM suppliers WHERE id = ?`).bind(id).first<SupplierRow>();
  if (!existing) throw new NotFoundError("Không tìm thấy nhà cung cấp");

  await db
    .prepare(
      `UPDATE suppliers SET
         name = ?, phone = ?, email = ?, address = ?, credit_limit = ?, note = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      params.name?.trim() || existing.name,
      params.phone?.trim() ?? existing.phone,
      params.email?.trim() ?? existing.email,
      params.address?.trim() ?? existing.address,
      params.creditLimit ?? existing.credit_limit,
      params.note?.trim() ?? existing.note,
      id
    )
    .run();

  const updated = await db.prepare(`SELECT * FROM suppliers WHERE id = ?`).bind(id).first<SupplierRow>();
  return updated!;
}
