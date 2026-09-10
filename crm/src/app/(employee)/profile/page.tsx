import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/layout/logout-button";

export default async function ProfilePage() {
  const session = await getSession();
  const user = session!.user;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-bold">👤 Cá nhân</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{user.full_name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <div>
            <span className="text-stone-500">Email: </span>
            {user.email}
          </div>
          {user.phone && (
            <div>
              <span className="text-stone-500">SĐT: </span>
              {user.phone}
            </div>
          )}
          <div>
            <span className="text-stone-500">Vai trò: </span>
            {user.role === "ADMIN" ? "Quản lý" : "Nhân viên"}
          </div>
        </CardContent>
      </Card>
      <LogoutButton className="w-full justify-center border border-stone-200 bg-white" />
    </div>
  );
}
