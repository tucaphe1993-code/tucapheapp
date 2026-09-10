import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { VariantFormDialog } from "@/components/products/variant-form-dialog";
import { formatVnd } from "@/lib/utils";
import type { ProductRow, ProductVariantRow } from "@/types/db";

const FORM_LABEL = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

export default async function ProductsPage() {
  const db = getDb();
  const { results: products } = await db
    .prepare(`SELECT * FROM products ORDER BY created_at DESC`)
    .all<ProductRow>();
  const { results: variants } = await db
    .prepare(`SELECT * FROM product_variants ORDER BY weight_grams ASC`)
    .all<ProductVariantRow>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Sản phẩm</h1>
        <ProductFormDialog />
      </div>

      <div className="grid gap-4">
        {products.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-stone-500">
              Chưa có dòng sản phẩm nào
            </CardContent>
          </Card>
        )}
        {products.map((p) => {
          const productVariants = variants.filter((v) => v.product_id === p.id);
          return (
            <Card key={p.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {p.name} <span className="text-stone-400 font-normal">· {p.code}</span>
                  </CardTitle>
                  {p.description && (
                    <p className="text-sm text-stone-500">{p.description}</p>
                  )}
                </div>
                <VariantFormDialog productId={p.id} />
              </CardHeader>
              <CardContent>
                {productVariants.length === 0 ? (
                  <div className="text-sm text-stone-500">Chưa có biến thể/SKU</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-left text-stone-500">
                          <th className="py-1.5 pr-3">SKU</th>
                          <th className="py-1.5 pr-3">Hình thức</th>
                          <th className="py-1.5 pr-3">Bao bì</th>
                          <th className="py-1.5 pr-3">Quy cách</th>
                          <th className="py-1.5 pr-3">Giá bán</th>
                          <th className="py-1.5 pr-3">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productVariants.map((v) => (
                          <tr key={v.id} className="border-b border-stone-100">
                            <td className="py-1.5 pr-3 font-mono text-xs">{v.sku}</td>
                            <td className="py-1.5 pr-3">{FORM_LABEL[v.form]}</td>
                            <td className="py-1.5 pr-3">{PACKAGING_LABEL[v.packaging]}</td>
                            <td className="py-1.5 pr-3">
                              {v.weight_grams >= 1000
                                ? `${v.weight_grams / 1000}kg`
                                : `${v.weight_grams}g`}
                            </td>
                            <td className="py-1.5 pr-3">{formatVnd(v.unit_price)}</td>
                            <td className="py-1.5 pr-3">
                              <Badge variant={v.is_active ? "success" : "secondary"}>
                                {v.is_active ? "Đang bán" : "Ngừng bán"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
