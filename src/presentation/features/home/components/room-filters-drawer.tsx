"use client";

import { useEffect, useRef } from "react";

import type { RoomFiltersState } from "@/presentation/features/home/types/room-filters.types";
import { RoomFiltersPanel } from "@/presentation/features/home/components/room-filters-panel";
import { Button } from "@/presentation/shared/ui";
import { cn } from "@/lib/cn";

export type RoomFiltersDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: RoomFiltersState;
  onPatch: (patch: Partial<RoomFiltersState>) => void;
  onReset: () => void;
};

/**
 * Drawer lateral esquerdo em mobile (filtro.md).
 */
export function RoomFiltersDrawer({
  open,
  onOpenChange,
  filters,
  onPatch,
  onReset,
}: RoomFiltersDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector("button")?.focus();
  }, [open]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[180] bg-black/50 transition-opacity duration-200 ease-out lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!open}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros de quartos"
        className={cn(
          "fixed left-0 top-0 z-[190] flex h-full w-[min(100%,320px)] max-w-full flex-col border-r border-neutral-200 bg-neutral-50 shadow-hotel-lg transition-transform duration-200 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full pointer-events-none",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="text-base font-semibold text-neutral-900">Filtros</span>
          <Button
            type="button"
            variant="ghost"
            className="px-3 py-1.5 text-sm text-neutral-600"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <RoomFiltersPanel
            filters={filters}
            onPatch={onPatch}
            onReset={() => {
              onReset();
              onOpenChange(false);
            }}
            showFooterNote
          />
        </div>
      </div>
    </>
  );
}
