import type { CSSProperties } from "react";
import type { DocumentLayer } from "../types";
import type { FieldBinding } from "../fieldBindings";
import { useText } from "../../../i18n";
import { designerText } from "../designer.text";

export interface PropertyInspectorProps {
  layer: DocumentLayer | null;
  fieldBindings: FieldBinding[];
  onChange: (patch: Partial<DocumentLayer>) => void;
}

const NumberField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
    <input
      type="number"
      value={Number.isFinite(value) ? Math.round(value) : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
  </label>
);

const style = (layer: DocumentLayer): CSSProperties => (layer.style as CSSProperties) || {};

/** Fonts already loaded app-wide (see index.html's Google Fonts link + the
 * self-hosted "Kalpurush" @font-face in index.css) - no extra network/asset
 * loading needed to offer these here. Generic web-safe fonts are included
 * too for documents that mix in English/Latin text. */
const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: '"Kalpurush", "Hind Siliguri", sans-serif', label: "Kalpurush" },
  { value: '"Hind Siliguri", sans-serif', label: "Hind Siliguri" },
  { value: '"Noto Sans Bengali", sans-serif', label: "Noto Sans Bengali" },
  { value: '"Noto Serif Bengali", serif', label: "Noto Serif Bengali" },
  { value: '"Manrope", sans-serif', label: "Manrope" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier New" },
];

/**
 * The end-hand designer panel: geometry (x/y/w/h/rotation) always shown,
 * plus a per-LayerType content editor (text/template with a field-binding
 * picker; image-like layers get a static-src field or a field binding;
 * qrcode gets a field binding; shape gets fill/stroke).
 */
const PropertyInspector = ({ layer, fieldBindings, onChange }: PropertyInspectorProps) => {
  const t = useText(designerText);
  // Localized display names for the two Bangla fonts; others show as-is.
  const fontLabel = (f: { value: string; label: string }) =>
    f.label === "Kalpurush" ? t.fontKalpurush : f.label === "Hind Siliguri" ? t.fontHind : f.label;
  if (!layer) {
    return (
      <div className="w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
        {t.noSelection}
      </div>
    );
  }

  const content = (layer.content as Record<string, any>) || {};
  const updateContent = (patch: Record<string, any>) => onChange({ content: { ...content, ...patch } });
  const updateStyle = (patch: CSSProperties) => onChange({ style: { ...style(layer), ...patch } });

  const isImageLike = layer.type === "image" || layer.type === "photo" || layer.type === "logo" || layer.type === "signature";
  const imageBindings = fieldBindings.filter((f) => f.isImage);
  const textBindings = fieldBindings.filter((f) => !f.isImage);

  return (
    <div className="w-72 shrink-0 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{t.positionSize}</p>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={layer.x} onChange={(v) => onChange({ x: v })} />
          <NumberField label="Y" value={layer.y} onChange={(v) => onChange({ y: v })} />
          <NumberField label={t.width} value={layer.width} onChange={(v) => onChange({ width: v })} />
          <NumberField label={t.height} value={layer.height} onChange={(v) => onChange({ height: v })} />
          <NumberField label={t.rotation} value={layer.rotation} onChange={(v) => onChange({ rotation: v })} />
        </div>
      </div>

      {layer.type === "text" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.text}</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.bindField}</span>
            <select
              value={"__custom__"}
              onChange={(e) => {
                if (e.target.value === "__custom__") return;
                updateContent({ template: `{{${e.target.value}}}`, text: undefined });
              }}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="__custom__">{t.selectOption}</option>
              {textBindings.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.textContent}
            </span>
            <textarea
              value={content.template ?? content.text ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                if (value.includes("{{")) updateContent({ template: value, text: undefined });
                else updateContent({ text: value, template: undefined });
              }}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.font}</span>
            <select
              value={String(style(layer).fontFamily || FONT_OPTIONS[0].value)}
              onChange={(e) => updateStyle({ fontFamily: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {style(layer).fontFamily && !FONT_OPTIONS.some((f) => f.value === style(layer).fontFamily) && (
                <option value={String(style(layer).fontFamily)}>{String(style(layer).fontFamily)}</option>
              )}
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {fontLabel(f)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={t.fontSize}
              value={Number(style(layer).fontSize) || 12}
              onChange={(v) => updateStyle({ fontSize: v })}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.color}</span>
              <input
                type="color"
                value={String(style(layer).color || "#0f172a")}
                onChange={(e) => updateStyle({ color: e.target.value })}
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={style(layer).fontWeight === 700 || style(layer).fontWeight === "700"}
              onChange={(e) => updateStyle({ fontWeight: e.target.checked ? 700 : 400 })}
            />
            {t.bold}
          </label>
        </div>
      )}

      {isImageLike && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.image}</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.bindField}</span>
            <select
              value={content.field || ""}
              onChange={(e) => updateContent({ field: e.target.value || undefined })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t.staticImage}</option>
              {imageBindings.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {!content.field && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.uploadImage}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = () => updateContent({ src: reader.result as string });
                  reader.readAsDataURL(file);
                }}
                className="w-full text-xs"
              />
            </label>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={Boolean(content.lockAspectRatio)}
              onChange={(e) => {
                if (e.target.checked) {
                  // A circle only reads as a true circle at a 1:1 ratio, so
                  // locking also squares the layer to its smaller side right
                  // away instead of leaving it to look like a clipped oval
                  // until the next manual resize.
                  const size = Math.min(layer.width, layer.height);
                  onChange({
                    width: size,
                    height: size,
                    content: { ...content, lockAspectRatio: true },
                    style: { ...style(layer), borderRadius: "50%" },
                  });
                } else {
                  const { borderRadius: _drop, ...restStyle } = style(layer);
                  onChange({ content: { ...content, lockAspectRatio: undefined }, style: restStyle });
                }
              }}
            />
            {t.lockAspect}
          </label>

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{t.border}</p>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label={t.widthPx}
                value={Number(style(layer).borderWidth) || 0}
                onChange={(v) => {
                  const width = Math.max(0, v);
                  if (width === 0) {
                    updateStyle({ borderWidth: undefined, borderStyle: undefined, borderColor: undefined });
                  } else {
                    updateStyle({
                      borderWidth: width,
                      borderStyle: "solid",
                      borderColor: String(style(layer).borderColor || "#0f172a"),
                    });
                  }
                }}
              />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.color}</span>
                <input
                  type="color"
                  value={String(style(layer).borderColor || "#0f172a")}
                  onChange={(e) => updateStyle({ borderColor: e.target.value, borderStyle: "solid" })}
                  disabled={!style(layer).borderWidth}
                  className="h-9 w-full rounded-lg border border-slate-200 disabled:opacity-50 dark:border-slate-700"
                />
              </label>
            </div>
            {Boolean(style(layer).borderWidth) && (
              <button
                type="button"
                onClick={() => updateStyle({ borderWidth: undefined, borderStyle: undefined, borderColor: undefined })}
                className="mt-1.5 text-[11px] font-medium text-rose-600 underline dark:text-rose-400"
              >
                {t.removeBorder}
              </button>
            )}
          </div>
        </div>
      )}

      {(layer.type === "qrcode" || layer.type === "barcode") && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {layer.type === "qrcode" ? t.layerTypes.qrcode : t.layerTypes.barcode}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.encodeField}</span>
            <select
              value={content.field || ""}
              onChange={(e) => updateContent({ field: e.target.value || undefined })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{t.selectOption}</option>
              {textBindings.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {layer.type === "shape" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.shape}</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.shapeType}</span>
            <select
              value={content.shape || "rectangle"}
              onChange={(e) => updateContent({ shape: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="rectangle">{t.rectangle}</option>
              <option value="circle">{t.circle}</option>
              <option value="line">{t.line}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t.fillColor}</span>
            <input
              type="color"
              value={content.fill || "#e2e8f0"}
              onChange={(e) => updateContent({ fill: e.target.value })}
              className="h-9 w-full rounded-lg border border-slate-200"
            />
          </label>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          checked={layer.visible !== false}
          onChange={(e) => onChange({ visible: e.target.checked })}
        />
        {t.visible}
      </label>
    </div>
  );
};

export default PropertyInspector;
