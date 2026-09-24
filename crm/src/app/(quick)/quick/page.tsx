import { getDb } from "@/lib/db/client";
import { loadQuickHome } from "@/lib/services/quick";
import { QuickHome } from "@/components/quick/quick-home";
import { QuickNav } from "@/components/quick/quick-nav";

// Màn hình mở app của chủ/quản lý: GHI NHANH + đơn hôm nay (dữ liệu CRM thật).
export default async function QuickPage() {
  const data = await loadQuickHome(getDb());
  return (
    <>
      <QuickHome data={data} />
      <QuickNav />
    </>
  );
}
