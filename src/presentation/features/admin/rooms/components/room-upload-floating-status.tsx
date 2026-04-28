"use client";

import { cn } from "@/lib/cn";

const R = 22;
const C = 2 * Math.PI * R;

type Props = {
  /** Fase "a criar quarto" (spinner) ou progresso de uploads */
  mode: "creating" | "uploading";
  /** 0–100: progresso global (média dos ficheiros em curso) */
  overallPercent: number;
  /** Nome a mostrar (ficheiro activo) */
  currentFileLabel: string | null;
  /** concluídos / total (ex.: 2 / 5) */
  completed: number;
  total: number;
  /** Indeterminado para creating */
  indeterminate?: boolean;
};

/**
 * Retângulo de estado fixo: canto inferior direito — nome do ficheiro, anel de progresso, concluídos / total.
 */
export function RoomUploadFloatingStatus({
  mode,
  overallPercent,
  currentFileLabel,
  completed,
  total,
  indeterminate = false,
}: Props) {
  const pct = Math.max(0, Math.min(100, overallPercent));
  const offset = C - (pct / 100) * C;

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(calc(100vw-1.5rem),20rem)]",
        "rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-hotel-lg backdrop-blur-md",
      )}
      role="status"
      aria-live="polite"
      aria-label={mode === "creating" ? "A criar o quarto" : "A enviar ficheiros para o Azure"}
    >
      <div className="flex w-full items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <svg
            className={cn("h-12 w-12 -rotate-90", indeterminate && "animate-spin")}
            viewBox="0 0 56 56"
            aria-hidden
          >
            <circle
              className="fill-none stroke-neutral-200"
              strokeWidth="4"
              cx="28"
              cy="28"
              r={R}
            />
            {!indeterminate ? (
              <circle
                className="fill-none stroke-primary-500 transition-[stroke-dashoffset] duration-150 ease-out"
                strokeWidth="4"
                strokeLinecap="round"
                cx="28"
                cy="28"
                r={R}
                strokeDasharray={C}
                strokeDashoffset={offset}
              />
            ) : (
              <circle
                className="fill-none stroke-primary-500"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${C * 0.2} ${C * 0.8}`}
                cx="28"
                cy="28"
                r={R}
              />
            )}
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {mode === "creating" ? "A criar quarto" : "A enviar para o Azure"}
          </p>
          {mode === "uploading" && currentFileLabel && (
            <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900" title={currentFileLabel}>
              {currentFileLabel}
            </p>
          )}
          {mode === "creating" && (
            <p className="mt-0.5 text-sm text-neutral-600">A guardar no MongoDB…</p>
          )}
          {mode === "uploading" && total > 0 && (
            <p className="mt-1 flex items-baseline gap-1.5 text-sm text-neutral-700">
              <span className="tabular-nums text-lg font-bold text-primary-600">{completed}</span>
              <span className="text-neutral-400">/</span>
              <span className="tabular-nums text-neutral-600">{total}</span>
              <span className="text-xs font-normal text-neutral-500">concluídos</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
