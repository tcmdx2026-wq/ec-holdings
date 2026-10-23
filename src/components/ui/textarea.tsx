import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md bg-surface px-3 py-2.5 text-sm text-ink shadow-[var(--shadow-card)] placeholder:text-faint",
        "transition-[box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-accent/35",
        className,
      )}
      {...props}
    />
  );
}
