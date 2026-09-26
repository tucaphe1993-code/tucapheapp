import type { ButtonHTMLAttributes } from "react";

export function Chip({
  selected,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`h-11 shrink-0 rounded-full border px-4 text-[15px] font-semibold ${
        selected ? "border-moss-700 bg-moss-700 text-white" : "border-stone-200 bg-white text-stone-900 active:bg-moss-50"
      } ${className}`}
      {...props}
    />
  );
}
