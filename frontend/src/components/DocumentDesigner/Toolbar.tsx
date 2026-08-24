import { useRef, useState } from "react";
import { ZoomIn, ZoomOut, Image as ImageIcon, Loader2, X, RectangleVertical, RectangleHorizontal } from "lucide-react";
import Button from "../ui/Button";
import { useToastStore } from "../../store/toastStore";
import type { CanvasBackground } from "./types";
import { detectPageSize, pageSizePx, pxToMm, mmToPx, PAGE_SIZE_LABELS_BN, type PageSizeId } from "./pageSizes";

export interface ToolbarProps {
  name: string;
  onChangeName: (name: string) => void;
  zoom: number;
  onChangeZoom: (zoom: number) => void;
  /** Current canvas size in design-time px. */
  width: number;
  height: number;
  onChangeSize: (width: number, height: number) => void;
  background: CanvasBackground | undefined;
  onChangeBackground: (background: CanvasBackground | undefined) => void;
  /** Uploads a background image file and resolves to a usable URL/data URI.
   * Kept generic so the tenant designer (per-tenant Cloudinary via
   * /uploads/image) and the Super Admin designer (platform Cloudinary) can
   * each plug in their own upload endpoint without this component knowing
   * which one it is. */
  onUploadBackgroundImage: (file: File) => Promise<string>;
  onSaveDraft: () => void;
  saving: boolean;
  onPublish: () => void;
  publishing: boolean;
  isPublished: boolean;
  /** Whether the live editor state differs from what's currently published.
   * When false and isPublished is true, there is nothing new to publish, so
   * the publish button shows "প্রকাশিত" and stays disabled instead of
   * offering a no-op republish. */
  hasChanges: boolean;
  saveError?: string;
}

const Toolbar = ({
  name,
  onChangeName,
  zoom,
  onChangeZoom,
  width,
  height,
  onChangeSize,
  background,
  onChangeBackground,
  onUploadBackgroundImage,
  onSaveDraft,
  saving,
  onPublish,
  publishing,
  isPublished,
  hasChanges,
  saveError,
}: ToolbarProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  // Detected from the actual size by default; "কাস্টম" is a user override so
  // picking it stays selected even when the current mm exactly matches a
  // preset (detectPageSize would otherwise snap it straight back to A4/A5).
  const [forceCustom, setForceCustom] = useState(false);
  const detected = detectPageSize(width, height);
  const pageSizeId: PageSizeId = forceCustom ? "CUSTOM" : detected.id;
  const orientation = detected.orientation;

  const handlePresetChange = (id: PageSizeId) => {
    if (id === "CUSTOM") {
      setForceCustom(true);
      return;
    }
    setForceCustom(false);
    const size = pageSizePx(id, orientation);
    onChangeSize(size.width, size.height);
  };

  const toggleOrientation = () => onChangeSize(height, width);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <input
        value={name}
        onChange={(e) => onChangeName(e.target.value)}
        placeholder="টেমপ্লেটের নাম"
        className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700">
        <button
          type="button"
          onClick={() => onChangeZoom(Math.max(0.25, Number((zoom - 0.1).toFixed(2))))}
          className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ZoomOut size={16} />
        </button>
        <span className="w-10 text-center text-xs text-slate-600 dark:text-slate-400">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => onChangeZoom(Math.min(2, Number((zoom + 0.1).toFixed(2))))}
          className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ZoomIn size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700">
        <select
          value={pageSizeId}
          onChange={(e) => handlePresetChange(e.target.value as PageSizeId)}
          className="rounded-md border-none bg-transparent py-1 text-xs font-medium text-slate-700 outline-none dark:text-slate-300"
          title="পেজ সাইজ"
        >
          {(Object.keys(PAGE_SIZE_LABELS_BN) as PageSizeId[]).map((id) => (
            <option key={id} value={id}>
              {PAGE_SIZE_LABELS_BN[id]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggleOrientation}
          title={orientation === "portrait" ? "উলম্ব (Portrait)" : "অনুভূমিক (Landscape)"}
          className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {orientation === "portrait" ? <RectangleVertical size={16} /> : <RectangleHorizontal size={16} />}
        </button>
        {pageSizeId === "CUSTOM" && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="number"
              min={1}
              value={pxToMm(width)}
              onChange={(e) => {
                const mm = Number(e.target.value);
                if (Number.isFinite(mm) && mm > 0) onChangeSize(mmToPx(mm), height);
              }}
              className="w-14 rounded-md border border-slate-200 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              title="প্রস্থ (mm)"
            />
            <span>×</span>
            <input
              type="number"
              min={1}
              value={pxToMm(height)}
              onChange={(e) => {
                const mm = Number(e.target.value);
                if (Number.isFinite(mm) && mm > 0) onChangeSize(width, mmToPx(mm));
              }}
              className="w-14 rounded-md border border-slate-200 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              title="উচ্চতা (mm)"
            />
            <span>mm</span>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setUploadingBg(true);
          try {
            const url = await onUploadBackgroundImage(file);
            onChangeBackground({ ...background, image: url, fit: background?.fit || "cover" });
          } catch {
            useToastStore.getState().show("ব্যাকগ্রাউন্ড ছবি আপলোড করা যায়নি, আবার চেষ্টা করুন", "error");
          } finally {
            setUploadingBg(false);
          }
        }}
      />
      <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploadingBg}>
        {uploadingBg ? (
          <>
            <Loader2 size={15} className="mr-1.5 animate-spin" /> আপলোড হচ্ছে...
          </>
        ) : (
          <>
            <ImageIcon size={15} className="mr-1.5" /> ব্যাকগ্রাউন্ড আপলোড
          </>
        )}
      </Button>
      {background?.image && (
        <button
          type="button"
          title="ব্যাকগ্রাউন্ড সরান"
          onClick={() => onChangeBackground({ ...background, image: undefined })}
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X size={15} />
        </button>
      )}
      <input
        type="color"
        title="ব্যাকগ্রাউন্ড রং"
        value={background?.color || "#ffffff"}
        onChange={(e) => onChangeBackground({ ...background, color: e.target.value })}
        className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700"
      />

      <div className="ml-auto flex items-center gap-2">
        {saveError && <span className="text-xs text-rose-600 dark:text-rose-400">{saveError}</span>}
        <Button type="button" variant="secondary" onClick={onSaveDraft} disabled={saving}>
          {saving ? "সেভ হচ্ছে..." : "খসড়া সেভ করুন"}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onPublish}
          disabled={publishing || (isPublished && !hasChanges)}
        >
          {publishing
            ? "প্রকাশ হচ্ছে..."
            : isPublished && !hasChanges
            ? "প্রকাশিত"
            : isPublished
            ? "পুনঃপ্রকাশ করুন"
            : "প্রকাশ করুন"}
        </Button>
      </div>
    </div>
  );
};

export default Toolbar;
