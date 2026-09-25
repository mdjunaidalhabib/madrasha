import { memo, useRef } from "react";
import { AlertCircle, Camera, CheckCircle2, ImagePlus, Loader2, Trash2, User } from "lucide-react";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { hasPhoto, type CardStatus, type PhotoPerson } from "./photoManager";

type Props = {
  person: PhotoPerson;
  status?: CardStatus;
  canEdit: boolean;
  onFile: (person: PhotoPerson, file: File) => void;
  onCamera: (person: PhotoPerson) => void;
  onRemove: (person: PhotoPerson) => void;
};

const actionBtn =
  "inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

/** One passport-style card in the photo grid: 3:4 thumbnail + identity + actions.
 * Saves are immediate - the parent owns the network call, this just shows its state. */
function PhotoCard({ person, status, canEdit, onFile, onCamera, onRemove }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const saving = status === "saving";
  const photo = hasPhoto(person);

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md dark:bg-slate-900 ${
        status === "error"
          ? "border-rose-300 dark:border-rose-800"
          : status === "saved"
            ? "border-emerald-300 dark:border-emerald-800"
            : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <button
        type="button"
        disabled={!canEdit || saving}
        onClick={() => fileRef.current?.click()}
        className="relative block aspect-[3/4] w-full overflow-hidden bg-slate-100 disabled:cursor-default dark:bg-slate-800"
        title={canEdit ? "ছবি আপলোড করতে ক্লিক করুন" : undefined}
      >
        {photo ? (
          <img src={person.image!} alt={person.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300 dark:text-slate-600">
            <User className="h-12 w-12" strokeWidth={1.25} />
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">ছবি নেই</span>
          </div>
        )}

        {/* hover hint (desktop) */}
        {canEdit && !saving && (
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-slate-900/45 opacity-0 transition group-hover:opacity-100 md:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow">
              <ImagePlus className="h-3.5 w-3.5" /> {photo ? "ছবি বদলান" : "ছবি দিন"}
            </span>
          </div>
        )}

        {saving && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-900/55 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[11px] font-medium">সংরক্ষণ হচ্ছে...</span>
          </div>
        )}

        {status === "saved" && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
            <CheckCircle2 className="h-3 w-3" /> সংরক্ষিত
          </span>
        )}
        {status === "error" && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
            <AlertCircle className="h-3 w-3" /> ব্যর্থ
          </span>
        )}
        {!status && !photo && (
          <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-800" />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={person.name}>
            {person.name}
          </div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{person.subtitle || "—"}</div>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-medium">
            {person.roll && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                রোল {toBanglaDigits(person.roll)}
              </span>
            )}
            {person.regNo && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                রেজি. {toBanglaDigits(person.regNo)}
              </span>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="mt-auto flex gap-1.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
              className={`${actionBtn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
              title="ফাইল থেকে আপলোড"
            >
              <ImagePlus className="h-3.5 w-3.5" /> আপলোড
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onCamera(person)}
              className={`${actionBtn} bg-emerald-600 text-white hover:bg-emerald-700`}
              title="ক্যামেরা দিয়ে তুলুন"
            >
              <Camera className="h-3.5 w-3.5" /> ক্যামেরা
            </button>
            {photo && (
              <button
                type="button"
                disabled={saving}
                onClick={() => onRemove(person)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/40"
                title="ছবি মুছুন"
                aria-label="ছবি মুছুন"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(person, file);
        }}
      />
    </div>
  );
}

export default memo(PhotoCard);
