import { useState } from "react";
import { FileText, Plus, Save, type LucideIcon } from "lucide-react";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import BrandImageBox from "../../../components/settings/BrandImageBox";
import { PublishToggle } from "../../../components/settings/ToggleSwitch";
import { isPendingCloudUpload } from "../../../utils/cloudUpload";
import { websiteText } from "./website.text";

type Field<T> = {
  key: keyof T & string;
  label: string;
  type?: "text" | "textarea" | "position";
  required?: boolean;
  placeholder?: string;
  hint?: string;
};
type Props<T> = {
  open: boolean;
  title: string;
  editing: boolean;
  draft: T;
  original?: T;
  fields: Field<T>[];
  positions?: number;
  saving: boolean;
  icon?: LucideIcon;
  image?: {
    key: keyof T & string;
    label: string;
    hint: string;
    ratio?: string;
    resizeTo?: { width: number; height: number };
  };
  previewUrl?: string | null;
  onChange: (patch: Partial<T>) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
};

export default function WebsiteItemDialog<T extends { is_published?: 0 | 1 }>({
  open,
  title,
  editing,
  draft,
  original,
  fields,
  positions = 1,
  saving,
  icon: Icon = FileText,
  image,
  previewUrl,
  onChange,
  onClose,
  onSubmit,
}: Props<T>) {
  const t = useText(websiteText);
  const c = useText(commonText);
  const [uploading, setUploading] = useState(false);
  const fieldValue = (record: T, field: Field<T>) =>
    field.type === "position"
      ? Number(record[field.key]) || positions
      : String(record[field.key] ?? "");
  const imageUrl = image ? String(draft[image.key] ?? "") : "";
  const changed =
    !editing ||
    (!!original &&
      (fields.some((field) => fieldValue(draft, field) !== fieldValue(original, field)) ||
        (!!image && imageUrl !== String(original[image.key] ?? "")) ||
        (draft.is_published !== 0) !== (original.is_published !== 0)));
  const valid =
    fields.every((field) => !field.required || String(draft[field.key] ?? "").trim()) &&
    (!image || !imageUrl || !isPendingCloudUpload(imageUrl));
  const canSubmit =
    !saving &&
    !uploading &&
    changed &&
    valid &&
    (!image || image.key !== "image_url" || !!imageUrl);
  const update = (key: keyof T, value: unknown) => onChange({ [key]: value } as Partial<T>);
  return (
    <Modal
      open={open}
      title={title}
      closeButtonTone="danger"
      maxWidthClassName="max-w-2xl"
      onClose={() => {
        if (!saving && !uploading) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void onSubmit();
        }}
      >
        <fieldset disabled={saving} className="min-w-0">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <div className="self-start rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-violet-50/60 to-white p-4 dark:border-indigo-900 dark:from-indigo-950/50 dark:via-slate-900 dark:to-slate-900">
              <div className="mb-4 flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-indigo-900">
                  <Icon size={18} />
                </span>
                <span className="text-sm font-semibold">{title}</span>
              </div>
              {image ? (
                <>
                  <BrandImageBox
                    label={image.label}
                    folder="gallery"
                    variant="gallery"
                    imageFit="cover"
                    shape={image.resizeTo ? "wide" : "square"}
                    ratioLabel={image.ratio}
                    resizeTo={image.resizeTo}
                    value={imageUrl}
                    onChange={(url) => update(image.key, url)}
                    onRemove={() => update(image.key, "")}
                    onUploadingChange={setUploading}
                  />
                  <p className="mt-3 text-xs leading-relaxed text-indigo-700/80 dark:text-indigo-300">
                    {image.hint}
                  </p>
                </>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt={title}
                  className="aspect-video w-full rounded-xl object-cover"
                />
              ) : (
                <div className="rounded-xl border border-indigo-100 bg-white/80 p-4 dark:border-indigo-900 dark:bg-slate-900/80">
                  <p className="break-words text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {String(draft[fields[0].key] ?? "") || fields[0].placeholder || title}
                  </p>
                  {fields.find((field) => field.type === "textarea") && (
                    <p className="mt-3 line-clamp-6 whitespace-pre-line break-words text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                      {String(draft[fields.find((field) => field.type === "textarea")!.key] ?? "")}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-4">
              {fields.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                    {field.label}
                  </span>
                  {field.type === "position" ? (
                    <select
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      value={Number(fieldValue(draft, field))}
                      onChange={(event) => update(field.key, Number(event.target.value))}
                    >
                      {Array.from({ length: positions }, (_, index) => index + 1).map(
                        (position) => (
                          <option key={position} value={position}>
                            {position}
                            {position === positions ? t.atEnd : ""}
                          </option>
                        ),
                      )}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      required={field.required}
                      rows={5}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      value={String(fieldValue(draft, field))}
                      onChange={(event) => update(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <Input
                      required={field.required}
                      value={String(fieldValue(draft, field))}
                      onChange={(event) => update(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                  {field.hint && (
                    <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
                      {field.hint}
                    </span>
                  )}
                </label>
              ))}
              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <PublishToggle
                  checked={draft.is_published !== 0}
                  onChange={(enabled) => onChange({ is_published: enabled ? 1 : 0 } as Partial<T>)}
                />
                <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                  {t.itemPublishHint}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end border-t border-gray-100 pt-4 dark:border-slate-800">
            <Button type="submit" disabled={!canSubmit} className="gap-2">
              {editing ? <Save size={16} /> : <Plus size={16} />}
              {saving ? c.saving : editing ? c.save : c.add}
            </Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

export function WebsiteAddCard({
  label,
  onClick,
  className = "",
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={`flex min-h-28 items-center justify-center gap-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4 text-sm font-semibold text-indigo-700 transition hover:border-indigo-500 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-900 dark:bg-indigo-950/20 dark:text-indigo-300 ${className}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
        <Plus size={18} />
      </span>
      {label}
    </button>
  );
}
