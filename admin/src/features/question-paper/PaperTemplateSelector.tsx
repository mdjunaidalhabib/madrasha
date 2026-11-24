import { useEffect, useRef, useState, type RefObject } from "react";
import { Bold, Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { useLang } from "@madrasha/shared-ui/src/i18n";
import {
  paperTemplateApi,
  type ClosingTemplate,
  type TemplateKind,
} from "../../services/questionPaperApi";

type Props = {
  kind: TemplateKind;
  templates: ClosingTemplate[];
  onTemplatesChange: (items: ClosingTemplate[]) => void;
  text: string;
  bold: boolean;
  onToggleBold: () => void;
  onTextChange: (text: string) => void;
  customText: string;
  onCustomTextChange: (text: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  busy: boolean;
  loading: boolean;
  onBusyChange: (busy: boolean) => void;
  onError: (text: string) => void;
  errorMessage: (error: unknown) => string;
  onSuccess: (text: string) => void;
};

export default function PaperTemplateSelector(props: Props) {
  const dropdownRef = useRef<HTMLDetailsElement>(null);
  const lang = useLang();
  const t = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const instruction = props.kind === "instruction";
  const api = paperTemplateApi(props.kind);
  const limit = instruction ? 10000 : 500;
  const selected = props.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const notes = Array.from(new Set([...props.templates.map((item) => item.text), ...selected]));
  const [editing, setEditing] = useState<{ template: ClosingTemplate; text: string } | null>(null);
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        dropdownRef.current.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dropdownRef.current?.open) {
        dropdownRef.current.open = false;
        dropdownRef.current.querySelector<HTMLElement>("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  const lengthError = instruction
    ? t(
        "নির্দেশনা সর্বোচ্চ ১০০০০ অক্ষরের হতে পারবে।",
        "Instructions can contain up to 10000 characters.",
      )
    : t(
        "সমাপ্তির লেখা সর্বোচ্চ ৫০০ অক্ষরের হতে পারবে।",
        "Closing text can contain up to 500 characters.",
      );

  const changeSelection = (next: string[]) => {
    const text = Array.from(new Set(next)).join("\n");
    if (text.length > limit) {
      props.onError(lengthError);
      return;
    }
    props.onTextChange(text);
    props.onError("");
  };
  const create = async () => {
    const text = props.customText.trim();
    if (!text || props.busy) return;
    props.onBusyChange(true);
    try {
      const result = await api.create(text);
      if (!props.templates.some((item) => item.id === result.id))
        props.onTemplatesChange([...props.templates, result]);
      props.onCustomTextChange("");
      props.onSuccess(t("নতুন টেমপ্লেট তৈরি হয়েছে।", "New template created."));
      if (!selected.includes(result.text)) changeSelection([...selected, result.text]);
    } catch (error) {
      props.onError(props.errorMessage(error));
    } finally {
      props.onBusyChange(false);
    }
  };
  const saveEdit = async () => {
    if (!editing || !editing.text.trim() || props.busy) return;
    const text = editing.text.trim();
    const next = Array.from(
      new Set(selected.map((note) => (note === editing.template.text ? text : note))),
    ).join("\n");
    if (next.length > limit) {
      props.onError(lengthError);
      return;
    }
    props.onBusyChange(true);
    try {
      const result = await api.update(editing.template.id, text);
      props.onTemplatesChange(
        props.templates.map((item) => (item.id === result.id ? result : item)),
      );
      if (selected.includes(editing.template.text)) props.onTextChange(next);
      setEditing(null);
      props.onSuccess(t("টেমপ্লেট আপডেট হয়েছে।", "Template updated."));
    } catch (error) {
      props.onError(props.errorMessage(error));
    } finally {
      props.onBusyChange(false);
    }
  };
  const remove = async (template: ClosingTemplate) => {
    if (props.busy) return;
    props.onBusyChange(true);
    try {
      await api.remove(template.id);
      props.onTemplatesChange(props.templates.filter((item) => item.id !== template.id));
      if (selected.includes(template.text))
        props.onTextChange(selected.filter((note) => note !== template.text).join("\n"));
      if (editing?.template.id === template.id) setEditing(null);
      props.onSuccess(t("টেমপ্লেট মুছে ফেলা হয়েছে।", "Template deleted."));
    } catch (error) {
      props.onError(props.errorMessage(error));
    } finally {
      props.onBusyChange(false);
    }
  };

  return (
    <fieldset
      className={`qp-full qp-closing-fields ${instruction ? "qp-instruction-field" : "qp-closing-field"}`}
      aria-label={
        instruction
          ? t("নির্দেশনার টেমপ্লেট", "Instruction templates")
          : t("সমাপ্তির টেমপ্লেট", "Closing templates")
      }
    >
      <legend className="qp-field-heading">
        <span>
          {instruction ? t("নির্দেশনা", "Instructions") : t("সমাপ্তির লেখা", "Closing text")}
        </span>
        <span className="qp-section-rule" aria-hidden="true" />
        <button
          type="button"
          className="qp-button qp-format-button qp-field-bold"
          aria-label={instruction ? t("নির্দেশনা বোল্ড", "Bold instructions") : t("সমাপ্তির লেখা বোল্ড", "Bold closing text")}
          title={instruction ? t("নির্দেশনা বোল্ড", "Bold instructions") : t("সমাপ্তির লেখা বোল্ড", "Bold closing text")}
          aria-pressed={props.bold}
          onClick={props.onToggleBold}
        >
          <Bold size={12} strokeWidth={2.5} />
        </button>
      </legend>
      <details className="qp-template-dropdown" ref={dropdownRef}>
        <summary className="qp-template-dropdown-trigger">
          <span>
            {selected.length
              ? t(`বাছাই করা: ${selected.length}`, `Selected: ${selected.length}`)
              : t("লেখা বাছাই করুন", "Choose text")}
          </span>
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div className="qp-template-dropdown-menu">
      <div className="qp-closing-options">
        {notes.map((note) => {
          const template = props.templates.find((item) => item.text === note);
          return (
            <div className="qp-template-row" key={note}>
              {template && editing?.template.id === template.id ? (
                <div className="qp-template-edit">
                  <input
                    autoFocus
                    aria-label={
                      instruction
                        ? t("নির্দেশনার টেমপ্লেট সম্পাদনা", "Edit instruction template text")
                        : t("টেমপ্লেটের লেখা সম্পাদনা", "Edit template text")
                    }
                    value={editing.text}
                    maxLength={500}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void saveEdit();
                      }
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <button
                    type="button"
                    className="qp-button"
                    disabled={!editing.text.trim()}
                    onClick={() => void saveEdit()}
                    aria-label={
                      instruction
                        ? t("নির্দেশনার টেমপ্লেট সংরক্ষণ", "Save instruction template")
                        : t("টেমপ্লেট সংরক্ষণ", "Save template")
                    }
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    className="qp-button"
                    onClick={() => setEditing(null)}
                    aria-label={
                      instruction
                        ? t("নির্দেশনার সম্পাদনা বাতিল", "Cancel instruction template edit")
                        : t("টেমপ্লেট সম্পাদনা বাতিল", "Cancel template edit")
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <label className="qp-closing-choice">
                    <input
                      type="checkbox"
                      checked={selected.includes(note)}
                      disabled={props.loading}
                      onChange={(e) =>
                        changeSelection(
                          e.target.checked
                            ? [...selected, note]
                            : selected.filter((item) => item !== note),
                        )
                      }
                    />
                    <span className={props.bold && selected.includes(note) ? "qp-template-text-bold" : undefined}>{note}</span>
                  </label>
                  {template && (
                    <div className="qp-template-actions">
                      <button
                        type="button"
                        className="touch-manipulation rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                        aria-label={`${instruction ? t("নির্দেশনার টেমপ্লেট সম্পাদনা", "Edit instruction template") : t("টেমপ্লেট সম্পাদনা", "Edit template")}: ${note}`}
                        title={t("সম্পাদনা", "Edit")}
                        onClick={() => setEditing({ template, text: template.text })}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="touch-manipulation rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        aria-label={`${instruction ? t("নির্দেশনার টেমপ্লেট মুছুন", "Delete instruction template") : t("টেমপ্লেট মুছুন", "Delete template")}: ${note}`}
                        title={t("মুছুন", "Delete")}
                        disabled={props.busy}
                        onClick={() => useConfirmStore.getState().show({
                          title: t("এই টেমপ্লেটটি মুছবেন?", "Delete this template?"),
                          message: note,
                          confirmText: t("নিশ্চিত করুন", "Confirm"),
                          danger: true,
                          onConfirm: () => remove(template),
                        })}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="qp-custom-closing-note">
        <input
          ref={props.inputRef}
          aria-label={
            instruction
              ? t("নতুন নির্দেশনার টেমপ্লেট", "New instruction template text")
              : t("নতুন টেমপ্লেটের লেখা", "New template text")
          }
          placeholder={t("নতুন টেমপ্লেটের লেখা লিখুন…", "Write a new template…")}
          value={props.customText}
          maxLength={500}
          onChange={(e) => props.onCustomTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void create();
            }
          }}
        />
        <button
          type="button"
          className="qp-button"
          aria-label={
            instruction
              ? t("নির্দেশনার টেমপ্লেট তৈরি", "Create instruction template")
              : t("টেমপ্লেট তৈরি", "Create template")
          }
          title={
            instruction
              ? t("নির্দেশনার টেমপ্লেট তৈরি", "Create instruction template")
              : t("টেমপ্লেট তৈরি", "Create template")
          }
          onClick={() => void create()}
          disabled={!props.customText.trim() || props.loading}
        >
          <Plus size={15} />
          <span>
            {instruction
              ? t("নির্দেশনার টেমপ্লেট তৈরি", "Create instruction template")
              : t("টেমপ্লেট তৈরি", "Create template")}
          </span>
        </button>
      </div>
        </div>
      </details>
    </fieldset>
  );
}
