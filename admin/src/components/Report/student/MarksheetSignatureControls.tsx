import { ArrowDown, ArrowUp, ListChecks, PenLine, RotateCcw, X } from "lucide-react";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { ToggleSwitch } from "../../settings/ToggleSwitch";
import { useBrandingStore } from "../../../store/brandingStore";
import {
  DEFAULT_MARKSHEET_FIELDS,
  MARKSHEET_FIELD_LABELS_BN,
  saveBranding,
  type MarksheetFieldItem,
  type MarksheetSignaturePosition,
} from "../../../services/brandingApi";
import {
  SIGNATURE_KEYS,
  SIGNATURE_LABELS,
  SIGNATURE_POSITIONS,
  SIGNATURE_POSITION_LABELS,
  applySignatureChange,
  getSignatureSettings,
  type SignatureKey,
} from "./marksheetSignatures";

/** Reads/writes the marksheet field settings (info-field visibility/order plus
 * signature visibility/side - one stored list). The preview updates instantly
 * (optimistic), then the change is saved to the madrasa branding - the same
 * stored setting the সেটিংস page uses, so both places always agree - and rolled
 * back with an error toast if saving fails. */
const useMarksheetFieldSettings = () => {
  const branding = useBrandingStore((s) => s.branding);
  const setBranding = useBrandingStore((s) => s.setBranding);
  const fields: MarksheetFieldItem[] = branding?.marksheet_fields?.length
    ? branding.marksheet_fields
    : DEFAULT_MARKSHEET_FIELDS;

  const save = async (next: MarksheetFieldItem[]) => {
    if (!branding) return;
    setBranding({ ...branding, marksheet_fields: next });
    try {
      await saveBranding({ marksheet_fields: next });
    } catch {
      setBranding(branding);
      useToastStore.getState().show("সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।", "error");
    }
  };

  return { fields, save };
};

const isSignatureKey = (key: string) => (SIGNATURE_KEYS as string[]).includes(key);

const rowClass = (visible: boolean) =>
  `flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 transition ${
    visible
      ? "border-gray-100 dark:border-slate-800"
      : "border-gray-100 bg-gray-50 opacity-60 dark:border-slate-800 dark:bg-slate-800/40"
  }`;

const arrowClass =
  "flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:bg-transparent disabled:hover:text-gray-500 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60";

/** One row per info field (নাম, রোল, ...): visibility switch + up/down to reorder. */
export const MarksheetFieldRows = () => {
  const { fields, save } = useMarksheetFieldSettings();
  const infoFields = fields.filter((f) => !isSignatureKey(f.key));
  const signatureFields = fields.filter((f) => isSignatureKey(f.key));

  const toggle = (key: string, visible: boolean) => save(fields.map((f) => (f.key === key ? { ...f, visible } : f)));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= infoFields.length) return;
    const next = [...infoFields];
    [next[index], next[target]] = [next[target], next[index]];
    save([...next, ...signatureFields]);
  };

  return (
    <div className="space-y-1">
      {infoFields.map((field, index) => (
        <div key={field.key} className={rowClass(field.visible)}>
          <div className="flex items-center gap-2">
            <ListChecks size={14} className="shrink-0 text-gray-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {MARKSHEET_FIELD_LABELS_BN[field.key] || field.key}
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
              disabled={index === infoFields.length - 1}
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

/** One row per signature: name, বাম/মাঝ/ডান side picker and an on/off switch. */
export const MarksheetSignatureRows = () => {
  const { fields, save } = useMarksheetFieldSettings();
  const settings = getSignatureSettings(fields);

  const update = (key: SignatureKey, change: { visible?: boolean; position?: MarksheetSignaturePosition }) =>
    save(applySignatureChange(fields, key, change));

  return (
    <div className="space-y-1">
      {settings.map((signature) => (
        <div key={signature.key} className={`${rowClass(signature.visible)} flex-col !items-stretch !justify-start gap-1.5`}>
          <span
            className={`text-sm font-medium ${
              signature.visible ? "text-gray-700 dark:text-slate-300" : "text-gray-400 dark:text-slate-500"
            }`}
          >
            {SIGNATURE_LABELS[signature.key]}
          </span>
          <div className="flex items-center gap-2.5">
            <div
              role="group"
              aria-label="স্বাক্ষরের অবস্থান"
              className={`flex flex-1 overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 ${
                signature.visible ? "" : "pointer-events-none opacity-40"
              }`}
            >
              {SIGNATURE_POSITIONS.map((position) => (
                <button
                  key={position}
                  type="button"
                  onClick={() => update(signature.key, { position })}
                  aria-pressed={signature.position === position}
                  className={`flex-1 px-2.5 py-1 text-xs font-semibold transition ${
                    signature.position === position
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {SIGNATURE_POSITION_LABELS[position]}
                </button>
              ))}
            </div>
            <ToggleSwitch checked={signature.visible} onChange={(visible) => update(signature.key, { visible })} />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Every marksheet control in one stack: info fields (show/hide + order), the two
 * signatures (show/hide + side) and a reset. Shared by the সেটিংস page and the
 * report preview toolbar. */
export const MarksheetControlsPanel = () => {
  const { save } = useMarksheetFieldSettings();

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
        তথ্য ফিল্ড — কোনটা দেখাবেন আর কোন ক্রমে
      </p>
      <MarksheetFieldRows />

      <p className="mb-1 mt-3 text-xs font-semibold text-gray-500 dark:text-slate-400">
        নিচের স্বাক্ষর — কোনটা দেখাবেন আর কোন পাশে
      </p>
      <MarksheetSignatureRows />

      <button
        type="button"
        onClick={() => save(DEFAULT_MARKSHEET_FIELDS)}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        <RotateCcw size={12} />
        ডিফল্টে ফিরিয়ে আনুন
      </button>
    </div>
  );
};

/** Toolbar button that shows/hides the docked marksheet settings panel. */
export const MarksheetSettingsToggleButton = ({ open, onToggle }: { open: boolean; onToggle: () => void }) => (
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
    মার্কশিট সেটিং
  </button>
);

/** Marksheet settings panel. On lg+ screens it is docked next to the preview (sticky,
 * the preview shrinks to make room so changes show live). On phones/tablets it slides in
 * from the right edge as a side drawer over a dimmed backdrop - tap outside or ✕ to
 * close - instead of being pushed below the whole preview. */
export const MarksheetSettingsPanel = ({ onClose }: { onClose: () => void }) => (
  <>
    <div aria-hidden="true" onClick={onClose} className="no-print fixed inset-0 z-30 bg-slate-900/40 lg:hidden" />
    <aside
      role="dialog"
      aria-label="মার্কশিট সেটিং"
      className="no-print animate-sideDrawer fixed inset-y-0 right-0 z-40 flex w-[min(88vw,340px)] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:inset-y-auto lg:right-auto lg:top-3 lg:z-auto lg:m-3 lg:ml-0 lg:max-h-[calc(100vh-1.5rem)] lg:w-[320px] lg:shrink-0 lg:animate-none lg:rounded-xl lg:border lg:shadow-sm"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">মার্কশিট সেটিং</h3>
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
        <MarksheetControlsPanel />
      </div>
    </aside>
  </>
);
