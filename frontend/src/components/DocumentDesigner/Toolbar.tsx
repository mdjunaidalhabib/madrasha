import { useRef } from "react";
import { ZoomIn, ZoomOut, Image as ImageIcon, X } from "lucide-react";
import Button from "../ui/Button";
import type { CanvasBackground } from "./types";

export interface ToolbarProps {
  name: string;
  onChangeName: (name: string) => void;
  zoom: number;
  onChangeZoom: (zoom: number) => void;
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
  saveError?: string;
}

const Toolbar = ({
  name,
  onChangeName,
  zoom,
  onChangeZoom,
  background,
  onChangeBackground,
  onUploadBackgroundImage,
  onSaveDraft,
  saving,
  onPublish,
  publishing,
  isPublished,
  saveError,
}: ToolbarProps) => {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <input
        value={name}
        onChange={(e) => onChangeName(e.target.value)}
        placeholder="টেমপ্লেটের নাম"
        className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
      />

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1">
        <button
          type="button"
          onClick={() => onChangeZoom(Math.max(0.25, Number((zoom - 0.1).toFixed(2))))}
          className="rounded p-1 hover:bg-slate-100"
        >
          <ZoomOut size={16} />
        </button>
        <span className="w-10 text-center text-xs text-slate-600">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => onChangeZoom(Math.min(2, Number((zoom + 0.1).toFixed(2))))}
          className="rounded p-1 hover:bg-slate-100"
        >
          <ZoomIn size={16} />
        </button>
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
          const url = await onUploadBackgroundImage(file);
          onChangeBackground({ ...background, image: url, fit: background?.fit || "cover" });
        }}
      />
      <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
        <ImageIcon size={15} className="mr-1.5" /> ব্যাকগ্রাউন্ড আপলোড
      </Button>
      {background?.image && (
        <button
          type="button"
          title="ব্যাকগ্রাউন্ড সরান"
          onClick={() => onChangeBackground({ ...background, image: undefined })}
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <X size={15} />
        </button>
      )}
      <input
        type="color"
        title="ব্যাকগ্রাউন্ড রং"
        value={background?.color || "#ffffff"}
        onChange={(e) => onChangeBackground({ ...background, color: e.target.value })}
        className="h-9 w-9 rounded-lg border border-slate-200"
      />

      <div className="ml-auto flex items-center gap-2">
        {saveError && <span className="text-xs text-rose-600">{saveError}</span>}
        <Button type="button" variant="secondary" onClick={onSaveDraft} disabled={saving}>
          {saving ? "সেভ হচ্ছে..." : "খসড়া সেভ করুন"}
        </Button>
        <Button type="button" variant="primary" onClick={onPublish} disabled={publishing}>
          {publishing ? "প্রকাশ হচ্ছে..." : isPublished ? "পুনঃপ্রকাশ করুন" : "প্রকাশ করুন"}
        </Button>
      </div>
    </div>
  );
};

export default Toolbar;
