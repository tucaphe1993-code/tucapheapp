import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { InstallationDetailClient } from "@/components/installations/installation-detail-client";
import type { CustomerRow, InstallationChecklistRow, InstallationRow, OrderRow, UserRow } from "@/types/db";

export default async function AdminInstallationDetailPage({
  params,
}: PageProps<"/installations/[id]">) {
  const { id } = await params;
  const db = getDb();

  const installation = await db
    .prepare(`SELECT * FROM installations WHERE id = ?`)
    .bind(id)
    .first<InstallationRow>();
  if (!installation) notFound();

  const [order, customer, technician, { results: checklist }] = await Promise.all([
    db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(installation.order_id).first<OrderRow>(),
    db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(installation.customer_id).first<CustomerRow>(),
    installation.technician_id
      ? db.prepare(`SELECT * FROM users WHERE id = ?`).bind(installation.technician_id).first<UserRow>()
      : Promise.resolve(null),
    db
      .prepare(`SELECT * FROM installation_checklists WHERE installation_id = ? ORDER BY sort_order ASC`)
      .bind(id)
      .all<InstallationChecklistRow>(),
  ]);
  if (!order) notFound();

  return (
    <InstallationDetailClient
      installation={installation}
      order={order}
      customer={customer}
      checklist={checklist}
      technicianName={technician?.full_name ?? null}
      isAdmin
    />
  );
}
