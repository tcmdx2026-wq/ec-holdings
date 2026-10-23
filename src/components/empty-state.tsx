import type { ReactNode } from "react";

export function EmptyState({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-surface-2/60 px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {desc ? <p className="mt-1 max-w-sm text-sm text-muted">{desc}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
