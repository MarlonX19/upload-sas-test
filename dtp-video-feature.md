# Feature: Upload vídeo → DTP (PDF)

Transforma gravações de ecrã em documentação passo a passo em PDF, com capturas e descrições geradas por IA.

## Fluxo

1. Utilizador autenticado acede a `/upload/video-dtp`.
2. Seleciona um vídeo (MP4, WebM, MOV) e envia **diretamente ao servidor** (`POST /api/dtp/jobs` multipart).
3. O vídeo é gravado em **diretório temporário do SO** (`os.tmpdir()` ou `DTP_TEMP_DIR`), não no Azure.
4. API cria job MongoDB (`dtp_jobs`) e enfileira análise BullMQ.
5. Worker usa ffmpeg + Vertex no ficheiro local, gera PDF, faz **upload só do PDF** para Azure.
6. Worker **apaga** o diretório temporário do vídeo (`finally`).
7. UI faz polling e permite download do PDF.

## Armazenamento

| Artefacto | Onde fica |
|-----------|-----------|
| Vídeo de entrada | Temp local `{tmpdir}/dtp/{jobId}/input.{ext}` — **removido após análise** |
| Screenshots | Só em memória para montar o PDF (não vão para Azure) |
| PDF final | Azure Blob (`dtp-{jobId}.pdf`) |

**Não** guardar vídeos na pasta do projeto. Opcional: `DTP_TEMP_DIR=/var/dtp-temp` no container Azure com disco adequado.

## Pré-requisitos

| Requisito | Variável / comando |
|-----------|-------------------|
| MongoDB | `MONGODB_URI` |
| Azure Storage (apenas PDF) | `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_UPLOADS_CONTAINER` |
| Redis (fila) | `REDIS_CONNECTION_STRING` |
| Vertex AI | `GENAI_KEY`, opcional `GENAI_MODEL` |
| **ffmpeg no PATH** | `ffmpeg -version` — macOS: `brew install ffmpeg`; Docker: `apt install ffmpeg` |
| Autenticação | NextAuth + Entra |
| Temp (opcional) | `DTP_TEMP_DIR` |

Sem `REDIS_CONNECTION_STRING` + `GENAI_KEY`, os jobs ficam em `queued` (fila noop).

## Limites

- **1 vídeo** por job, **500 MB** máximo, **30 min** duração (worker)
- Upload HTTP: `maxDuration = 300` na rota; `proxyClientMaxBodySize: 500mb` no Next

## Deploy / réplicas

O worker precisa aceder ao **mesmo caminho** onde a API gravou o vídeo. MVP: **1 réplica** da app ou volume partilhado montado em `DTP_TEMP_DIR`.

## Rotas API (autenticadas)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/dtp/jobs` | `multipart/form-data` campo `video` — cria job e enfileira |
| GET | `/api/dtp/jobs/[jobId]` | Estado e passos |
| GET | `/api/dtp/jobs/[jobId]/download` | Download do PDF |

## Template PDF

- Capa: `DTP generated`
- Cabeçalho de confidencialidade nas páginas de conteúdo
- Definido em [`src/domain/dtp/dtp-pdf-template.ts`](src/domain/dtp/dtp-pdf-template.ts)

## Testes

```bash
bun test
```
