import { useEffect, useMemo, useState } from "react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import DocumentPreview from "@madrasha/shared-ui/src/components/DocumentDesigner/DocumentPreview";
import {
  DEFAULT_ID_CARD_BACK_ID,
  getDefaultBuiltinBackDesign,
  listBuiltinBackDesigns,
} from "@madrasha/shared-ui/src/components/DocumentDesigner/builtin/registry";
import BrandImageBox from "../../components/settings/BrandImageBox";
import { useBrandingStore } from "../../store/brandingStore";
import { useIdCardBackStore } from "../../store/idCardBackStore";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import { EMPTY_ID_CARD_BACK, saveIdCardBack, type IdCardBackSettings } from "../../services/idCardBackApi";
import { useBackLayout } from "../../components/Report/documents/engine/useDocumentLayout";
import { formatCardDate } from "../../components/Report/documents/engine/useIdCardBackRows";

// শুধু প্রিভিউর নমুনা - কোনো প্রকৃত শিক্ষার্থীর তথ্য নয়, কোথাও সেভ হয় না।
const SAMPLE_STUDENT = {
  student_name: "মোহাম্মদ ইয়াসিন",
  registration_no: "৪৫৬৭৮৯",
  guardian_phone: "০১৭xxxxxxxx",
  academic_year: "১৪৪৬-১৪৪৭",
};

const inputClass =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900/40";

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">{label}</span>
    {hint && <span className="mt-0.5 block text-xs text-gray-500 dark:text-slate-400">{hint}</span>}
    <div className="mt-1.5">{children}</div>
  </label>
);

/**
 * Talimat → সেটিং → ডকুমেন্টস টেমপ্লেট → "আইডি কার্ড ব্যাক" ট্যাব: আইডি কার্ডের পিছনের পাতায় ছাপা হয়
 * এমন তথ্য - কার্ড ইস্যুর তারিখ, মেয়াদ, অধ্যক্ষের পদবি ও স্বাক্ষর, হারিয়ে গেলে কাকে ফেরত দিতে
 * হবে - আর কোন ডিজাইনটি ডিফল্ট হবে। মাদরাসার নাম/লোগো ব্র্যান্ডিং সেটিং থেকে আসে। রিপোর্টের
 * "পিছনের পাতা" ড্রপডাউন এই ডিফল্ট দিয়ে শুরু হয়, সেখান থেকে অন্য ডিজাইনও বাছা যায়।
 */
export default function IdCardBackSettingsForm() {
  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);
  const settings = useIdCardBackStore((s) => s.settings);
  const loaded = useIdCardBackStore((s) => s.loaded);
  const fetchSettings = useIdCardBackStore((s) => s.fetchSettings);
  const setSettings = useIdCardBackStore((s) => s.setSettings);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const canEdit = hasPermission(user, permissions, "settings.manage");

  const [draft, setDraft] = useState<IdCardBackSettings>(EMPTY_ID_CARD_BACK);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBranding();
    fetchSettings(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const patch = (next: Partial<IdCardBackSettings>) => setDraft((prev) => ({ ...prev, ...next }));

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings ?? EMPTY_ID_CARD_BACK),
    [draft, settings],
  );

  const defaultDesignId = draft.default_design_id ?? DEFAULT_ID_CARD_BACK_ID;
  const backLayout = useBackLayout(defaultDesignId);
  const previewRow = useMemo(() => {
    const phone = branding?.phones?.filter(Boolean).join(", ");
    const defaultReturn = [branding?.address, phone ? `ফোন: ${phone}` : ""].filter(Boolean).join("\n");
    return {
      ...SAMPLE_STUDENT,
      madrasa_name: branding?.name || " ",
      madrasa_logo: branding?.report_logo || "",
      id_issue_date: formatCardDate(draft.issue_date),
      id_expiry_date: formatCardDate(draft.expiry_date),
      principal_title: draft.principal_title?.trim() || "অধ্যক্ষ",
      principal_signature: draft.principal_signature || "",
      id_lost_return: draft.lost_return_text?.trim() || defaultReturn || " ",
    };
  }, [draft, branding]);

  const handleSave = async () => {
    if (draft.issue_date && draft.expiry_date && draft.expiry_date < draft.issue_date) {
      useToastStore.getState().show("মেয়াদ শেষের তারিখ ইস্যু তারিখের আগে হতে পারে না", "error");
      return;
    }
    setSaving(true);
    try {
      await saveIdCardBack(draft);
      setSettings(draft);
      useToastStore.getState().show("আইডি কার্ডের পিছনের তথ্য সেভ হয়েছে", "success");
    } catch {
      // error toast already shown by the api layer
    } finally {
      setSaving(false);
    }
  };

  if (!loaded && !settings) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="লোড হচ্ছে">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold dark:text-slate-100">আইডি কার্ড ব্যাক</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            আইডি কার্ডের পিছনের পাতায় ছাপা হবে এমন তথ্য - ইস্যু ও মেয়াদের তারিখ, অধ্যক্ষের স্বাক্ষর, হারিয়ে গেলে ফেরতের ঠিকানা
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <Field label="ডিফল্ট পিছনের ডিজাইন" hint="রিপোর্টে আইডি কার্ড খুললে এই ডিজাইন দিয়ে শুরু হয় - সেখান থেকে চাইলে অন্য ডিজাইনও বাছা যায়">
            <select
              className={inputClass}
              value={defaultDesignId}
              disabled={!canEdit}
              onChange={(e) => {
                const id = Number(e.target.value);
                patch({ default_design_id: id === DEFAULT_ID_CARD_BACK_ID ? null : id });
              }}
            >
              <option value={DEFAULT_ID_CARD_BACK_ID}>{getDefaultBuiltinBackDesign().name}</option>
              <optgroup label="রেডিমেড ডিজাইন">
                {listBuiltinBackDesigns().map((design) => (
                  <option key={design.id} value={design.id}>
                    {design.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>

          <Field label="মাদরাসার নাম" hint="প্রতিষ্ঠান ব্র্যান্ডিং সেটিং থেকে আসে - সেখানেই বদলাতে হবে">
            <input className={inputClass} value={branding?.name || ""} disabled readOnly />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="কার্ড ইস্যুর তারিখ">
              <input
                type="date"
                className={inputClass}
                value={draft.issue_date || ""}
                disabled={!canEdit}
                onChange={(e) => patch({ issue_date: e.target.value || null })}
              />
            </Field>
            <Field label="মেয়াদ শেষের তারিখ">
              <input
                type="date"
                className={inputClass}
                value={draft.expiry_date || ""}
                min={draft.issue_date || undefined}
                disabled={!canEdit}
                onChange={(e) => patch({ expiry_date: e.target.value || null })}
              />
            </Field>
          </div>

          <Field label="অধ্যক্ষের পদবি" hint="স্বাক্ষরের নিচে ছাপা হয় - ফাঁকা রাখলে “অধ্যক্ষ”">
            <input
              className={inputClass}
              value={draft.principal_title || ""}
              maxLength={60}
              placeholder="অধ্যক্ষ"
              disabled={!canEdit}
              onChange={(e) => patch({ principal_title: e.target.value })}
            />
          </Field>

          <div className={canEdit ? "" : "pointer-events-none opacity-60"}>
            <BrandImageBox
              label="অধ্যক্ষের স্বাক্ষর"
              hint="সাদা বা স্বচ্ছ জমিনে স্বাক্ষরের স্পষ্ট ছবি (PNG/JPG, সর্বোচ্চ ২MB)"
              shape="wide"
              ratioLabel="অনুপাত ২:১"
              value={draft.principal_signature}
              onChange={(value) => patch({ principal_signature: value })}
              onRemove={() => patch({ principal_signature: null })}
            />
          </div>

          <Field
            label="কার্ড হারিয়ে গেলে ফেরত দেওয়ার ঠিকানা"
            hint="ফাঁকা রাখলে মাদরাসার ঠিকানা ও ফোন নম্বর ছাপা হবে"
          >
            <textarea
              className={`${inputClass} h-28 resize-none py-2 leading-relaxed`}
              value={draft.lost_return_text || ""}
              maxLength={400}
              placeholder={[branding?.address, branding?.phones?.filter(Boolean).join(", ")].filter(Boolean).join("\n")}
              disabled={!canEdit}
              onChange={(e) => patch({ lost_return_text: e.target.value })}
            />
          </Field>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">প্রিভিউ (নমুনা)</p>
            <div className="mt-3 flex justify-center overflow-hidden rounded-lg bg-gray-100 p-3 dark:bg-slate-800">
              {backLayout && (
                <div style={{ width: backLayout.width, height: backLayout.height }} className="shadow-md">
                  <DocumentPreview layout={backLayout} row={previewRow} />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              ছাপতে রিপোর্ট → ডকুমেন্ট → আইডি কার্ড (সামনে-পিছনে) বা আইডি কার্ড ব্যাক (শুধু পিছন)।
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
