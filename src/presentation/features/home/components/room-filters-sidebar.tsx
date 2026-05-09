"use client";

import type { RoomFiltersState } from "@/presentation/features/home/types/room-filters.types";
import { RoomFiltersPanel } from "@/presentation/features/home/components/room-filters-panel";
import { cn } from "@/lib/cn";

export type RoomFiltersSidebarProps = {
  filters: RoomFiltersState;
  onPatch: (patch: Partial<RoomFiltersState>) => void;
  onReset: () => void;
  className?: string;
};

/**
 * Sidebar fixa desktop (filtro.md): ~280–320px, fundo neutral-50, scroll interno.
 */
export function RoomFiltersSidebar({ filters, onPatch, onReset, className }: RoomFiltersSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden w-[min(100%,320px)] shrink-0 border-r border-neutral-200 bg-neutral-50 lg:block",
        "lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-hidden",
        className,
      )}
      aria-label="Filtros de resultados"
    >
      <div className="h-full overflow-y-auto p-6">
        <RoomFiltersPanel filters={filters} onPatch={onPatch} onReset={onReset} />
      </div>
    </aside>
  );
}
