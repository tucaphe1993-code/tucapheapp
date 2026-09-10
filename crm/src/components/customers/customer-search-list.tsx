"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { CustomerRow } from "@/types/db";

export function CustomerSearchList({ initialCustomers }: { initialCustomers: CustomerRow[] }) {
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState(initialCustomers);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers);
        }
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          className="pl-9"
          placeholder="Tìm theo tên hoặc số điện thoại..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        {customers.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-stone-500">
              Không có khách hàng nào
            </CardContent>
          </Card>
        )}
        {customers.map((c) => (
          <Link key={c.id} href={`/customers/${c.id}`}>
            <Card className="transition-colors hover:border-amber-300">
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-stone-900">{c.name}</div>
                  <div className="text-sm text-stone-500">
                    {c.phone || "—"} {c.province ? `· ${c.province}` : ""}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
