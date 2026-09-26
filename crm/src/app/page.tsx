import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function RootPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  // Chủ/quản lý mở app là vào thẳng TÚ QUICK (ghi đơn nhanh); Dashboard
  // vẫn ở /dashboard, vào từ tab "Thêm".
  redirect(session.user.role === "ADMIN" ? "/quick" : "/my-tasks");
}
