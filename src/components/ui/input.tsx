import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md bg-surface px-3 text-sm text-ink shadow-[var(--shadow-card)] placeholder:text-faint",
        "transition-[box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-accent/35",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
