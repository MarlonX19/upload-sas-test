"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdminRoomDetail } from "@/domain/repositories/admin-room-detail";
import Link from "next/link";

const POLL_MS = 4000;

const STATUS_LABELS: Record<string, string> = {
  available: "Disponível",
  cleaning: "Limpeza",
  occupied: "Ocupado",
  maintenance: "Manutenção",
  out_of_order: "Fora de serviço",
};

function severityLabel(s: string): string {
  if (s === "low") return "Baixa";
  if (s === "medium") return "Média";
  if (s === "high") return "Alta";
  return s;
}

function analysisStatusLabel(status?: string): string {
  if (status === "processing") return "Em curso";
  if (status === "completed") return "Concluída";
  if (status === "failed") return "Falhou";
  if (status === "pending") return "Pendente";
  return "—";
}

type Props = {
  roomId: string;
};

export function AdminRoomDetailPanel({ roomId }: Props) {
  const [detail, setDetail] = useState<AdminRoomDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const shouldPoll = useMemo(() => {
    if (!detail?.files.length) return false;
    return detail.files.some((f) => f.analysisStatus === "processing");
  }, [detail]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/rooms/${encodeURIComponent(roomId)}`);
    if (res.status === 401) {
      setError("Sessão expirada. Inicie sessão novamente.");
      setDetail(null);
      return;
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Não foi possível carregar o registo.");
      setDetail(null);
      return;
    }
    const data = (await res.json()) as AdminRoomDetail;
    setDetail(data);
    setError(null);
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!shouldPoll) return;
    const id = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [shouldPoll, load]);

  if (loading && !detail) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
        A carregar…
      </p>
    );
  }

  if (error || !detail) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        {error ?? "Registo não encontrado."}
        <div className="mt-3">
          <Link
            href="/admin/rooms/new"
            className="font-medium text-primary-700 underline underline-offset-2 hover:text-primary-900"
          >
            Voltar ao registo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {shouldPoll && (
        <p className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900">
          A análise por IA está em curso. Esta página actualiza automaticamente a cada alguns segundos.
        </p>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-surface-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Informações do registo
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Organização</dt>
            <dd className="font-medium text-neutral-900">{detail.hotelName}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Categoria</dt>
            <dd className="font-medium text-neutral-900">{detail.roomTypeName}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Identificador</dt>
            <dd className="font-medium text-neutral-900">{detail.number}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Piso</dt>
            <dd className="font-medium text-neutral-900">{detail.floor}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Estado</dt>
            <dd className="font-medium text-neutral-900">
              {STATUS_LABELS[detail.status] ?? detail.status}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">ID interno</dt>
            <dd className="break-all font-mono text-xs text-neutral-700">{detail.id}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-neutral-500">Actualizado</dt>
            <dd className="text-neutral-800">
              {new Date(detail.updatedAt).toLocaleString("pt-PT")}
            </dd>
          </div>
        </dl>
      </section>

      {detail.files.length === 0 ? (
        <p className="text-sm text-neutral-600">Nenhum ficheiro PDF associado a este registo.</p>
      ) : (
        detail.files.map((file) => (
          <section
            key={file.fileId}
            className="rounded-xl border border-neutral-200 bg-white p-6 shadow-surface-sm"
          >
            <h2 className="text-base font-semibold text-neutral-900">{file.fileName}</h2>
            <p className="mt-1 font-mono text-xs text-neutral-500 break-all">fileId: {file.fileId}</p>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-neutral-700">URL no storage</h3>
              {file.fileURL ? (
                <a
                  href={file.fileURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-sm text-primary-700 underline hover:text-primary-900"
                >
                  {file.fileURL}
                </a>
              ) : (
                <p className="mt-1 text-sm text-amber-700">Ainda sem URL (upload pendente).</p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 border-t border-neutral-100 pt-4 text-sm">
              <div>
                <span className="text-neutral-500">Análise IA: </span>
                <span className="font-medium text-neutral-900">
                  {analysisStatusLabel(file.analysisStatus)}
                </span>
              </div>
              {file.analysisUpdatedAt && (
                <div className="text-neutral-600">
                  Última actualização: {new Date(file.analysisUpdatedAt).toLocaleString("pt-PT")}
                </div>
              )}
            </div>
            {file.analysisError && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {file.analysisError}
              </p>
            )}

            {file.analysisSteps && file.analysisSteps.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-neutral-800">Passos extraídos</h3>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-neutral-800">
                  {[...file.analysisSteps]
                    .sort((a, b) => a.order - b.order)
                    .map((s, i) => (
                      <li key={`${s.order}-${i}`}>
                        <span className="font-medium">{s.title}</span>
                        <p className="mt-0.5 text-neutral-600">{s.description}</p>
                      </li>
                    ))}
                </ol>
              </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-neutral-800">SOCOS</h3>
                {!file.socos || file.socos.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-500">
                    {file.analysisStatus === "processing"
                      ? "A gerar…"
                      : "Sem dados ainda ou nenhum achado."}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {file.socos.map((s, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-3 text-sm"
                      >
                        <span className="font-medium text-neutral-900">{s.topic}</span>
                        <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-800">
                          {severityLabel(s.severity)}
                        </span>
                        <p className="mt-1 text-neutral-700">{s.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-800">Ideias</h3>
                {!file.ideas || file.ideas.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-500">
                    {file.analysisStatus === "processing"
                      ? "A gerar…"
                      : "Sem dados ainda ou nenhuma ideia."}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {file.ideas.map((idea, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-primary-100 bg-primary-50/50 p-3 text-sm"
                      >
                        <span className="font-medium text-neutral-900">{idea.title}</span>
                        <p className="mt-1 text-neutral-700">{idea.rationale}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
