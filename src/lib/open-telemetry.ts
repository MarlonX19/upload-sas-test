/**
 * Inicializa o SDK Node OpenTelemetry antes de outros módulos instrumentados.
 * Variáveis: OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT (gRPC/collector traces+logs na 4317), OTEL_SDK_DISABLED.
 *
 * Logs Pino são enviados via API de logs OTLP graças a `logger.ts`; o Collector encaminha o sinal logs
 * (ex.: exportador debug) — o Jaeger mostra cenários através de eventos nos spans quando há contexto ativo.
 */
export async function initializeOpenTelemetry(): Promise<void> {
  if (process.env.OTEL_SDK_DISABLED === "true" || process.env.OTEL_SDK_DISABLED === "1") {
    return;
  }
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-grpc");
  const { OTLPLogExporter } = await import("@opentelemetry/exporter-logs-otlp-grpc");
  const { SimpleSpanProcessor } = await import("@opentelemetry/sdk-trace-node");
  const { BatchLogRecordProcessor } = await import("@opentelemetry/sdk-logs");
  const { resourceFromAttributes } = await import("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME } = await import("@opentelemetry/semantic-conventions");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "upload-sas-test",
    }),
    spanProcessors: [new SimpleSpanProcessor(new OTLPTraceExporter())],
    logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}
