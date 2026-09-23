import { ArrowDown, ArrowUp, ListChecks, PenLine, RotateCcw, X } from "lucide-react";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { ToggleSwitch } from "../../settings/ToggleSwitch";
import { useBrandingStore } from "../../../store/brandingStore";
import {
  ADMIT_CARD_FIELD_LABELS_BN,
  DEFAULT_ADMIT_CARD_FIELDS,
  saveBranding,
  type AdmitCardFieldItem,
} from "../../../services/brandingApi";

/** Reads/writes the admit card's "ডিফল্ট (সাধারণ)" design field settings
 * (visibility/order - one stored list, same pattern as marksheet_fields, see
 * MarksheetSignatureControls.tsx). Optimistic update, rolled back with a
 * toast on save failure. Only affects the plain builtin design - the other
 * ready-made admit-card designs (formal blue/islamic green/modern sidebar)
 * and any DB template keep their own fixed layout. */
const useAdmitCardFieldSettings = () => {
  const branding = useBrandingStore((s) => s.branding);
  const setBranding = useBrandingStore((s) => s.setBranding);
  const fields: AdmitCardFieldItem[] = branding?.admit_card_fields?.length
    ? branding.admit_card_fields
    : DEFAULT_ADMIT_CARD_FIELDS;

  const save = async (next: AdmitCardFieldItem[]) => {
    if (!branding) return;
    setBranding({ ...branding, admit_card_fields: next });
    try {
      await saveBranding({ admit_card_fields: next });
    } catch {
      setBranding(branding);
      useToastStore.getState().show("সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।", "error");
    }
  };

  return { fields, save };
};

const rowClass = (visible: boolean) =>
  `flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 transition ${
    visible
      ? "border-gray-100 dark:border-slate-800"
      : "border-gray-100 bg-gray-50 opacity-60 dark:border-slate-800 dark:bg-slate-800/40"
  }`;

const arrowClass =
  "flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:hover:text-gray-500 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60";

/** One row per info field (নাম, পিতার নাম, ...): visibility switch + up/down to reorder. */
export const AdmitCardFieldRows = () => {
  const { fields, save } = useAdmitCardFieldSettings();

  const toggle = (key: string, visible: boolean) => save(fields.map((f) => (f.key === key ? { ...f, visible } : f)));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  };

  return (
    <div className="space-y-1">
      {fields.map((field, index) => (
        <div key={field.key} className={rowClass(field.visible)}>
          <div className="flex items-center gap-2">
            <ListChecks size={14} className="shrink-0 text-gray-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {ADMIT_CARD_FIELD_LABELS_BN[field.key] || field.key}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label="উপরে সরান"
              className={arrowClass}
            >
              <ArrowUp size={12} />
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === fields.length - 1}
              aria-label="নিচে সরান"
              className={arrowClass}
            >
              <ArrowDown size={12} />
            </button>
            <ToggleSwitch checked={field.visible} onChange={(visible) => toggle(field.key, visible)} />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Every admit-card "ডিফল্ট" design control in one stack: info fields (show/hide +
 * order) and a reset. Shared by the settings page (if added later) and the report
 * preview toolbar. */
export const AdmitCardControlsPanel = () => {
  const { save } = useAdmitCardFieldSettings();

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
        তথ্য ফিল্ড — কোনটা দেখাবেন আর কোন ক্রমে
      </p>
      <AdmitCardFieldRows />

      <button
        type="button"
        onClick={() => save(DEFAULT_ADMIT_CARD_FIELDS)}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        <RotateCcw size={12} />
        ডিফল্টে ফিরিয়ে আনুন
      </button>
    </div>
  );
};

/** Toolbar button that shows/hides the docked admit-card field settings panel. */
export const AdmitCardSettingsToggleButton = ({ open, onToggle }: { open: boolean; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    className={`flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 text-[13px] font-semibold transition ${
      open
        ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400"
        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    }`}
  >
    <PenLine className="h-3 w-3" />
    ফিল্ড সেটিং
  </button>
);

/** Admit-card field settings panel - same docked/drawer layout as MarksheetSettingsPanel. */
export const AdmitCardSettingsPanel = ({ onClose }: { onClose: () => void }) => (
  <>
    <div aria-hidden="true" onClick={onClose} className="no-print fixed inset-0 z-30 bg-slate-900/40 lg:hidden" />
    <aside
      role="dialog"
      aria-label="প্রবেশপত্র ফিল্ড সেটিং"
      className="no-print animate-sideDrawer fixed inset-y-0 right-0 z-40 flex w-[min(88vw,340px)] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:inset-y-auto lg:right-auto lg:top-3 lg:z-auto lg:m-3 lg:ml-0 lg:max-h-[calc(100vh-1.5rem)] lg:w-[320px] lg:shrink-0 lg:animate-none lg:rounded-xl lg:border lg:shadow-sm"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">প্রবেশপত্র ফিল্ড সেটিং</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="সেটিং প্যানেল বন্ধ করুন"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X size={15} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <AdmitCardControlsPanel />
      </div>
    </aside>
  </>
);
