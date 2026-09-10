import { OrderBuilder } from "@/components/orders/order-builder";

export default function NewOrderPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Tạo đơn hàng</h1>
      <OrderBuilder />
    </div>
  );
}
