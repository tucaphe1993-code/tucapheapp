import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoastConfigForm } from "@/components/inventory/roast-config-form";
import { getRoastCostConfig } from "@/lib/services/roasting";

export default async function InventoryConfigPage() {
  const config = await getRoastCostConfig();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Cấu hình tỷ lệ chuyển đổi</h1>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Tỷ lệ hao hụt khi rang, dùng để tự quy đổi khi bán</CardTitle>
        </CardHeader>
        <CardContent>
          <RoastConfigForm config={config} />
        </CardContent>
      </Card>
    </div>
  );
}
