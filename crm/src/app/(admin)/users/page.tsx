import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { UserStatusToggle } from "@/components/users/user-status-toggle";
import type { SafeUser } from "@/types/db";

export default async function UsersPage() {
  const session = await getSession();
  const db = getDb();
  const { results: users } = await db
    .prepare(
      `SELECT id, email, phone, full_name, role, status, created_at, updated_at FROM users ORDER BY created_at DESC`
    )
    .all<SafeUser>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Nhân viên</h1>
        <UserFormDialog />
      </div>
      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {u.full_name}
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                    {u.role === "ADMIN" ? "Quản lý" : "Nhân viên"}
                  </Badge>
                  <Badge variant={u.status === "ACTIVE" ? "success" : "danger"}>
                    {u.status === "ACTIVE" ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                  </Badge>
                </div>
                <div className="text-sm text-stone-500">
                  {u.email} {u.phone ? `· ${u.phone}` : ""}
                </div>
              </div>
              <UserStatusToggle user={u} isSelf={u.id === session!.user.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
