import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { QuotationBuilder } from "@/components/quotations/quotation-builder";
import type { QuotationItemRow, QuotationRow } from "@/types/db";

export default async function EditQuotationPage({ params }: PageProps<"/bao-gia/[id]/edit">) {
  const { id } = await params;
  const db = getDb();

  const quotation = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(id).first<QuotationRow>();
  if (!quotation) notFound();

  const { results: items } = await db
    .prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC`)
    .bind(id)
    .all<QuotationItemRow>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Sửa báo giá {quotation.quote_code}</h1>
      <QuotationBuilder initial={{ quotation, items }} />
    </div>
  );
}
