import { OrderBuilder } from "@/components/orders/order-builder";

export default function NewEquipmentOrderPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Tạo đơn Thiết bị</h1>
      <OrderBuilder mode="equipment" />
    </div>
  );
}
