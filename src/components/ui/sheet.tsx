import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { side?: "left" | "right" | "bottom" }) {
  const pos =
    side === "left"
      ? "inset-y-0 left-0 h-full w-[min(20rem,50vw)]"
      : side === "bottom"
        ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl"
        : "inset-y-0 right-0 h-full w-[min(20rem,50vw)]";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <DialogPrimitive.Content
        className={cn("fixed z-50 overflow-y-auto bg-surface p-4 shadow-[var(--shadow-card-hover)]", pos, className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-sm text-muted hover:bg-surface-2">
          <X className="size-4" />
          <span className="sr-only">Đóng</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("pr-8 text-base font-semibold text-ink", className)} {...props} />;
}
