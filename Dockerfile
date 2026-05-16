# Imagem multi-stage Next.js para Azure DevOps (task "Docker" / CI-CD para App Service ou AKS).
# Requisitos do pipeline de teste:
# - Build contexts = raíz do repo (Dockerfile está na raíz).
# - Variáveis de runtime (Secrets / App settings): Mongo, Auth, Redis, Azure, GENAI_KEY, OTLP,
#   etc. devem injectar‑se NO container pelo ambiente onde correr — NÃO faz commit de .env.
#
# Produção esperada: porta 3000, listen 0.0.0.0 (Next standalone).

ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:${BUN_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis embebidas na build cliente (NEXT_PUBLIC_*). Passar no pipeline com:
#   docker build ... --build-arg NEXT_PUBLIC_APP_URL=https://your-app.azurewebsites.net
# Omitir valores sensíveis: isto faz parte das camadas de imagem.
ARG NEXT_PUBLIC_APP_URL=""
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME="0.0.0.0"

# Lista de RUNTIME esperadas pelo Node/Next — configure no alvo Azure (Application settings /
# Secrets do Container App): ver ficheiro .env.example para descrições. NÃO passar valores
# secretos no Dockerfile; apenas injetan-se no momento do deploy/execução.

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
