"use client";

type Props = {
  minBound: number;
  maxBound: number;
  step?: number;
  value: { min: number; max: number };
  onChange: (next: { min: number; max: number }) => void;
};

/** Faixa de preço (filtro.md). Controlado pelo pai — evita loops com debounce interno. */
export function PriceRangeFilter({ minBound, maxBound, step = 50, value, onChange }: Props) {
  function setMin(n: number) {
    const raw = Math.max(minBound, Math.min(n, value.max - step));
    const min = Math.min(raw, value.max - step);
    onChange({ min, max: value.max });
  }

  function setMax(n: number) {
    const raw = Math.min(maxBound, Math.max(n, value.min + step));
    const max = Math.max(raw, value.min + step);
    onChange({ min: value.min, max });
  }

  const minSliderMax = Math.max(minBound, value.max - step);
  const maxSliderMin = Math.min(maxBound, value.min + step);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between text-xs font-medium text-neutral-600">
        <span>{value.min} €</span>
        <span>{value.max} €</span>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-neutral-600" htmlFor="price-min-range">
          Mínimo
        </label>
        <input
          id="price-min-range"
          type="range"
          min={minBound}
          max={minSliderMax}
          step={step}
          value={value.min}
          onChange={(e) => setMin(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-primary-600"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-neutral-600" htmlFor="price-max-range">
          Máximo
        </label>
        <input
          id="price-max-range"
          type="range"
          min={maxSliderMin}
          max={maxBound}
          step={step}
          value={value.max}
          onChange={(e) => setMax(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-primary-600"
        />
      </div>
    </div>
  );
}
