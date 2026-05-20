# Feature: Upload vídeo → DTP (PDF)

Transforma gravações de ecrã em documentação passo a passo em PDF, com capturas e descrições geradas por IA.

## Fluxo

1. Utilizador autenticado acede a `/upload/video-dtp`.
2. **Upload:** seleciona um vídeo (MP4, WebM, MOV) **ou** **Gravar vídeo:** grava ecrã no browser (janela do navegador ou ecrã inteiro), pré-visualiza e confirma o ficheiro `.webm` em memória.
3. Clica **Iniciar análise** — envio **diretamente ao servidor** (`POST /api/dtp/jobs` multipart).
4. O vídeo é gravado em **diretório temporário do SO** (`os.tmpdir()` ou `DTP_TEMP_DIR`), não no Azure.
5. API cria job MongoDB (`dtp_jobs`) e enfileira análise BullMQ.
6. Worker usa ffmpeg + Vertex no ficheiro local, gera PDF, faz **upload só do PDF** para Azure.
7. Worker **apaga** o diretório temporário do vídeo (`finally`).
8. UI faz polling e permite download do PDF.

## Gravação de ecrã (browser)

- APIs: `getDisplayMedia` + `MediaRecorder` (só no cliente; até **Iniciar análise** o vídeo não vai ao servidor).
- Requer **HTTPS** em produção (ou `localhost` em desenvolvimento).
- Browsers recomendados: Chrome / Edge (melhor suporte a `displaySurface` e WebM).
- A UI oferece preferência **janela do navegador** vs **ecrã inteiro**; o diálogo nativo do SO continua a ser obrigatório.
- Limite de gravação no cliente: **30 min** (para depois o worker); ficheiro **500 MB** máximo.
- WebM do browser: a extração de frames usa filtro `fps` (decode completo), não seek por timestamp — WebM do MediaRecorder costuma não ter duração correta no metadata e o seek devolvia sempre o primeiro frame (diálogo de partilha).
- Código: [`src/lib/dtp/use-dtp-screen-recorder.ts`](src/lib/dtp/use-dtp-screen-recorder.ts), [`src/presentation/features/dtp/components/dtp-screen-recorder-panel.tsx`](src/presentation/features/dtp/components/dtp-screen-recorder-panel.tsx).

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

- **1 vídeo** por job, **500 MB** máximo, **30 min** duração (worker e gravação no browser)
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
