import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eraser, Pencil, X } from "lucide-react";
import api from "../../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import SectionCard from "../../../components/settings/SectionCard";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
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
  const [editingClassIds, setEditingClassIds] = useState<Set<number>>(new Set());
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
      setEditingClassIds((prev) => {
        const next = new Set(prev);
        next.delete(c.class_id);
        return next;
      });
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

      {loading && (
        <div role="status" aria-label={t.loadingList} className="space-y-5">
          {[0, 1].map((section) => (
            <div key={section} aria-hidden="true" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-3">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex flex-col gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-7 w-7 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && divisions.every((d) => d.classes.length === 0) && (
        <EmptyState title={t.noClasses} />
      )}

      {!loading && divisions
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
                const editing = editingClassIds.has(c.class_id);

                return (
                  <div
                    key={c.class_id}
                    className={`group flex flex-col gap-2 rounded-xl border px-4 py-3 transition sm:flex-row sm:items-center ${editing ? "border-blue-200 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"}`}
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
                      {editing ? (
                        <>
                          <Input
                            autoFocus
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={draft.start}
                            readOnly={!editing}
                            disabled={saving}
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
                            readOnly={!editing}
                            disabled={saving}
                            onChange={(e) => setDraft(c.class_id, { end: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editing && dirty && !saving) save(c, draft);
                            }}
                            placeholder={t.end}
                            aria-label={t.endNoOf(c.class_name_bn)}
                            className="h-9 w-24 min-w-0"
                          />
                        </>
                      ) : (
                        <div className="flex items-center gap-3 text-sm text-gray-900 dark:text-slate-100">
                          <span aria-label={t.startNoOf(c.class_name_bn)}>
                            <span className="mr-1 text-xs text-gray-500 dark:text-slate-400">{t.start}</span>
                            {c.reg_no_start != null ? bn(c.reg_no_start) : "—"}
                          </span>
                          <span className="text-gray-400">–</span>
                          <span aria-label={t.endNoOf(c.class_name_bn)}>
                            <span className="mr-1 text-xs text-gray-500 dark:text-slate-400">{t.end}</span>
                            {c.reg_no_end != null ? bn(c.reg_no_end) : "—"}
                          </span>
                        </div>
                      )}
                      {!editing ? (
                        <button
                          type="button"
                          onClick={() => setEditingClassIds((prev) => new Set(prev).add(c.class_id))}
                          aria-label={cm.edit}
                          title={cm.edit}
                          className="shrink-0 touch-manipulation rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:opacity-100 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Pencil size={14} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => save(c, draft)}
                            disabled={!dirty || saving}
                            aria-label={cm.save}
                            className="shrink-0 touch-manipulation rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDrafts((prev) => ({ ...prev, [c.class_id]: toDraft(c) }));
                              setEditingClassIds((prev) => {
                                const next = new Set(prev);
                                next.delete(c.class_id);
                                return next;
                              });
                            }}
                            disabled={saving}
                            aria-label={cm.cancel}
                            title={cm.cancel}
                            className="shrink-0 touch-manipulation rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <X size={15} />
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
                        </>
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
