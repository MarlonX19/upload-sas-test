"use client";

import type { RoomFiltersState } from "@/presentation/features/home/types/room-filters.types";
import { FilterSection } from "@/presentation/features/home/components/filter-section";
import { PriceRangeFilter } from "@/presentation/features/home/components/price-range-filter";
import { Button } from "@/presentation/shared/ui";

const GUEST_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const BED_COUNTS = [1, 2, 3, 4] as const;

export type RoomFiltersPanelProps = {
  filters: RoomFiltersState;
  onPatch: (patch: Partial<RoomFiltersState>) => void;
  onReset: () => void;
  showFooterNote?: boolean;
};

export function RoomFiltersPanel({ filters, onPatch, onReset, showFooterNote }: RoomFiltersPanelProps) {
  const f = filters;

  function toggleBed(n: number) {
    const has = f.beds.includes(n);
    onPatch({ beds: has ? f.beds.filter((x) => x !== n) : [...f.beds, n].sort((a, b) => a - b) });
  }

  const checkboxClass =
    "h-4 w-4 rounded border-neutral-300 text-primary-600 transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="mb-6 flex shrink-0 items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Filtros</h2>
        <Button
          type="button"
          variant="ghost"
          className="shrink-0 px-2 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
          onClick={onReset}
        >
          Limpar filtros
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        <FilterSection title="Faixa de preço (por noite)" defaultOpen>
          <PriceRangeFilter
            minBound={0}
            maxBound={2000}
            step={50}
            value={f.priceRange}
            onChange={(priceRange) => onPatch({ priceRange })}
          />
        </FilterSection>

        <FilterSection title="Capacidade (hóspedes)" defaultOpen>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-guests-min" className="text-xs font-medium text-neutral-600">
                Mínimo
              </label>
              <select
                id="filter-guests-min"
                value={f.guests.min}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onPatch({ guests: { min: v, max: Math.max(v, f.guests.max) } });
                }}
                className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 shadow-sm transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                {GUEST_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-guests-max" className="text-xs font-medium text-neutral-600">
                Máximo
              </label>
              <select
                id="filter-guests-max"
                value={f.guests.max}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onPatch({ guests: { min: Math.min(f.guests.min, v), max: v } });
                }}
                className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 shadow-sm transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                {GUEST_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            Filtra por lotação máxima da categoria (nº de pessoas).
          </p>
        </FilterSection>

        <FilterSection title="Conforto" defaultOpen={false}>
          <label className="flex cursor-pointer items-center gap-3 rounded-md py-1 transition-colors duration-150 ease-out hover:bg-neutral-100/80">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={f.hasAirConditioning}
              onChange={(e) => onPatch({ hasAirConditioning: e.target.checked })}
            />
            <span className="text-sm font-medium text-neutral-800">Ar condicionado</span>
          </label>
        </FilterSection>

        <FilterSection title="Camas" defaultOpen={false}>
          <fieldset>
            <legend className="sr-only">Número de camas</legend>
            <div className="flex flex-wrap gap-3">
              {BED_COUNTS.map((n) => (
                <label
                  key={n}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition-colors duration-150 ease-out hover:border-primary-300 hover:bg-primary-50/50"
                >
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={f.beds.includes(n)}
                    onChange={() => toggleBed(n)}
                  />
                  {n} {n === 1 ? "cama" : "camas"}
                </label>
              ))}
            </div>
          </fieldset>
        </FilterSection>

        <FilterSection title="Tipo de cama" defaultOpen={false}>
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={f.bedType.double}
                onChange={(e) => onPatch({ bedType: { ...f.bedType, double: e.target.checked } })}
              />
              <span className="text-sm text-neutral-800">Cama casal / duplo / king</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={f.bedType.single}
                onChange={(e) => onPatch({ bedType: { ...f.bedType, single: e.target.checked } })}
              />
              <span className="text-sm text-neutral-800">Twin / individuais</span>
            </label>
          </div>
        </FilterSection>

        <FilterSection title="Comodidades" defaultOpen={false}>
          <div className="flex flex-col gap-3">
            {(
              [
                ["breakfast", "Pequeno-almoço"],
                ["cleaning", "Serviço de limpeza"],
                ["wifi", "Wi‑Fi"],
                ["parking", "Estacionamento"],
                ["oceanView", "Vista mar"],
                ["pool", "Piscina"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 rounded-md py-0.5">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={f.amenities[key]}
                  onChange={(e) =>
                    onPatch({ amenities: { ...f.amenities, [key]: e.target.checked } })
                  }
                />
                <span className="text-sm text-neutral-800">{label}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      </div>

      {showFooterNote ? (
        <footer className="mt-6 shrink-0 border-t border-neutral-200 pt-4">
          <p className="text-xs leading-relaxed text-neutral-500">
            Os filtros refinam a lista já carregada nesta página (sem nova pesquisa ao servidor).
          </p>
        </footer>
      ) : null}
    </div>
  );
}
