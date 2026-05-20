# Feature: Upload vídeo → DTP (PDF)

Transforma gravações de ecrã em documentação passo a passo em PDF, com capturas e descrições geradas por IA.

## Fluxo

1. Utilizador autenticado acede a `/upload/video-dtp`.
2. Seleciona um vídeo (MP4, WebM, MOV) e envia para Azure Blob via SAS.
3. API cria job MongoDB (`dtp_jobs`) e enfileira análise BullMQ.
4. Worker descarrega o vídeo, extrai frames com **ffmpeg**, deteta passos com **Vertex AI** (`@ai-sdk/google-vertex`), gera PDF com **pdf-lib** e faz upload do resultado.
5. UI faz polling do estado e permite download do PDF.

## Pré-requisitos

| Requisito | Variável / comando |
|-----------|-------------------|
| MongoDB | `MONGODB_URI` |
| Azure Storage (SAS upload + leitura server-side) | `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_UPLOADS_CONTAINER` |
| Redis (fila) | `REDIS_CONNECTION_STRING` |
| Vertex AI | `GENAI_KEY` (service account JSON em base64), opcional `GENAI_MODEL` (default `gemini-2.5-flash`) |
| **ffmpeg no PATH** | `ffmpeg -version` — macOS: `brew install ffmpeg`. Opcional: `FFMPEG_PATH` / `FFPROBE_PATH` no `.env` |
| Autenticação | NextAuth + Entra (`AUTH_SECRET`, `AZURE_AD_*`) |

Sem `REDIS_CONNECTION_STRING` + `GENAI_KEY`, os jobs ficam em `queued` (fila noop).

## Limites

- **1 vídeo** por job
- **500 MB** máximo por ficheiro
- **30 minutos** duração máxima (validada no worker)
- **~40 frames** máximo extraídos para análise IA

## Rotas API (autenticadas)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/dtp/upload-sas` | Emite SAS para upload de vídeo |
| POST | `/api/dtp/jobs` | Cria job e enfileira análise |
| GET | `/api/dtp/jobs/[jobId]` | Estado e passos |
| GET | `/api/dtp/jobs/[jobId]/download` | Download do PDF |

## Template PDF

O layout do PDF é **definido em código** (não pela IA), para garantir o mesmo padrão em todos os jobs:

| Elemento | Comportamento |
|----------|----------------|
| **Capa (página 1)** | Título `DTP generated`, nome do vídeo e data de geração |
| **Páginas de conteúdo** | Cabeçalho fixo: *Esses dados são sensíveis e de uso interno na empresa.* |
| **Rodapé** | `Página X de Y` em todas as páginas exceto a capa |

Ficheiros: [`src/domain/dtp/dtp-pdf-template.ts`](src/domain/dtp/dtp-pdf-template.ts), [`src/infrastructure/documents/dtp-pdf-layout.ts`](src/infrastructure/documents/dtp-pdf-layout.ts), [`src/infrastructure/documents/dtp-pdf.builder.ts`](src/infrastructure/documents/dtp-pdf.builder.ts).

Futuro: variável de ambiente `DTP_PDF_TEMPLATE=default` para múltiplos templates.

## Estrutura de código

- **Domain:** `src/domain/dtp/`, `src/domain/upload/video-dtp-upload-policy.ts`
- **Application:** `src/application/dtp/use-cases/`
- **Infrastructure:** ffmpeg, Vertex, PDF, Mongo, BullMQ worker
- **UI:** `src/presentation/features/dtp/`, página `src/app/upload/video-dtp/page.tsx`

## Testes

```bash
bun test
```

Inclui testes de política de vídeo, mapeamento de timestamps e geração de PDF.
