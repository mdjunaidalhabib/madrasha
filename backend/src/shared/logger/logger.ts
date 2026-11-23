type LogLevel = "debug" | "info" | "warn" | "error";
type LogStatus = "created" | "updated" | "unchanged" | "failed";
const statusColors: Record<LogStatus, number> = { created: 32, updated: 33, unchanged: 36, failed: 31 };

const isProduction = process.env.NODE_ENV === "production";

function serializeMeta(meta?: unknown) {
  if (!meta) return undefined;
  if (meta instanceof Error) {
    return { name: meta.name, message: meta.message, stack: meta.stack };
  }
  return meta;
}

function write(level: LogLevel, message: string, meta?: unknown, color?: number) {
  if (level === "debug" && isProduction) return;

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(serializeMeta(meta) ? { meta: serializeMeta(meta) } : {}),
  };

  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  const colorEnabled = color !== undefined && process.env.NO_COLOR === undefined &&
    (process.env.FORCE_COLOR !== undefined ? process.env.FORCE_COLOR !== "0" : !!stream.isTTY);
  const terminalMessage = colorEnabled ? `\x1b[1;${color}m${message}\x1b[0m` : message;
  const line = isProduction
    ? JSON.stringify(payload)
    : `[${payload.timestamp}] ${level.toUpperCase()} ${terminalMessage}${meta ? ` ${JSON.stringify(payload.meta)}` : ""}`;

  if (level === "error") return console.error(line);
  if (level === "warn") return console.warn(line);
  // eslint-disable-next-line no-console -- this is the logger's own sanctioned console wrapper
  return console.log(line);
}

export const logger = {
  status: (status: LogStatus, message: string) => write(status === "failed" ? "error" : "info", message, undefined, statusColors[status]),
  debug: (message: string, meta?: unknown) => write("debug", message, meta),
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta),
};
