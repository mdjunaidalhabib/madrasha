import { AsyncLocalStorage } from "node:async_hooks";

/** Tracks persisted service logs in this request only, including async handlers. */
export type ActivityRequestContext = {
  logged: Array<{ id?: number; madrasaId: number | null; userId: number | null; entity: string }>;
};
export const activityContext = new AsyncLocalStorage<ActivityRequestContext>();

/** Older services use singular/uppercase names; compare their module families. */
export function sameActivityModule(requestEntity: string, loggedEntity: string): boolean {
  const family = (entity: string) => {
    const base = entity.toLowerCase().split("/")[0];
    const aliases: Record<string, string> = {
      user: "users",
      account: "accounts",
      income: "accounts",
      expense: "accounts",
      fund_settings: "accounts",
      category_settings: "accounts",
      documenttemplate: "document-templates",
    };
    return aliases[base] ?? base;
  };
  const requested = family(requestEntity);
  const logged = family(loggedEntity);
  return requested === logged || (requested === "auth" && ["users", "security"].includes(logged));
}
