import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoastConfigForm } from "@/components/inventory/roast-config-form";
import { getRoastCostConfig } from "@/lib/services/roasting";

export default async function RoastConfigPage() {
  const config = await getRoastCostConfig();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Cấu hình chi phí rang</h1>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Các thông số dùng để tính giá vốn/kg khi rang</CardTitle>
        </CardHeader>
        <CardContent>
          <RoastConfigForm config={config} />
        </CardContent>
      </Card>
    </div>
  );
}
