import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { AuditLogRow } from "@/types/db";

interface AuditLogJoined extends AuditLogRow {
  user_name: string | null;
}

export default async function AuditLogsPage() {
  const db = getDb();
  const { results: logs } = await db
    .prepare(
      `SELECT al.*, u.full_name as user_name FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 200`
    )
    .all<AuditLogJoined>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Nhật ký hệ thống</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Người thực hiện</th>
                  <th className="p-3">Hành động</th>
                  <th className="p-3">Đối tượng</th>
                  <th className="p-3">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-stone-100 align-top">
                    <td className="whitespace-nowrap p-3 text-stone-500">{formatDateTime(log.created_at)}</td>
                    <td className="p-3">{log.user_name ?? "—"}</td>
                    <td className="p-3 font-medium">{log.action}</td>
                    <td className="p-3 font-mono text-xs">
                      {log.entity}
                      {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ""}
                    </td>
                    <td className="max-w-xs truncate p-3 text-xs text-stone-400">{log.metadata}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
