import type { CSSProperties } from "react";
import type { DocumentLayer } from "../types";
import type { FieldBinding } from "../fieldBindings";

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

/**
 * The right-hand designer panel: geometry (x/y/w/h/rotation) always shown,
 * plus a per-LayerType content editor (text/template with a field-binding
 * picker; image-like layers get a static-src field or a field binding;
 * qrcode gets a field binding; shape gets fill/stroke).
 */
const PropertyInspector = ({ layer, fieldBindings, onChange }: PropertyInspectorProps) => {
  if (!layer) {
    return (
      <div className="w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
        কোনো এলিমেন্ট নির্বাচিত নেই — ক্যানভাসে কোনো এলিমেন্টে ক্লিক করুন
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
        <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">অবস্থান ও আকার</p>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={layer.x} onChange={(v) => onChange({ x: v })} />
          <NumberField label="Y" value={layer.y} onChange={(v) => onChange({ y: v })} />
          <NumberField label="প্রস্থ" value={layer.width} onChange={(v) => onChange({ width: v })} />
          <NumberField label="উচ্চতা" value={layer.height} onChange={(v) => onChange({ height: v })} />
          <NumberField label="ঘূর্ণন (°)" value={layer.rotation} onChange={(v) => onChange({ rotation: v })} />
        </div>
      </div>

      {layer.type === "text" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">টেক্সট</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">ফিল্ড বাইন্ড করুন</span>
            <select
              value={"__custom__"}
              onChange={(e) => {
                if (e.target.value === "__custom__") return;
                updateContent({ template: `{{${e.target.value}}}`, text: undefined });
              }}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="__custom__">— নির্বাচন করুন —</option>
              {textBindings.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              লেখা (স্ট্যাটিক অথবা {"{{ফিল্ড}}"} সহ)
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
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="ফন্ট সাইজ"
              value={Number(style(layer).fontSize) || 12}
              onChange={(v) => updateStyle({ fontSize: v })}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">রং</span>
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
            বোল্ড
          </label>
        </div>
      )}

      {isImageLike && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">ছবি</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">ফিল্ড বাইন্ড করুন</span>
            <select
              value={content.field || ""}
              onChange={(e) => updateContent({ field: e.target.value || undefined })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">— স্ট্যাটিক ছবি —</option>
              {imageBindings.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {!content.field && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">ছবি আপলোড করুন</span>
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
        </div>
      )}

      {(layer.type === "qrcode" || layer.type === "barcode") && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {layer.type === "qrcode" ? "কিউআর কোড" : "বারকোড"}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">কোন ফিল্ডের মান এনকোড হবে</span>
            <select
              value={content.field || ""}
              onChange={(e) => updateContent({ field: e.target.value || undefined })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">— নির্বাচন করুন —</option>
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
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">শেপ</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">ধরন</span>
            <select
              value={content.shape || "rectangle"}
              onChange={(e) => updateContent({ shape: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="rectangle">আয়তক্ষেত্র</option>
              <option value="circle">বৃত্ত</option>
              <option value="line">রেখা</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">ফিল রং</span>
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
        দৃশ্যমান
      </label>
    </div>
  );
};

export default PropertyInspector;
