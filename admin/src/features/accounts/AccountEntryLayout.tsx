import { Children, ReactNode, SelectHTMLAttributes, useRef, useState } from "react";
import { ChevronDown, LoaderCircle, ReceiptText, Save, UserRound, Wallet } from "lucide-react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import "./account-entry.css";
import { handleAccountEntryKeyDown } from "./accountEntryKeyboard";

export function AccountEntrySelect({
  value,
  children,
  className,
  disabled,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`account-entry-select ${disabled ? "opacity-60" : ""}`}>
      <div aria-hidden="true" className="account-entry-select-value">
        <span>{value || "\u00a0"}</span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </div>
      <select
        {...props}
        value={value}
        disabled={disabled}
        className={`${className ?? ""} account-entry-native-select`}
      >
        {children}
      </select>
    </div>
  );
}

export function FieldLabel({
  children,
  required = false,
}: {
  children: string;
  required?: boolean;
}) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
      {children} {required && <span className="text-rose-600 dark:text-rose-400">*</span>}
    </span>
  );
}

export function AccountEntrySection({
  title,
  children,
  kind = "transaction",
}: {
  title: string;
  children: ReactNode;
  kind?: "transaction" | "party" | "payment";
}) {
  const Icon = kind === "party" ? UserRound : kind === "payment" ? Wallet : ReceiptText;
  return (
    <section className="account-entry-section">
      <div className="account-entry-section-heading flex items-center gap-2">
        <Icon
          size={14}
          strokeWidth={1.75}
          aria-hidden="true"
          className="shrink-0 text-slate-400 dark:text-slate-500"
        />
        <h2 className="shrink-0 whitespace-nowrap text-sm font-semibold text-slate-500 dark:text-slate-400">
          {title}
        </h2>
        <span
          aria-hidden="true"
          className="h-px min-w-0 flex-1 bg-slate-200/70 dark:bg-slate-800"
        />
      </div>
      <div
        className={`account-entry-fields grid min-w-0 gap-4 ${
          kind === "transaction"
            ? "grid-cols-2 gap-x-3 lg:grid-cols-4 lg:gap-x-4"
            : (kind === "party" || kind === "payment") && Children.count(children) === 3
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

export default function AccountEntryLayout({
  children,
  onSave,
  title,
  subtitle,
  submitLabel,
}: {
  children: ReactNode;
  onSave: () => Promise<void>;
  title: string;
  subtitle: string;
  submitLabel: string;
}) {
  const c = useText(commonText);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // Ref locks immediately, including clicks arriving before React renders disabled.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave();
    } catch {
      // The shared API interceptor displays request errors; preserve the form for retry.
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
      aria-busy={saving}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLTextAreaElement &&
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          !event.nativeEvent.isComposing &&
          event.keyCode !== 229
        ) {
          event.preventDefault();
          if (!event.repeat) event.currentTarget.requestSubmit();
          return;
        }
        handleAccountEntryKeyDown(event);
      }}
      className="account-entry-card min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_-4px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-5 sm:px-6 dark:border-slate-800">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400">
          <ReceiptText size={22} strokeWidth={1.7} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-snug text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
      </header>
      <fieldset disabled={saving} className="min-w-0 space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        {children}
      </fieldset>
      <div className="flex justify-center border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-800/40">
        <Button
          type="submit"
          disabled={saving}
          className="account-entry-save min-h-11 min-w-40 max-w-full px-6 disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? (
            <LoaderCircle size={18} aria-hidden="true" className="animate-spin" />
          ) : (
            <Save size={18} aria-hidden="true" />
          )}
          {saving ? c.processing : submitLabel}
        </Button>
      </div>
    </form>
  );
}
