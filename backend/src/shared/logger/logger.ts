type LogLevel = "debug" | "info" | "warn" | "error";

const isProduction = process.env.NODE_ENV === "production";

function serializeMeta(meta?: unknown) {
  if (!meta) return undefined;
  if (meta instanceof Error) {
    return { name: meta.name, message: meta.message, stack: meta.stack };
  }
  return meta;
}

function write(level: LogLevel, message: string, meta?: unknown) {
  if (level === "debug" && isProduction) return;

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(serializeMeta(meta) ? { meta: serializeMeta(meta) } : {}),
  };

  const line = isProduction
    ? JSON.stringify(payload)
    : `[${payload.timestamp}] ${level.toUpperCase()} ${message}${meta ? ` ${JSON.stringify(payload.meta)}` : ""}`;

  if (level === "error") return console.error(line);
  if (level === "warn") return console.warn(line);
  return console.log(line);
}

export const logger = {
  debug: (message: string, meta?: unknown) => write("debug", message, meta),
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta),
};
