import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone = "success" | "neutral" | "primary";

const tones: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/90",
  neutral: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200/80",
  primary: "bg-primary-100 text-primary-800 ring-1 ring-primary-200/80",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
