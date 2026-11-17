import { Images, Plus, Save } from "lucide-react";
import { useState } from "react";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import BrandImageBox from "../../../components/settings/BrandImageBox";
import { PublishToggle } from "../../../components/settings/ToggleSwitch";
import type { WebsiteGalleryPayload } from "../../../services/websiteApi";
import { websiteText } from "./website.text";
import { isPendingCloudUpload } from "../../../utils/cloudUpload";

const fieldLabelClass = "mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300";
const selectFieldClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

type Props = {
  open: boolean;
  editing: boolean;
  draft: WebsiteGalleryPayload;
  original?: WebsiteGalleryPayload;
  count: number;
  saving: boolean;
  onChange: (patch: Partial<WebsiteGalleryPayload>) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
};

export default function GalleryImageDialog({ open, editing, draft, original, count, saving, onChange, onClose, onSubmit }: Props) {
  const t = useText(websiteText);
  const c = useText(commonText);
  const positions = Math.max(1, count + (editing ? 0 : 1));
  const [uploading, setUploading] = useState(false);
  const changed = !editing || !!original && (
    (draft.title || "") !== (original.title || "") ||
    draft.image_url !== original.image_url ||
    (draft.sort_order || positions) !== (original.sort_order || positions) ||
    (draft.is_published !== 0) !== (original.is_published !== 0)
  );
  const canSubmit = !saving && !uploading && !!draft.image_url?.trim() && !isPendingCloudUpload(draft.image_url) && changed;
  return (
    <Modal open={open} title={editing ? t.editImage : t.addImage} onClose={() => { if (!saving && !uploading) onClose(); }} maxWidthClassName="max-w-2xl" closeButtonTone="danger">
      <form onSubmit={(event) => { event.preventDefault(); if (canSubmit) void onSubmit(); }}>
        <fieldset disabled={saving} className="min-w-0">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-violet-50/60 to-white p-4 dark:border-indigo-900 dark:from-indigo-950/50 dark:via-slate-900 dark:to-slate-900">
              <div className="mb-4 flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-indigo-900"><Images size={17} /></span>
                <span className="text-sm font-semibold">{t.galleryImage}</span>
                <span className="ms-auto rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold dark:border-indigo-800 dark:bg-slate-900">1:1</span>
              </div>
              <BrandImageBox
                label={c.photo}
                folder="gallery"
                variant="gallery"
                imageFit="cover"
                value={draft.image_url}
                onUploadingChange={setUploading}
                onChange={(image_url) => onChange({ image_url })}
                onRemove={() => onChange({ image_url: "" })}
              />
              <p className="mt-3 text-xs leading-relaxed text-indigo-700/80 dark:text-indigo-300">{t.galleryImageSizeHint}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-5 py-1">
              <div>
                <label htmlFor="gallery-image-title" className={fieldLabelClass}>{t.imageTitle}</label>
                <Input id="gallery-image-title" value={draft.title || ""} onChange={(event) => onChange({ title: event.target.value })} placeholder={t.imageTitlePlaceholder} />
              </div>
              <div>
                <label htmlFor="gallery-image-position" className={fieldLabelClass}>{t.position}</label>
                <select id="gallery-image-position" className={selectFieldClass} value={draft.sort_order || positions} onChange={(event) => onChange({ sort_order: Number(event.target.value) })}>
                  {Array.from({ length: positions }, (_, index) => index + 1).map((position) => <option key={position} value={position}>{position}{position === positions ? t.atEnd : ""}</option>)}
                </select>
              </div>
              <div className="mt-auto rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <PublishToggle checked={draft.is_published !== 0} onChange={(published) => onChange({ is_published: published ? 1 : 0 })} />
                <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-slate-400">{t.galleryPublishHint}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
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
