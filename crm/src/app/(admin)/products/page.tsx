import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { VariantFormDialog } from "@/components/products/variant-form-dialog";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { DeleteVariantButton } from "@/components/products/delete-variant-button";
import { ReceiveDeviceDialog } from "@/components/inventory/receive-device-dialog";
import { DEVICE_STATUS_LABEL } from "@/lib/services/devices";
import { PRODUCT_TYPE_LABEL, PRODUCT_TYPES } from "@/lib/constants";
import { formatVnd } from "@/lib/utils";
import type { DeviceStatus, ProductRow, ProductType, ProductVariantRow } from "@/types/db";

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

interface DeviceCount {
  product_variant_id: string;
  status: DeviceStatus;
  c: number;
}

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { type } = await searchParams;
  const db = getDb();

  const stmt = type
    ? db.prepare(`SELECT * FROM products WHERE product_type = ? ORDER BY created_at DESC`).bind(type)
    : db.prepare(`SELECT * FROM products ORDER BY created_at DESC`);
  const { results: products } = await stmt.all<ProductRow>();
  const { results: variants } = await db
    .prepare(`SELECT * FROM product_variants ORDER BY weight_grams ASC`)
    .all<ProductVariantRow>();
  const { results: deviceCounts } = await db
    .prepare(
      `SELECT product_variant_id, status, COUNT(*) as c FROM devices GROUP BY product_variant_id, status`
    )
    .all<DeviceCount>();

  const countsByVariant = new Map<string, DeviceCount[]>();
  for (const dc of deviceCounts) {
    const arr = countsByVariant.get(dc.product_variant_id) ?? [];
    arr.push(dc);
    countsByVariant.set(dc.product_variant_id, arr);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Sản phẩm</h1>
        <ProductFormDialog />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/products"
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
            !type ? "bg-amber-800 text-white" : "bg-white text-stone-600 border border-stone-200"
          }`}
        >
          Tất cả
        </Link>
        {PRODUCT_TYPES.map((t) => (
          <Link
            key={t}
            href={`/products?type=${t}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              type === t ? "bg-amber-800 text-white" : "bg-white text-stone-600 border border-stone-200"
            }`}
          >
            {PRODUCT_TYPE_LABEL[t]}
          </Link>
        ))}
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
          const isCoffee = p.product_type === "COFFEE";
          return (
            <Card key={p.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {p.name} <span className="text-stone-400 font-normal">· {p.code}</span>
                  </CardTitle>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary">{PRODUCT_TYPE_LABEL[p.product_type]}</Badge>
                    {!p.is_active && <Badge variant="secondary">Ngừng bán</Badge>}
                    {p.description && <p className="text-sm text-stone-500">{p.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <VariantFormDialog productId={p.id} productType={p.product_type as ProductType} />
                  <DeleteProductButton productId={p.id} productName={p.name} />
                </div>
              </CardHeader>
              <CardContent>
                {productVariants.length === 0 ? (
                  <div className="text-sm text-stone-500">Chưa có biến thể/SKU</div>
                ) : isCoffee ? (
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
                          <th className="py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {productVariants.map((v) => (
                          <tr key={v.id} className="border-b border-stone-100">
                            <td className="py-1.5 pr-3 font-mono text-xs">{v.sku}</td>
                            <td className="py-1.5 pr-3">{v.form ? FORM_LABEL[v.form] : "—"}</td>
                            <td className="py-1.5 pr-3">{v.packaging ? PACKAGING_LABEL[v.packaging] : "—"}</td>
                            <td className="py-1.5 pr-3">
                              {v.weight_grams == null
                                ? "—"
                                : v.weight_grams >= 1000
                                  ? `${v.weight_grams / 1000}kg`
                                  : `${v.weight_grams}g`}
                            </td>
                            <td className="py-1.5 pr-3">{formatVnd(v.unit_price)}</td>
                            <td className="py-1.5 pr-3">
                              <Badge variant={v.is_active ? "success" : "secondary"}>
                                {v.is_active ? "Đang bán" : "Ngừng bán"}
                              </Badge>
                            </td>
                            <td className="py-1.5">
                              <DeleteVariantButton variantId={v.id} sku={v.sku} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {productVariants.map((v) => {
                      const counts = countsByVariant.get(v.id) ?? [];
                      const total = counts.reduce((s, c) => s + c.c, 0);
                      return (
                        <div key={v.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-medium">
                                {v.sku}
                                {(v.brand || v.model) && (
                                  <span className="text-stone-400 font-normal">
                                    {" "}
                                    · {[v.brand, v.model].filter(Boolean).join(" ")}
                                  </span>
                                )}
                              </div>
                              <div className="text-stone-500">
                                {formatVnd(v.unit_price)}
                                {v.warranty_months ? ` · Bảo hành ${v.warranty_months} tháng` : ""}
                                {v.supplier ? ` · NCC: ${v.supplier}` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={v.is_active ? "success" : "secondary"}>
                                {v.is_active ? "Đang bán" : "Ngừng bán"}
                              </Badge>
                              <DeleteVariantButton variantId={v.id} sku={v.sku} />
                            </div>
                          </div>
                          {v.requires_serial ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-2">
                              <Link
                                href={`/devices?variantId=${v.id}`}
                                className="text-xs font-medium text-amber-800 hover:underline"
                              >
                                Tổng {total} máy
                              </Link>
                              {counts.map((c) => (
                                <span key={c.status} className="text-xs text-stone-500">
                                  {DEVICE_STATUS_LABEL[c.status]}: {c.c}
                                </span>
                              ))}
                              <div className="ml-auto">
                                <ReceiveDeviceDialog productId={p.id} variantId={v.id} sku={v.sku} />
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-stone-400">Không quản lý Serial</div>
                          )}
                        </div>
                      );
                    })}
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
