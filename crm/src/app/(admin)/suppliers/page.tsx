import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { formatVnd } from "@/lib/utils";
import type { SupplierRow } from "@/types/db";

export default async function SuppliersPage() {
  const db = getDb();
  const { results } = await db
    .prepare(`SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY created_at DESC`)
    .all<SupplierRow>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Nhà cung cấp</h1>
        <SupplierFormDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                  <th className="p-3">Mã NCC</th>
                  <th className="p-3">Tên nhà cung cấp</th>
                  <th className="p-3">SĐT</th>
                  <th className="p-3">Địa chỉ</th>
                  <th className="p-3">Hạn mức</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((s) => (
                  <tr key={s.id} className="border-b border-stone-100">
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 text-stone-500">{s.phone ?? "—"}</td>
                    <td className="p-3 text-stone-500">{s.address ?? "—"}</td>
                    <td className="p-3 text-stone-500">{s.credit_limit > 0 ? formatVnd(s.credit_limit) : "—"}</td>
                    <td className="p-3">
                      <SupplierFormDialog
                        supplier={s}
                        trigger={
                          <Button size="sm" variant="outline">
                            Sửa
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-stone-500">
                      Chưa có nhà cung cấp nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
