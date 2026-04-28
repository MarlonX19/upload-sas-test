"use client";

import { type ReactNode, useId, useState } from "react";

import { cn } from "@/lib/cn";

export type FilterSectionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

/** Secção de filtro em acordeão (filtro.md): transição 200ms ease, acessível. */
export function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left transition-colors duration-200 ease-out hover:text-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        <span className="text-base font-semibold tracking-tight text-neutral-900">{title}</span>
        <span
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-transform duration-200 ease-out",
            open && "rotate-180",
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={title}
        className={cn("mt-4", !open && "hidden")}
      >
        {children}
      </div>
    </section>
  );
}
