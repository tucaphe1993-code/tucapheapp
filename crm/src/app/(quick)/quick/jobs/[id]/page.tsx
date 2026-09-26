import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { loadQuickCustomers, loadQuickJob } from "@/lib/services/quick";
import { QuickJobForm } from "@/components/quick/quick-job-form";

export default async function QuickEditJobPage({ params }: PageProps<"/quick/jobs/[id]">) {
  const { id } = await params;
  const db = getDb();
  const [job, customers] = await Promise.all([loadQuickJob(db, id), loadQuickCustomers(db)]);
  if (!job) notFound();
  return <QuickJobForm customers={customers} job={job} />;
}
