"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import { ptBR as dayPickerPtBR } from "react-day-picker/locale";

import type { SearchAvailabilityOutput } from "@/application/availability/dtos/search-availability.result";
import {
  DEFAULT_ROOM_FILTERS,
  countActiveFilters,
} from "@/presentation/features/home/constants/room-filters-defaults";
import { GuestRoomPicker } from "@/presentation/features/home/components/guest-room-picker";
import { RoomFiltersDrawer } from "@/presentation/features/home/components/room-filters-drawer";
import { RoomFiltersSidebar } from "@/presentation/features/home/components/room-filters-sidebar";
import { applyRoomFilters } from "@/presentation/features/home/lib/apply-room-filters";
import { mergeRoomFiltersPatch } from "@/presentation/features/home/lib/merge-room-filters-patch";
import type { RoomFiltersState } from "@/presentation/features/home/types/room-filters.types";
import { useSearchAvailability } from "@/presentation/features/home/hooks/use-search-availability";
import { useAvailabilityUiStore } from "@/presentation/features/home/stores/availability-ui.store";
import { Badge, Button, Card, CardDescription, CardTitle } from "@/presentation/shared/ui";

import "react-day-picker/style.css";

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function toYMD(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function AvailabilitySearch() {
  const [range, setRange] = useState<DateRange | undefined>();
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [monthColumns, setMonthColumns] = useState(1);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [data, setData] = useState<SearchAvailabilityOutput | null>(null);
  const [roomFilters, setRoomFilters] = useState<RoomFiltersState>(DEFAULT_ROOM_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const calendarOpen = useAvailabilityUiStore((s) => s.calendarOpen);
  const setCalendarOpen = useAvailabilityUiStore((s) => s.setCalendarOpen);
  const setGuestPickerOpen = useAvailabilityUiStore((s) => s.setGuestPickerOpen);

  const searchMutation = useSearchAvailability();

  const patchRoomFilters = useCallback((patch: Partial<RoomFiltersState>) => {
    setRoomFilters((prev) => mergeRoomFiltersPatch(prev, patch));
  }, []);

  const resetRoomFilters = useCallback(() => {
    setRoomFilters(DEFAULT_ROOM_FILTERS);
  }, []);

  const filteredResults = useMemo(() => {
    if (!data?.results.length) return [];
    return applyRoomFilters(data.results, roomFilters);
  }, [data, roomFilters]);

  const activeFilterCount = useMemo(() => countActiveFilters(roomFilters), [roomFilters]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setMonthColumns(mq.matches ? 2 : 1);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const rangeLabel = useMemo(() => {
    if (!range?.from) return "Check-in — Check-out";
    if (!range.to) return `${format(range.from, "d MMM yyyy", { locale: ptBR })} — …`;
    return `${format(range.from, "d MMM", { locale: ptBR })} — ${format(range.to, "d MMM yyyy", { locale: ptBR })}`;
  }, [range]);

  const errorMessage =
    validationMessage ??
    (searchMutation.isError && searchMutation.error instanceof Error
      ? searchMutation.error.message
      : null);

  function handleSearch() {
    if (!range?.from || !range.to) {
      setValidationMessage("Selecione o intervalo de datas (check-in e check-out).");
      return;
    }
    setValidationMessage(null);
    searchMutation.mutate(
      {
        checkIn: toYMD(range.from),
        checkOut: toYMD(range.to),
        adults,
        children,
        rooms,
      },
      {
        onSuccess: (d) => {
          setData(d);
          setRoomFilters(DEFAULT_ROOM_FILTERS);
          setValidationMessage(null);
        },
        onError: () => {
          setData(null);
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
      <Card>
        <CardTitle>Pesquisar disponibilidade</CardTitle>
        <CardDescription>
          Indica datas, hóspedes e quartos — mostramos só tipos de quarto que comportam a tua ocupação e stock
          suficiente.
        </CardDescription>

        <div className="mt-6 flex flex-col gap-4 lg:mt-8 lg:flex-row lg:items-end lg:gap-4">
          <div className="relative min-w-0 flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setGuestPickerOpen(false);
                setCalendarOpen(!calendarOpen);
              }}
              aria-expanded={calendarOpen}
              aria-haspopup="dialog"
              className="h-12 w-full justify-between gap-3 border-2 border-warning px-4 text-left font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
            >
              <span className="truncate">{rangeLabel}</span>
              <span className="shrink-0 text-neutral-400" aria-hidden>
                ▾
              </span>
            </Button>
            {calendarOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default bg-black/50 lg:hidden"
                  aria-label="Fechar calendário"
                  onClick={() => setCalendarOpen(false)}
                />
                <div className="absolute left-0 z-[100] mt-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-hotel-lg transition-opacity duration-200 ease-out sm:p-4">
                  <DayPicker
                    mode="range"
                    selected={range}
                    onSelect={(r) => setRange(r)}
                    locale={dayPickerPtBR}
                    numberOfMonths={monthColumns}
                    disabled={{ before: new Date() }}
                    className="hotelli-daypicker"
                  />
                  <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-4 py-2"
                      onClick={() => setCalendarOpen(false)}
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <GuestRoomPicker
            value={{ adults, children, rooms }}
            onChange={(v) => {
              setAdults(v.adults);
              setChildren(v.children);
              setRooms(v.rooms);
            }}
            disabled={searchMutation.isPending}
          />

          <Button
            type="button"
            variant="primary"
            onClick={handleSearch}
            disabled={searchMutation.isPending}
            className="h-12 w-full shrink-0 px-8 lg:w-auto lg:min-w-[10.5rem]"
          >
            {searchMutation.isPending ? "A pesquisar…" : "Pesquisar"}
          </Button>
        </div>

        {errorMessage && (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </Card>

      {data && (
        <section className="mt-10 sm:mt-12" aria-live="polite">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4 sm:mb-8">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
                {data.hotel.name}
              </h3>
              {data.hotel.city && <p className="mt-1 text-sm text-neutral-600">{data.hotel.city}</p>}
            </div>
            <div className="text-right text-sm font-medium text-neutral-600">
              <p>
                {data.guests.adults} {data.guests.adults === 1 ? "adulto" : "adultos"}
                {data.guests.children > 0
                  ? ` · ${data.guests.children} ${data.guests.children === 1 ? "criança" : "crianças"}`
                  : " · 0 crianças"}
                {" · "}
                {data.guests.rooms} {data.guests.rooms === 1 ? "quarto" : "quartos"}
              </p>
              <p className="mt-1">
                {data.nights} {data.nights === 1 ? "noite" : "noites"} ·{" "}
                {format(new Date(data.checkIn + "T12:00:00"), "d MMM", { locale: ptBR })} —{" "}
                {format(new Date(data.checkOut + "T12:00:00"), "d MMM yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {data.empty ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-14 text-center shadow-hotel-sm sm:px-8 sm:py-16">
              <p className="text-lg font-semibold text-neutral-800">
                Não há quartos disponíveis para estas condições.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                Para {data.guests.adults} {data.guests.adults === 1 ? "adulto" : "adultos"}
                {data.guests.children > 0
                  ? `, ${data.guests.children} ${data.guests.children === 1 ? "criança" : "crianças"}`
                  : ""}{" "}
                e {data.guests.rooms} {data.guests.rooms === 1 ? "quarto" : "quartos"}, não encontrámos tipos de quarto
                com stock e lotação adequados neste período. Ajusta a pesquisa ou contacta a receção.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-0">
              <RoomFiltersSidebar
                filters={roomFilters}
                onPatch={patchRoomFilters}
                onReset={resetRoomFilters}
              />
              <RoomFiltersDrawer
                open={mobileFiltersOpen}
                onOpenChange={setMobileFiltersOpen}
                filters={roomFilters}
                onPatch={patchRoomFilters}
                onReset={resetRoomFilters}
              />
              <div className="min-w-0 flex-1 lg:pl-8">
                <div className="mb-4 flex flex-wrap items-center gap-3 lg:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    className="relative border-neutral-300"
                    onClick={() => setMobileFiltersOpen(true)}
                  >
                    Filtros
                    {activeFilterCount > 0 ? (
                      <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-secondary-500 px-1.5 text-xs font-semibold text-white">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </Button>
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline"
                      onClick={resetRoomFilters}
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>

                {filteredResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center shadow-hotel-sm">
                    <p className="text-base font-semibold text-neutral-800">
                      Nenhum quarto corresponde aos filtros selecionados.
                    </p>
                    <p className="mt-2 text-sm text-neutral-600">
                      Tenta alargar a faixa de preço ou desativa algumas opções.
                    </p>
                    <Button type="button" variant="secondary" className="mt-4" onClick={resetRoomFilters}>
                      Limpar filtros
                    </Button>
                  </div>
                ) : (
                  <ul className="grid gap-6 sm:grid-cols-2 sm:gap-8">
                    {filteredResults.map((room) => (
                <li
                  key={room.roomTypeId}
                  className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-hotel-md transition-shadow duration-200 ease-out hover:shadow-hotel-lg"
                >
                  <div className="relative aspect-[16/10] w-full bg-neutral-100">
                    {room.imageUrls[0] ? (
                      <Image
                        src={room.imageUrls[0]}
                        alt={room.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                        Sem fotografia
                      </div>
                    )}
                  </div>
                  {room.imageUrls.length > 1 && (
                    <div className="flex gap-2 border-b border-neutral-200 px-3 py-2 sm:px-4">
                      {room.imageUrls.slice(1, 4).map((url) => (
                        <div
                          key={url}
                          className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-neutral-100 ring-1 ring-neutral-200/80"
                        >
                          <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h4 className="text-lg font-semibold tracking-tight text-neutral-900">{room.name}</h4>
                      <Badge tone="success">
                        {room.availableRooms === 1
                          ? "1 quarto disponível"
                          : `${room.availableRooms} quartos disponíveis`}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-600">
                      {room.description ?? room.bedSummary}
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {room.amenities.slice(0, 5).map((a) => (
                        <li key={a}>
                          <Badge tone="neutral">{a}</Badge>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-neutral-200 pt-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Desde / noite
                        </p>
                        <p className="mt-1 text-xl font-semibold text-secondary-600">
                          {formatCurrency(room.basePricePerNight, room.currency)}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Estimativa {data.nights} noites:{" "}
                          <span className="font-semibold text-neutral-700">
                            {formatCurrency(room.basePricePerNight * data.nights, room.currency)}
                          </span>
                        </p>
                      </div>
                      <p className="max-w-[12rem] text-right text-sm font-medium text-neutral-600">
                        Até {room.maxOccupancy} {room.maxOccupancy === 1 ? "pessoa" : "pessoas"}
                        {typeof room.maxChildren === "number"
                          ? ` · max. ${room.maxChildren} ${room.maxChildren === 1 ? "criança" : "crianças"}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
