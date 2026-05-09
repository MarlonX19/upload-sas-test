"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MAX_ROOM_PDF_BYTES, MAX_ROOM_PDF_COUNT } from "@/domain/rooms/room-pdf-policy";
import type { AdminHotelOption, AdminRoomTypeOption } from "@/domain/repositories/room-admin.repository";
import {
  discardRoomUploadSession,
  resumeRoomPdfsFromSessionsInBatches,
  uploadRoomPdfsToAzureInBatches,
} from "@/lib/upload/room-azure-upload";
import { listRoomUploadSessions, type RoomUploadSessionV1 } from "@/lib/upload/room-upload-session-idb";
import { RoomUploadFloatingStatus } from "@/presentation/features/admin/rooms/components/room-upload-floating-status";
import { Button } from "@/presentation/shared/ui/button";
import { cn } from "@/lib/cn";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "available", label: "Disponível" },
  { value: "cleaning", label: "Limpeza" },
  { value: "occupied", label: "Ocupado" },
  { value: "maintenance", label: "Manutenção" },
  { value: "out_of_order", label: "Fora de serviço" },
];

const MAX_MB = MAX_ROOM_PDF_BYTES / (1024 * 1024);

type Props = {
  hotels: AdminHotelOption[];
  initialRoomTypes: AdminRoomTypeOption[];
};

type UploadHud =
  | { kind: "creating" }
  | {
      kind: "upload";
      names: string[];
      progress: number[];
      completed: number;
    };

function firstActiveFileIndex(progress: number[]): number {
  const idx = progress.findIndex((p) => p < 100);
  return idx === -1 ? Math.max(0, progress.length - 1) : idx;
}

export function RegisterRoomForm({ hotels, initialRoomTypes }: Props) {
  const [hotelId, setHotelId] = useState(hotels[0]?.id ?? "");
  const [roomTypes, setRoomTypes] = useState<AdminRoomTypeOption[]>(initialRoomTypes);
  const [roomTypeId, setRoomTypeId] = useState(initialRoomTypes[0]?.id ?? "");
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("1");
  const [status, setStatus] = useState("available");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [roomTypesLoading, setRoomTypesLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [hud, setHud] = useState<UploadHud | null>(null);
  const [pendingSessions, setPendingSessions] = useState<RoomUploadSessionV1[]>([]);
  const [pendingResumeLoading, setPendingResumeLoading] = useState(false);
  const [onLine, setOnLine] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );

  useEffect(() => {
    void listRoomUploadSessions().then(setPendingSessions);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const up = () => setOnLine(true);
    const down = () => setOnLine(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const loadRoomTypes = useCallback(async (hid: string) => {
    if (!hid) {
      setRoomTypes([]);
      setRoomTypeId("");
      return;
    }
    setRoomTypesLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/hotels/${hid}/room-types`);
      if (!res.ok) {
        setRoomTypes([]);
        setMessage({ type: "err", text: "Não foi possível carregar as categorias." });
        return;
      }
      const data = (await res.json()) as { roomTypes: AdminRoomTypeOption[] };
      setRoomTypes(data.roomTypes);
      setRoomTypeId(data.roomTypes[0]?.id ?? "");
    } finally {
      setRoomTypesLoading(false);
    }
  }, []);

  const onHotelIdChange = (hid: string) => {
    setHotelId(hid);
    void loadRoomTypes(hid);
  };

  const hudProps = useMemo(() => {
    if (!hud) return null;
    if (hud.kind === "creating") {
      return {
        mode: "creating" as const,
        overallPercent: 0,
        currentFileLabel: null,
        completed: 0,
        total: 0,
        indeterminate: true,
        networkWaiting: false,
      };
    }
    const n = hud.names.length;
    if (n === 0) return null;
    const sum = hud.progress.reduce((a, p) => a + p, 0);
    const overallPercent = sum / n;
    const activeIdx = firstActiveFileIndex(hud.progress);
    const currentFileLabel = hud.names[activeIdx] ?? null;
    return {
      mode: "uploading" as const,
      overallPercent,
      currentFileLabel,
      completed: hud.completed,
      total: n,
      indeterminate: false,
      networkWaiting: !onLine,
    };
  }, [hud, onLine]);

  const refreshPending = useCallback(() => {
    void listRoomUploadSessions().then(setPendingSessions);
  }, []);

  async function onResumePendingUploads() {
    if (pendingSessions.length === 0) return;
    setPendingResumeLoading(true);
    setMessage(null);
    const names = pendingSessions.map((s) => s.fileName);
    setHud({
      kind: "upload",
      names,
      progress: new Array(names.length).fill(0),
      completed: 0,
    });
    try {
      const snapshot = [...pendingSessions];
      await resumeRoomPdfsFromSessionsInBatches(
        snapshot,
        (fileIndex, progress) => {
          setHud((prev) => {
            if (!prev || prev.kind !== "upload") return prev;
            const next = [...prev.progress];
            next[fileIndex] = progress;
            return { ...prev, progress: next };
          });
        },
        (fileIndex) => {
          setHud((prev) => {
            if (!prev || prev.kind !== "upload") return prev;
            return {
              ...prev,
              completed: prev.completed + 1,
              progress: prev.progress.map((v, j) => (j === fileIndex ? 100 : v)),
            };
          });
        },
      );
      setMessage({ type: "ok", text: "Envios pendentes concluídos." });
    } catch (err) {
      const text = err instanceof Error ? err.message : "Falha ao retomar o envio.";
      setMessage({ type: "err", text: text });
    } finally {
      refreshPending();
      setPendingResumeLoading(false);
      setHud(null);
    }
  }

  async function onDiscardPendingUploads() {
    if (pendingSessions.length === 0) return;
    setPendingResumeLoading(true);
    try {
      await Promise.all(
        pendingSessions.map((s) => discardRoomUploadSession(s.roomId, s.fileId)),
      );
      setPendingSessions([]);
    } finally {
      setPendingResumeLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setHud(null);

    const list = files ? Array.from(files) : [];
    if (list.length > MAX_ROOM_PDF_COUNT) {
      setMessage({ type: "err", text: `Pode anexar no máximo ${MAX_ROOM_PDF_COUNT} ficheiros PDF.` });
      return;
    }
    for (const f of list) {
      if (f.size > MAX_ROOM_PDF_BYTES) {
        setMessage({
          type: "err",
          text: `O ficheiro «${f.name}» excede o limite de ${MAX_MB} MB.`,
        });
        return;
      }
      if (!/\.pdf$/i.test(f.name)) {
        setMessage({
          type: "err",
          text: `Cada ficheiro deve ter extensão .pdf: «${f.name}».`,
        });
        return;
      }
    }

    if (!hotelId || !roomTypeId) {
      setMessage({ type: "err", text: "Selecione a organização e a categoria." });
      return;
    }

    const withIds = list.map((file) => ({ file, fileId: crypto.randomUUID() }));
    const pendingFiles = withIds.map(({ file, fileId }) => ({ fileId, fileName: file.name }));

    setLoading(true);
    setHud({ kind: "creating" });
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId,
          roomTypeId,
          number: number.trim(),
          floor: Number(floor),
          status,
          pendingFiles,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { roomId?: string; error?: string };
      if (!res.ok) {
        setMessage({ type: "err", text: body.error ?? "Não foi possível criar o registo." });
        return;
      }
      const roomId = body.roomId;
      if (!roomId) {
        setMessage({ type: "err", text: "Resposta inválida do servidor." });
        return;
      }

      if (withIds.length > 0) {
        const names = withIds.map((x) => x.file.name);
        setHud({
          kind: "upload",
          names,
          progress: new Array(names.length).fill(0),
          completed: 0,
        });
        await uploadRoomPdfsToAzureInBatches(
          withIds,
          roomId,
          hotelId,
          (fileIndex, progress) => {
            setHud((prev) => {
              if (!prev || prev.kind !== "upload") return prev;
              const next = [...prev.progress];
              next[fileIndex] = progress;
              return { ...prev, progress: next };
            });
          },
          (fileIndex) => {
            setHud((prev) => {
              if (!prev || prev.kind !== "upload") return prev;
              return {
                ...prev,
                completed: prev.completed + 1,
                progress: prev.progress.map((v, j) => (j === fileIndex ? 100 : v)),
              };
            });
          },
        );
        refreshPending();
      }

      setMessage({ type: "ok", text: "Registo criado e PDFs associados com sucesso." });
      setNumber("");
      setFiles(null);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Falha durante o envio para o Azure.";
      setMessage({
        type: "err",
        text: `O registo pode já existir com entradas de ficheiro pendentes. ${text}`,
      });
      refreshPending();
    } finally {
      setLoading(false);
      setHud(null);
    }
  }

  if (hotels.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Não existem organizações activas na base de dados. Executa a seed depois de configurar a MongoDB.
      </p>
    );
  }

  return (
    <>
      {hudProps && <RoomUploadFloatingStatus {...hudProps} />}

      {pendingSessions.length > 0 && !hud && (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Envio(s) PDF em pausa</p>
          <p className="mt-1.5 text-amber-900/90">
            {pendingSessions.length} ficheiro(s) guardado(s) localmente (IndexedDB) — podes retomar após
            perder a ligação ou recarregar a página. Os dados ficam associados ao registo já criado no
            sistema.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-9"
              disabled={pendingResumeLoading}
              onClick={() => void onResumePendingUploads()}
            >
              {pendingResumeLoading ? "A processar…" : "Retomar envios"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={pendingResumeLoading}
              onClick={() => void onDiscardPendingUploads()}
            >
              Descartar sessões
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
        {message && (
          <p
            role="alert"
            className={cn(
              "rounded-lg border p-3 text-sm",
              message.type === "ok"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-800",
            )}
          >
            {message.text}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-800" htmlFor="org">
              Organização
            </label>
            <select
              id="org"
              required
              className="mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm"
              value={hotelId}
              onChange={(e) => {
                onHotelIdChange(e.target.value);
              }}
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-800" htmlFor="roomType">
              Tipo / categoria
            </label>
            <select
              id="roomType"
              required
              disabled={roomTypesLoading || roomTypes.length === 0}
              className="mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm disabled:opacity-60"
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
            >
              {roomTypes.length === 0 && !roomTypesLoading ? (
                <option value="">—</option>
              ) : (
                roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))
              )}
            </select>
            {roomTypesLoading && (
              <p className="mt-1 text-xs text-neutral-500">A carregar tipos…</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-800" htmlFor="num">
              Identificador do registo
            </label>
            <input
              id="num"
              required
              className="mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="ex.: 205"
              maxLength={32}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-800" htmlFor="floor">
              Piso
            </label>
            <input
              id="floor"
              required
              type="number"
              className="mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-800" htmlFor="status">
              Estado
            </label>
            <select
              id="status"
              className="mt-1.5 w-full max-w-sm rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-800" htmlFor="pdfs">
              PDFs informativos (máx. {MAX_ROOM_PDF_COUNT}, até {MAX_MB} MB cada)
            </label>
            <input
              id="pdfs"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="mt-1.5 block w-full text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-800"
              onChange={(e) => {
                setFiles(e.target.files);
              }}
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              {files && files.length > 0
                ? `${files.length} ficheiro(s). O registo é criado de imediato; o estado do upload surge no canto
              inferior direito.`
                : "Opcional. Só ficheiros PDF, enviados para o Azure Storage."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={loading} className="h-10 px-6 text-sm">
            {loading ? "A processar…" : "Registar"}
          </Button>
        </div>
      </form>
    </>
  );
}
