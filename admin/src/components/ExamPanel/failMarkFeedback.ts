import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { getText } from "@madrasha/shared-ui/src/i18n";
import { examPanelText } from "./examPanel.text";

/**
 * Toast after a fail-mark save (global or per-division). Saving only stores
 * the setting: already-processed results are never touched here. They change
 * only when the admin reviews and confirms a পুনঃগণনা - the grading page's
 * recalculation banner lights up as soon as something would change.
 */
export function reportFailMarkSaved(savedMessage?: string) {
  const t = getText(examPanelText);
  useToastStore.getState().show(t.failMarkSaved(savedMessage ?? t.updatedDefault), "success");
}
