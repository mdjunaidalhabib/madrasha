import { User } from "lucide-react";
import PhotoPicker from "./PhotoPicker";
import type { UploadFolder } from "../../services/phase4Api";

interface Props {
  value: string | null | undefined;
  onChange: (value: string) => void;
  folder: UploadFolder;
  label: string;
  hint?: string;
  /** false = read-only thumbnail (profile view mode). */
  editable?: boolean;
  className?: string;
}

/**
 * Slim form-section card holding the compact PhotoPicker, styled like the
 * neighbouring info-section cards so it sits natively in admission/profile
 * forms instead of a big centered upload box.
 */
const PhotoFieldCard: React.FC<Props> = ({
  value,
  onChange,
  folder,
  label,
  hint,
  editable = true,
  className = "",
}) => (
  <div
    className={`bg-white shadow-lg px-6 py-4 rounded-xl border border-gray-200 dark:bg-slate-900 dark:border-slate-700 ${className}`}
  >
    {editable ? (
      <PhotoPicker value={value} onChange={onChange} folder={folder} label={label} hint={hint} layout="row" />
    ) : (
      <div className="flex items-center gap-4">
        <div className="h-[104px] w-[78px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
              <User className="h-10 w-10" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</div>
      </div>
    )}
  </div>
);

export default PhotoFieldCard;
