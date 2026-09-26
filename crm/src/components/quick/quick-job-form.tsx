"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { QuickCustomer, QuickJob } from "@/lib/services/quick";
import { Chip } from "./chip";
import { ActionBar, CustomerPicker, DateField, Field, Header, postJson } from "./form-parts";

// Việc hay gặp của nhà rang/bán máy — bấm là điền, vẫn gõ thêm được.
const TITLE_PRESETS = ["Sửa máy", "Bảo trì máy", "Lắp máy", "Giao hàng", "Thu tiền", "Gọi lại khách"];

async function sendJson(url: string, method: "PATCH" | "DELETE", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
  return data;
}

/** Thêm mới (job = undefined) hoặc sửa 1 công việc hẹn nhanh. */
export function QuickJobForm({ customers, job }: { customers: QuickCustomer[]; job?: QuickJob }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(job?.customer_id ?? null);
  const [newCustomerName, setNewCustomerName] = useState<string | null>(null);
  const [title, setTitle] = useState(job?.title ?? "");
  const [dueDate, setDueDate] = useState<string | null>(job?.due_date ?? null);
  const [note, setNote] = useState(job?.note ?? "");
  const [saving, setSaving] = useState(false);

  const customer = customers.find((c) => c.id === customerId) ?? null;

  function done(message: string) {
    toast.success(message);
    router.replace("/quick");
    router.refresh();
  }

  async function run(action: () => Promise<void>) {
    setSaving(true);
    try {
      await action();
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  const save = () =>
    run(async () => {
      let cid = customerId;
      if (!cid && newCustomerName) cid = (await postJson("/api/customers", { name: newCustomerName })).customer.id;
      const body = { customerId: cid, title: title.trim(), dueDate, note: note.trim() || null };
      if (job) await sendJson(`/api/quick-jobs/${job.id}`, "PATCH", body);
      else await postJson("/api/quick-jobs", body);
      done(job ? "Đã cập nhật việc" : "Đã lưu việc ✓");
    });

  return (
    <>
      <Header title={job ? "Sửa công việc" : "Thêm công việc"} onBack={() => router.push("/quick")} />
      <div className="pb-4">
        <Field label="Khách hàng (không bắt buộc)">
          <CustomerPicker
            customers={customers}
            selected={customer}
            newName={newCustomerName}
            onChange={(v) => {
              setCustomerId(v.customerId);
              setNewCustomerName(v.newCustomerName);
            }}
          />
        </Field>

        <Field label="Việc cần làm">
          <div className="flex flex-wrap gap-2">
            {TITLE_PRESETS.map((t) => (
              <Chip key={t} selected={title === t} onClick={() => setTitle(t)}>
                {t}
              </Chip>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Hoặc gõ việc khác…"
            className="mt-3 h-13 w-full rounded-xl border border-stone-200 bg-white px-4 text-lg outline-none focus:border-moss-500"
          />
        </Field>

        <DateField label="Ngày hẹn" value={dueDate} onChange={setDueDate} />

        <Field label="Ghi chú">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Máy không lên nhiệt, mang theo gioăng…"
            className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 outline-none focus:border-moss-500"
          />
        </Field>

        {job && (
          <section className="flex gap-3 px-5 pt-8">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                run(async () => {
                  await sendJson(`/api/quick-jobs/${job.id}`, "PATCH", { status: job.status === "OPEN" ? "DONE" : "OPEN" });
                  done(job.status === "OPEN" ? "Đã xong việc ✓" : "Đã mở lại việc");
                })
              }
              className="h-12 flex-1 rounded-xl border-2 border-moss-600 font-bold text-moss-700 active:bg-moss-50"
            >
              {job.status === "OPEN" ? "✓ Đánh dấu xong" : "Mở lại việc"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (!window.confirm("Xoá hẳn việc này?")) return;
                void run(async () => {
                  await sendJson(`/api/quick-jobs/${job.id}`, "DELETE");
                  done("Đã xoá việc");
                });
              }}
              className="h-12 flex-1 rounded-xl border border-red-200 bg-white font-bold text-red-700 active:bg-red-50"
            >
              Xoá
            </button>
          </section>
        )}
      </div>
      <ActionBar>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!title.trim() || saving}
          className="h-14 w-full rounded-2xl bg-moss-700 text-lg font-extrabold text-white active:bg-moss-800 disabled:bg-stone-300 disabled:text-stone-600"
        >
          {saving ? "Đang lưu…" : title.trim() ? "LƯU VIỆC" : "Chọn việc cần làm"}
        </button>
      </ActionBar>
    </>
  );
}
