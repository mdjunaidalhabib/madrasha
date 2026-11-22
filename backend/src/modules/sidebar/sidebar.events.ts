import { logger } from "../../shared/logger/logger";

const subscribers = new Map<number, Set<() => void>>();

export function subscribeSidebarChanges(madrasaId: number, listener: () => void) {
  let listeners = subscribers.get(madrasaId);
  if (!listeners) subscribers.set(madrasaId, (listeners = new Set()));
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && subscribers.get(madrasaId) === listeners) subscribers.delete(madrasaId);
  };
}

/** Called only after the admission transaction has committed. */
export function publishSidebarChange(madrasaId: number) {
  for (const listener of subscribers.get(madrasaId) || []) {
    try {
      listener();
    } catch (error) {
      logger.error("Sidebar subscriber failed:", error);
    }
  }
}
