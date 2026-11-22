import type { KeyboardEvent } from "react";

/** Keep text editing and native date/select keys; move between fields at text edges. */
export function handleAccountEntryKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (
    event.defaultPrevented ||
    event.nativeEvent.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  )
    return;
  const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
  const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
  if (!forward && !backward) return;
  const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
  if (event.altKey && horizontal) return;

  const target = event.target;
  if (!(
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  ))
    return;
  const nativeArrows =
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement &&
      !["text", "tel", "email", "search", "url", "password"].includes(target.type));
  if (nativeArrows && !event.altKey) return;

  if (!event.altKey && (horizontal || target instanceof HTMLTextAreaElement)) {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (start === null || end === null || start !== end) return;
    if (backward ? start !== 0 : end !== target.value.length) return;
  }

  const fields = Array.from(
    event.currentTarget.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement
    >("input:not([type='hidden']), select, textarea, button"),
  ).filter((field) => !field.disabled && field.tabIndex >= 0 && field.getClientRects().length > 0);
  const index = fields.indexOf(target);
  if (index < 0) return;
  const next = fields[index + (forward ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
}
