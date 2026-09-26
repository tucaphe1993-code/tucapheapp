import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

// TÚ QUICK — màn ghi đơn nhanh của chủ/quản lý (ADMIN). Không dùng
// AdminShell (sidebar) để giữ giao diện checklist gọn trên điện thoại.
export default async function QuickLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/my-tasks");

  return <div className="mx-auto min-h-dvh w-full max-w-md bg-[#fafaf6] text-stone-900">{children}</div>;
}
