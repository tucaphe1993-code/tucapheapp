import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { EmployeeShell } from "@/components/layout/employee-shell";

// Both roles may land here: an ADMIN can also be assigned tasks in theory,
// and the mobile packing flow itself has no admin-only data on it — the
// admin-only actions (edit stock, prices, delete orders) simply don't
// exist on these screens/API routes at all, not just hidden by CSS.
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return <EmployeeShell>{children}</EmployeeShell>;
}
