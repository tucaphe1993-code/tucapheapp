import { FreeformOrderBuilder } from "@/components/orders/freeform-order-builder";

export default function NewFreeformOrderPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Đơn hàng tự do</h1>
        <p className="text-sm text-stone-500">
          Dành cho máy pha/máy xay cà phê cũ, đã qua sử dụng — không có trong danh mục. Tự nhập tên, đơn giá, số tháng
          bảo hành cho từng dòng, không quản lý theo Serial.
        </p>
      </div>
      <FreeformOrderBuilder />
    </div>
  );
}
