"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useAvailabilityUiStore } from "@/presentation/features/home/stores/availability-ui.store";
import { Button } from "@/presentation/shared/ui";

export type GuestPickerValue = {
  adults: number;
  children: number;
  rooms: number;
};

type GuestRoomPickerProps = {
  value: GuestPickerValue;
  onChange: (next: GuestPickerValue) => void;
  disabled?: boolean;
};

const ADULT_MIN = 1;
const ADULT_MAX = 10;
const CHILD_MAX = 8;
const ROOM_MIN = 1;
const ROOM_MAX = 8;

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CounterRow({
  label,
  value,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  decDisabled: boolean;
  incDisabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <div className="flex items-center rounded-md border border-neutral-200 bg-neutral-50/80 p-0.5 shadow-sm">
        <button
          type="button"
          onClick={onDec}
          disabled={decDisabled}
          className="flex h-9 w-9 items-center justify-center rounded text-lg font-medium text-primary-600 transition-colors hover:bg-primary-50 disabled:pointer-events-none disabled:opacity-30"
          aria-label={`Menos ${label}`}
        >
          −
        </button>
        <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-neutral-900">
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          disabled={incDisabled}
          className="flex h-9 w-9 items-center justify-center rounded text-lg font-medium text-primary-600 transition-colors hover:bg-primary-50 disabled:pointer-events-none disabled:opacity-30"
          aria-label={`Mais ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function summaryLabel(v: GuestPickerValue): string {
  const a = `${v.adults} ${v.adults === 1 ? "adulto" : "adultos"}`;
  const c =
    v.children === 0
      ? "0 crianças"
      : `${v.children} ${v.children === 1 ? "criança" : "crianças"}`;
  const r = `${v.rooms} ${v.rooms === 1 ? "quarto" : "quartos"}`;
  return `${a} · ${c} · ${r}`;
}

export function GuestRoomPicker({ value, onChange, disabled }: GuestRoomPickerProps) {
  const panelId = useId();
  const open = useAvailabilityUiStore((s) => s.guestPickerOpen);
  const setGuestPickerOpen = useAvailabilityUiStore((s) => s.setGuestPickerOpen);
  const setCalendarOpen = useAvailabilityUiStore((s) => s.setCalendarOpen);

  const [draft, setDraft] = useState<GuestPickerValue>(value);
  const [travelingWithPets, setTravelingWithPets] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        setGuestPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, setGuestPickerOpen]);

  function apply() {
    onChange(draft);
    setGuestPickerOpen(false);
  }

  const display = summaryLabel(value);

  return (
    <div ref={rootRef} className="relative w-full min-w-0 lg:max-w-[min(100%,20rem)]">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => {
          setCalendarOpen(false);
          setGuestPickerOpen(!open);
        }}
        className="flex h-12 w-full items-center gap-2 rounded-md border-2 border-warning bg-white px-3 text-left text-sm font-medium text-neutral-900 shadow-sm transition-[box-shadow,background-color] duration-200 ease-out hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PersonIcon className="shrink-0 text-neutral-600" />
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <ChevronDown className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Hóspedes e quartos"
          className="absolute left-0 right-0 z-[100] mt-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-hotel-lg sm:left-auto sm:right-0 sm:w-[min(100vw-2rem,22rem)]"
        >
          <div className="divide-y divide-neutral-200">
            <CounterRow
              label="Adultos"
              value={draft.adults}
              decDisabled={draft.adults <= ADULT_MIN}
              incDisabled={draft.adults >= ADULT_MAX}
              onDec={() => setDraft((d) => ({ ...d, adults: Math.max(ADULT_MIN, d.adults - 1) }))}
              onInc={() => setDraft((d) => ({ ...d, adults: Math.min(ADULT_MAX, d.adults + 1) }))}
            />
            <CounterRow
              label="Crianças"
              value={draft.children}
              decDisabled={draft.children <= 0}
              incDisabled={draft.children >= CHILD_MAX}
              onDec={() => setDraft((d) => ({ ...d, children: Math.max(0, d.children - 1) }))}
              onInc={() => setDraft((d) => ({ ...d, children: Math.min(CHILD_MAX, d.children + 1) }))}
            />
            <CounterRow
              label="Quartos"
              value={draft.rooms}
              decDisabled={draft.rooms <= ROOM_MIN}
              incDisabled={draft.rooms >= ROOM_MAX}
              onDec={() => setDraft((d) => ({ ...d, rooms: Math.max(ROOM_MIN, d.rooms - 1) }))}
              onInc={() => setDraft((d) => ({ ...d, rooms: Math.min(ROOM_MAX, d.rooms + 1) }))}
            />
          </div>

          <div className="mt-4 border-t border-neutral-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-neutral-800">Viajas com animais?</span>
              <button
                type="button"
                role="switch"
                aria-checked={travelingWithPets}
                onClick={() => setTravelingWithPets((p) => !p)}
                className={`flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ${
                  travelingWithPets ? "justify-end bg-primary-600" : "justify-start bg-neutral-300"
                }`}
              >
                <span className="pointer-events-none h-6 w-6 rounded-full bg-white shadow" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-primary-600">
              Animais de assistência não contam como pets. Em caso de dúvida, contacta a receção antes de reservar.
            </p>
          </div>

          <Button type="button" variant="outline" className="mt-5 h-11 w-full font-semibold" onClick={apply}>
            OK
          </Button>
        </div>
      )}
    </div>
  );
}
