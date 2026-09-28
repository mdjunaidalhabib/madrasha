import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eraser } from "lucide-react";
import api from "../../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import SectionCard from "../../../components/settings/SectionCard";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { commonText, getText, LOCALE_MAP, useLang, useText, type Lang } from "@madrasha/shared-ui/src/i18n";
import { talimatSettingsText } from "./talimatSettings.text";

type BlockClass = {
  class_id: number;
  class_name_bn: string;
  reg_no_start: number | null;
  reg_no_end: number | null;
  used_count: number;
  next_reg_no: number | null;
};

type BlockDivision = {
  division_id: number;
  division_name_bn: string;
  classes: BlockClass[];
};

type Draft = { start: string; end: string };

const fmtNo = (n: number, lang: Lang) => n.toLocaleString(LOCALE_MAP[lang], { useGrouping: false });

const toDraft = (c: BlockClass): Draft => ({
  start: c.reg_no_start != null ? String(c.reg_no_start) : "",
  end: c.reg_no_end != null ? String(c.reg_no_end) : "",
});

/** প্রতিটি শ্রেণির জন্য ছাত্রদের রেজিস্ট্রেশন নম্বরের আলাদা ব্লক (যেমন ১-৫০,
 * ৫১-১০০)। নম্বর পুরো মাদ্রাসায় ইউনিক - নতুন ভর্তি/প্রমোশনে ছাত্র তার
 * শ্রেণির ব্লকের পরের ফাঁকা নম্বর পায়। */
export default function RegistrationBlockSettingsPage() {
  const t = useText(talimatSettingsText);
  const cm = useText(commonText);
  const lang = useLang();
  const bn = (n: number) => fmtNo(n, lang);
  const [divisions, setDivisions] = useState<BlockDivision[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [savingClassId, setSavingClassId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/madrasa-classes/registration-blocks");
      const data: BlockDivision[] = res.data || [];
      setDivisions(data);
      const next: Record<number, Draft> = {};
      data.forEach((d) => d.classes.forEach((c) => (next[c.class_id] = toDraft(c))));
      setDrafts(next);
    } catch (err: any) {
      useToastStore.getState().push("error", err?.response?.data?.message || getText(talimatSettingsText).regLoadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** নতুন ব্লকের প্রস্তাবিত শুরু: এখন পর্যন্ত সব ব্লকের সর্বোচ্চ শেষ নম্বরের পরেরটা। */
  const suggestedStart = useMemo(() => {
    let maxEnd = 0;
    divisions.forEach((d) => d.classes.forEach((c) => (maxEnd = Math.max(maxEnd, c.reg_no_end ?? 0))));
    return maxEnd + 1;
  }, [divisions]);

  const save = async (c: BlockClass, draft: Draft) => {
    setSavingClassId(c.class_id);
    try {
      const res = await api.put(`/madrasa-classes/${c.class_id}/registration-block`, {
        reg_no_start: draft.start.trim() || null,
        reg_no_end: draft.end.trim() || null,
      });
      useToastStore.getState().push("success", res.data?.message || getText(commonText).saved);
      await load();
    } catch (err: any) {
      useToastStore.getState().push("error", err?.response?.data?.message || getText(commonText).saveFailed);
    } finally {
      setSavingClassId(null);
    }
  };

  const setDraft = (classId: number, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [classId]: { ...prev[classId], ...patch } }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.regTitle}
        subtitle={t.regSubtitle}
      />

      {!loading && divisions.every((d) => d.classes.length === 0) && (
        <EmptyState title={t.noClasses} />
      )}

      {divisions
        .filter((d) => d.classes.length > 0)
        .map((division) => (
          <SectionCard key={division.division_id} title={division.division_name_bn} badge={t.classCount(bn(division.classes.length))}>
            <div className="flex flex-col gap-2">
              {division.classes.map((c) => {
                const draft = drafts[c.class_id] ?? toDraft(c);
                const original = toDraft(c);
                const dirty = draft.start.trim() !== original.start || draft.end.trim() !== original.end;
                const hasBlock = c.reg_no_start != null && c.reg_no_end != null;
                const saving = savingClassId === c.class_id;

                return (
                  <div
                    key={c.class_id}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-slate-700 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-800 dark:text-slate-200">{c.class_name_bn}</div>
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                        {!hasBlock ? (
                          t.noBlock
                        ) : c.next_reg_no == null ? (
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {t.blockFull(bn(c.used_count))}
                          </span>
                        ) : (
                          <>
                            {t.usedNext(bn(c.used_count))}
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{bn(c.next_reg_no)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={draft.start}
                        onChange={(e) => setDraft(c.class_id, { start: e.target.value })}
                        placeholder={hasBlock ? t.start : String(suggestedStart)}
                        aria-label={t.startNoOf(c.class_name_bn)}
                        className="h-9 w-24 min-w-0"
                      />
                      <span className="text-gray-400">–</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={draft.end}
                        onChange={(e) => setDraft(c.class_id, { end: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && dirty && !saving) save(c, draft);
                        }}
                        placeholder={t.end}
                        aria-label={t.endNoOf(c.class_name_bn)}
                        className="h-9 w-24 min-w-0"
                      />
                      <button
                        onClick={() => save(c, draft)}
                        disabled={!dirty || saving}
                        aria-label={cm.save}
                        className="shrink-0 touch-manipulation rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                      >
                        <Check size={15} />
                      </button>
                      {hasBlock && (
                        <button
                          onClick={() => save(c, { start: "", end: "" })}
                          disabled={saving}
                          aria-label={t.clearBlock}
                          title={t.clearBlock}
                          className="shrink-0 touch-manipulation rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        >
                          <Eraser size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        ))}
    </div>
  );
}
