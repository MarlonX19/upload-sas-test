# Observabilidade (OpenTelemetry, Collector e Jaeger)

Guia genérico baseado num stack **Node.js**: aplicativo envia traces em **OTLP** para um **OpenTelemetry Collector**, que encaminha para o **Jaeger**. Opcionalmente, **BullMQ** pode usar `bullmq-otel` para spans alinhados ao mesmo pipeline.

## Fluxo de dados (alto nível)

```text
Aplicação (Node.js)
  └─ SDK OpenTelemetry + auto-instrumentações
  └─ OTLP/gRPC (padrão usual: localhost:4317)
         ▼
OpenTelemetry Collector (recebe OTLP em 4317 gRPC e 4318 HTTP)
  └─ pipeline: receivers [otlp] → processors [batch] → exporters [otlp]
         ▼
Jaeger all-in-one (rede Docker, host: jaeger-web, porta OTLP 4317)
  └─ UI: http://localhost:16686
```

---

## Bibliotecas (versões de referência)

Faixas **semver** usadas como referência; para builds idênticos, fixe as versões resolvidas no lockfile do seu gerenciador.

| Pacote | Versão de referência |
|--------|----------------------|
| `@opentelemetry/api` | `^1.9.0` |
| `@opentelemetry/auto-instrumentations-node` | `^0.62.2` |
| `@opentelemetry/exporter-trace-otlp-grpc` | `^0.204.0` |
| `@opentelemetry/resources` | `^2.5.0` |
| `@opentelemetry/sdk-node` | `^0.204.0` |
| `@opentelemetry/sdk-trace-node` | `^2.5.0` |
| `@opentelemetry/semantic-conventions` | `^1.39.0` |
| `bullmq-otel` | `^1.1.1` (somente se usar BullMQ) |

**Imagens Docker (referência):**

- Collector: `otel/opentelemetry-collector-contrib` (em produção, use **tag fixada**, não `latest`).
- Jaeger: `jaegertracing/all-in-one` (idem).

---

## Docker no projeto novo: Jaeger + Collector

Crie dois arquivos na raiz (ou em `docker/`) do novo projeto e ajuste apenas nomes de rede / caminhos se preferir outra estrutura.

### `collector-config.yml`

O `endpoint` do exporter deve ser o **nome do serviço** do Jaeger no Compose + porta OTLP (`4317` no all-in-one atual).

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  otlp:
    endpoint: jaeger-web:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
```

### Trecho `docker-compose` (somente observabilidade)

Incorpore os serviços abaixo no seu `docker-compose.yml` existente ou use como arquivo mínimo.

```yaml
services:
  jaeger-web:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger-web
    ports:
      - "16686:16686"
      - "14268:14268"
      - "14250:14250"

  collector:
    image: otel/opentelemetry-collector-contrib:latest
    container_name: collector
    command: ["--config=/etc/otelcol-contrib/config.yml"]
    ports:
      - "4317:4317"
      - "4318:4318"
      - "13133:13133"
    volumes:
      - ./collector-config.yml:/etc/otelcol-contrib/config.yml
    depends_on:
      - jaeger-web
```

**Ordem:** subir **Jaeger** antes (ou junto com `depends_on`) e depois o **collector**. A aplicação na máquina host envia traces para **`localhost:4317`** (gRPC).

---

## Aplicação Node.js: dependências

Exemplo com Bun:

```bash
bun add @opentelemetry/api@^1.9.0 \
  @opentelemetry/sdk-node@^0.204.0 \
  @opentelemetry/sdk-trace-node@^2.5.0 \
  @opentelemetry/exporter-trace-otlp-grpc@^0.204.0 \
  @opentelemetry/resources@^2.5.0 \
  @opentelemetry/semantic-conventions@^1.39.0 \
  @opentelemetry/auto-instrumentations-node@^0.62.2
```

---

## Exemplo: inicialização (Next.js)

Na convenção do Next.js, exporte `register()` no arquivo de instrumentação do framework. Inicialize o SDK **antes** de importar módulos que precisam ser instrumentados (por exemplo, cliente de banco).

```typescript
async function initializeOpenTelemetry() {
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-grpc");
  const { SimpleSpanProcessor } = await import("@opentelemetry/sdk-trace-node");
  const { resourceFromAttributes } = await import("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME } = await import("@opentelemetry/semantic-conventions");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "meu-servico",
    }),
    spanProcessors: [new SimpleSpanProcessor(new OTLPTraceExporter())],
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await initializeOpenTelemetry();
    // Demais imports de startup só depois do sdk.start(), se necessário.
  }
}
```

---

## Exemplo: inicialização (Node sem Next.js)

Chame a mesma `initializeOpenTelemetry()` no **primeiro** ficheiro de entrada, **antes** de `import` do servidor ou de drivers, ou use `node --import ./tracing.js ./server.js` com um módulo que só faz `sdk.start()`.

---

## Exemplo: BullMQ com `bullmq-otel`

```typescript
import { Queue } from "bullmq";
import { Worker } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

const queue = new Queue("minha-fila", {
  connection: redis,
  telemetry: new BullMQOtel("Queue"),
});

const worker = new Worker(
  "minha-fila",
  async (job) => {
    /* ... */
  },
  {
    connection: redis,
    telemetry: new BullMQOtel("Worker"),
  },
);
```

---

## Variáveis de ambiente úteis

| Variável | Função |
|----------|--------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint base OTLP (ajuste se o collector não for `localhost:4317`). |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Endpoint só de traces. |
| `OTEL_SERVICE_NAME` | Nome do serviço nos traces (pode refletir no recurso conforme a forma como você monta o `NodeSDK`). |

Sem definir endpoint, o exporter gRPC costuma usar **`http://localhost:4317`**, compatível com o mapeamento `4317:4317` do collector acima.

---

## Validar

1. `docker compose up` (Jaeger + collector).
2. Subir a aplicação com o SDK iniciado.
3. Gerar tráfego (HTTP, filas, etc.).
4. Abrir **http://localhost:16686**, escolher o serviço pelo nome configurado e inspecionar traces.
