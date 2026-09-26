"use client";

import { useSyncExternalStore } from "react";
import { toDateKey } from "@/lib/quick";

const noopSubscribe = () => () => {};

/**
 * Ngày hôm nay ('YYYY-MM-DD') theo giờ ĐIỆN THOẠI. Máy chủ (Worker) chạy giờ
 * UTC nên lúc render trên server trả null — tránh lệch ngày 0h–7h sáng VN.
 */
export function useToday(): string | null {
  return useSyncExternalStore(noopSubscribe, () => toDateKey(new Date()), () => null);
}
