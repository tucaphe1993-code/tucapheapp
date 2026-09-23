import { QuotationBuilder } from "@/components/quotations/quotation-builder";

export default function NewQuotationPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Tạo báo giá</h1>
      <QuotationBuilder />
    </div>
  );
}
