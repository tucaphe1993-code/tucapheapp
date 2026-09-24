import { getDb } from "@/lib/db/client";
import { loadQuickFormData } from "@/lib/services/quick";
import { QuickOrderForm } from "@/components/quick/quick-order-form";

export default async function QuickNewOrderPage() {
  const data = await loadQuickFormData(getDb());
  return <QuickOrderForm data={data} />;
}
