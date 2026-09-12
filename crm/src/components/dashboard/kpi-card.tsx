import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COLOR_MAP = {
  purple: "bg-purple-100 text-purple-700",
  emerald: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  stone: "bg-stone-100 text-stone-600",
} as const;

const SUB_TONE_MAP = {
  positive: "text-emerald-700",
  negative: "text-red-600",
  warning: "text-amber-700",
  neutral: "text-stone-400",
} as const;

export function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
  subTone = "neutral",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  color: keyof typeof COLOR_MAP;
  sub?: string;
  subTone?: keyof typeof SUB_TONE_MAP;
  href?: string;
}) {
  const card = (
    <Card className={cn("p-3.5", href && "transition-colors hover:border-amber-300")}>
      <div className="flex items-start gap-2.5">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", COLOR_MAP[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs leading-tight text-stone-500">{label}</div>
          <div className="whitespace-nowrap text-sm font-bold leading-tight text-stone-900">{value}</div>
          {sub && <div className={cn("mt-0.5 break-words text-xs leading-snug", SUB_TONE_MAP[subTone])}>{sub}</div>}
        </div>
      </div>
    </Card>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}
