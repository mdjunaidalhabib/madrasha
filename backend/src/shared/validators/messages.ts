import { t, type Localized } from "../i18n";

/**
 * Zod schemas are built once at module load, so a custom message can't be
 * translated where the schema is declared (there is no request yet). vmsg()
 * registers the full dictionary and hands zod the Bangla text as a key;
 * localizeMessage()/localizeZodFlatten() swap it for the request language
 * when the validation error is sent to the client.
 */
const registry = new Map<string, Localized>();

export const vmsg = (dict: Localized): string => {
  registry.set(dict.bn, dict);
  return dict.bn;
};

export const localizeMessage = (message: string): string => {
  const dict = registry.get(message);
  return dict ? t(dict) : message;
};

type Flattened = { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> };

export function localizeZodFlatten<T extends Flattened>(flat: T): T {
  const fieldErrors: Record<string, string[] | undefined> = {};
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    fieldErrors[key] = messages?.map(localizeMessage);
  }
  return { ...flat, formErrors: flat.formErrors.map(localizeMessage), fieldErrors };
}
