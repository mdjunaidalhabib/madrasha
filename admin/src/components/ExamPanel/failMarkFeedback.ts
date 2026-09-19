import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";

/**
 * Toast after a fail-mark save (global or per-division). Saving only stores
 * the setting: already-processed results are never touched here. They change
 * only when the admin reviews and confirms a পুনঃগণনা - the grading page's
 * recalculation banner lights up as soon as something would change.
 */
export function reportFailMarkSaved(savedMessage = "আপডেট হয়েছে!") {
  useToastStore
    .getState()
    .show(`${savedMessage} — ফলাফলে প্রয়োগ করতে "ফলাফল পুনঃগণনা" চাপুন`, "success");
}
