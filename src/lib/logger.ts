import pino from "pino";

import { context, trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";

const OT_LOG_SCOPE = "upload-sas-test";

/** Atributos OTLP aceitam apenas tipos serializáveis planos no envio típico. */
function flattenForOtel(attributes: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  let count = 0;
  const maxKeys = 32;
  const maxLen = 1024;

  for (const [rawKey, v] of Object.entries(attributes)) {
    if (count >= maxKeys) break;
    if (rawKey === "msg" || rawKey === "time" || rawKey === "level" || rawKey === "hostname" || rawKey === "pid")
      continue;

    let key = rawKey.startsWith(".") ? rawKey.slice(1) : rawKey;
    if (["trace_id", "span_id", "trace_flags"].includes(key)) continue;

    let val: unknown = v;
    if (typeof val === "bigint") val = Number(val);

    if (typeof val === "string") {
      out[key] = val.length > maxLen ? `${val.slice(0, maxLen)}…` : val;
      count++;
    } else if (typeof val === "number" || typeof val === "boolean") {
      out[key] = val;
      count++;
    } else if (val == null) {
      out[key] = "null";
      count++;
    } else if (typeof val === "object") {
      try {
        const s = JSON.stringify(val);
        out[key] = s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
        count++;
      } catch {
        out[key] = "[unserializable]";
        count++;
      }
    } else {
      out[key] = String(val).slice(0, maxLen);
      count++;
    }
  }

  return out;
}

/** Atributos de evento em span só aceitam tipos escalares OTel comuns; JSON para o restante. */
function flattenForSpan(
  severityText: string,
  message: string,
  mergedObject: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {
    severity: severityText,
  };

  let count = Object.keys(out).length;
  const maxKeys = 24;
  const maxStr = 640;

  if (message.length > 0) {
    out.msg = message.length > maxStr ? `${message.slice(0, maxStr)}…` : message;
    count++;
  }

  for (const [rawKey, v] of Object.entries(mergedObject)) {
    if (count >= maxKeys) break;
    if (
      rawKey === "msg" ||
      rawKey === "level" ||
      rawKey === "time" ||
      rawKey === "hostname" ||
      rawKey === "pid" ||
      rawKey === "name"
    ) {
      continue;
    }
    if (["trace_id", "span_id", "trace_flags"].includes(rawKey)) continue;

    const key = `log.${rawKey}`;
    if (typeof v === "string") {
      out[key] = v.length > maxStr ? `${v.slice(0, maxStr)}…` : v;
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[key] = v;
    } else if (v == null) {
      out[key] = "null";
    } else {
      try {
        const s = JSON.stringify(v);
        out[key] = s.length > maxStr ? `${s.slice(0, maxStr)}…` : s;
      } catch {
        out[key] = "[object]";
      }
    }
    count++;
  }

  return out;
}

/** Nível interno numérico do Pino ao enviar via hook (10–60 em níveis pré-definidos). */
function pinoLevelNumToSeverity(level: number): { severityNumber: SeverityNumber; severityText: string } {
  if (level >= 60) return { severityNumber: SeverityNumber.FATAL, severityText: "FATAL" };
  if (level >= 50) return { severityNumber: SeverityNumber.ERROR, severityText: "ERROR" };
  if (level >= 40) return { severityNumber: SeverityNumber.WARN, severityText: "WARN" };
  if (level >= 30) return { severityNumber: SeverityNumber.INFO, severityText: "INFO" };
  if (level >= 20) return { severityNumber: SeverityNumber.DEBUG, severityText: "DEBUG" };
  return { severityNumber: SeverityNumber.TRACE, severityText: "TRACE" };
}

type LogMethodArgs = [unknown, ...unknown[]];

function deriveMessageAndMergedObject(args: unknown[]): {
  mergedObject: Record<string, unknown>;
  message: string;
} {
  const mergedObject: Record<string, unknown> = {};
  const parts: string[] = [];

  if (args[0] != null && typeof args[0] === "object" && !Buffer.isBuffer(args[0]) && !Array.isArray(args[0])) {
    Object.assign(mergedObject, args[0] as Record<string, unknown>);
    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      if (typeof a === "string") parts.push(a);
      else if (typeof a === "number" || typeof a === "boolean") parts.push(String(a));
      else if (a instanceof Error && a.message.length > 0) parts.push(a.message);
      else if (a != null) {
        try {
          parts.push(JSON.stringify(a));
        } catch {
          parts.push(String(a));
        }
      }
    }
  } else {
    for (const a of args) {
      if (typeof a === "string") parts.push(a);
      else if (typeof a === "number" || typeof a === "boolean") parts.push(String(a));
      else if (a instanceof Error && a.message.length > 0) parts.push(a.message);
      else if (a != null && typeof a !== "object") {
        parts.push(String(a));
      }
    }
  }

  let message = parts.join(" ");
  const mergedMsg = mergedObject.msg ?? mergedObject.message;
  if (typeof mergedMsg === "string" && message.length === 0) message = mergedMsg;

  return { mergedObject, message };
}

export const logger = pino({
  name: OT_LOG_SCOPE,
  level: process.env.LOG_LEVEL ?? "info",

  mixin(mergeObject, levelNum) {
    const span = trace.getSpan(context.active());
    if (!span) return {};
    const sc = span.spanContext();
    if (!trace.isSpanContextValid(sc)) return {};
    return {
      trace_id: sc.traceId,
      span_id: sc.spanId,
      trace_flags: `0${sc.traceFlags.toString(16)}`,
      pino_numeric_level: levelNum,
    };
  },

  hooks: {
    logMethod(rawArgs: LogMethodArgs, method: (this: pino.Logger, ...args: unknown[]) => unknown, level: number): void {
      const argsArray = [...rawArgs];

      try {
        const { severityNumber, severityText } = pinoLevelNumToSeverity(level);
        const { mergedObject, message } = deriveMessageAndMergedObject(argsArray);
        const attrs = flattenForOtel({ ...mergedObject });
        const eventNameHint = attrs.event;
        const eventName =
          typeof eventNameHint === "string" && eventNameHint.length > 0
            ? `app.${eventNameHint}`
            : "logsDaAplicacao";

        logs.getLogger(OT_LOG_SCOPE).emit({
          context: context.active(),
          severityNumber,
          severityText,
          body: message || undefined,
          attributes: attrs,
          eventName,
        });

        const span = trace.getSpan(context.active());
        if (span?.isRecording()) {
          span.addEvent("application.log", flattenForSpan(severityText, message, mergedObject));
        }
      } catch {
        /** LoggerProvider noop ou exportador indisponível — continua apenas com stdout Pino. */
      }

      Reflect.apply(method as (this: pino.Logger, ...a: unknown[]) => unknown, this, argsArray);
    },
  },
});
