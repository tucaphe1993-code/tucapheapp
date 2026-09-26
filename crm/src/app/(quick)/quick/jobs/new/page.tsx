import { getDb } from "@/lib/db/client";
import { loadQuickCustomers } from "@/lib/services/quick";
import { QuickJobForm } from "@/components/quick/quick-job-form";

export default async function QuickNewJobPage() {
  const customers = await loadQuickCustomers(getDb());
  return <QuickJobForm customers={customers} />;
}
