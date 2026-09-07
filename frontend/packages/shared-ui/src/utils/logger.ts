/**
 * No-op logger.
 *
 * Errors are still caught and handled in each component (state/UI shown to
 * the user) — this just stops anything from being printed to the browser
 * console, in dev mode and production both.
 */
export const logger = {
  error: (_message: string, ..._meta: unknown[]) => {},
  warn: (_message: string, ..._meta: unknown[]) => {},
  info: (_message: string, ..._meta: unknown[]) => {},
};
