import { getDb } from "@/lib/db/client";
import { CustomerSearchList } from "@/components/customers/customer-search-list";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import type { CustomerRow } from "@/types/db";

export default async function CustomersPage() {
  const db = getDb();
  const { results } = await db
    .prepare(`SELECT * FROM customers WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 100`)
    .all<CustomerRow>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Khách hàng</h1>
        <CustomerFormDialog />
      </div>
      <CustomerSearchList initialCustomers={results} />
    </div>
  );
}
