import { PurchaseOrderBuilder } from "@/components/purchasing/purchase-order-builder";

export default function NewPurchaseOrderPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Tạo đơn mua hàng</h1>
      <PurchaseOrderBuilder />
    </div>
  );
}
