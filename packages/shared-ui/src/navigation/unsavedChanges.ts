import { useEffect, useRef } from "react";
import { useConfirmStore } from "../store/confirmStore";
import { getText } from "../i18n";
import { navText } from "./nav.text";

/**
 * Registry of "this screen has unsaved input" flags.
 *
 * A form page calls `useUnsavedChangesGuard(isDirty)`. While any registered
 * source is dirty, NavigationController warns on browser close/reload and on
 * in-app navigation (menu, Back button, browser/Android Back), and the global
 * Refresh button asks first. Unmounting a form clears its flag automatically.
 */
const dirtySources = new Set<symbol>();
let skipUnloadWarning = false;

export const hasUnsavedChanges = () => dirtySources.size > 0;

export const suppressUnloadWarningOnce = () => {
  skipUnloadWarning = true;
};

export const shouldWarnOnUnload = () => hasUnsavedChanges() && !skipUnloadWarning;

export function useUnsavedChangesGuard(isDirty: boolean) {
  const id = useRef<symbol>(Symbol("unsaved-changes"));
  useEffect(() => {
    const source = id.current;
    if (isDirty) dirtySources.add(source);
    else dirtySources.delete(source);
    return () => {
      dirtySources.delete(source);
    };
  }, [isDirty]);
}

/** Resolves true if there is nothing unsaved or the user chose to discard it. */
export function confirmDiscardIfDirty(): Promise<boolean> {
  if (!hasUnsavedChanges()) return Promise.resolve(true);
  const t = getText(navText);
  return new Promise<boolean>((resolve) => {
    useConfirmStore.getState().show({
      title: t.unsavedTitle,
      message: t.unsavedMessage,
      confirmText: t.leaveAnyway,
      danger: true,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
