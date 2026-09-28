import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { commonText, getText, localizeDigits, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import { resultPanelText } from "./resultPanel.text";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { resultStatusBadge } from "./resultStatus";

type Outcome = "UPDATED" | "WOULD_UPDATE" | "UNCHANGED" | "SKIPPED" | "FAILED";

interface RecalcRow {
  result_master_id: number;
  exam_name: string;
  class_name: string;
  status: string;
  is_published: boolean;
  outcome: Outcome;
  skip_reason?: "NOT_PROCESSED" | "INCOMPLETE_MARKS";
  changed_students: number;
  total_students: number;
}

interface RecalcTotals {
  updated: number;
  failed: number;
  pending_unpublished: number;
  pending_published: number;
  changed_students: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Recalculate just this session. Omit to review every processed session. */
  resultMasterId?: number | null;
  /** Called after changes were actually applied, so the caller can reload. */
  onApplied?: () => void;
}

/** The পুনঃগণনা review-then-apply dialog. It always starts with a dry run so
 * তালিমাত sees exactly which sessions and how many students would change
 * before anything is written - fail mark is one global setting, so applying
 * a new value is never a blind operation. Unpublished sessions are safe to
 * refresh; PUBLISHED/LOCKED ones need the explicit checkbox (guardians may
 * already have seen them). A single-session dialog skips that checkbox: the
 * user picked that session on purpose. */
export default function RecalculateResultsModal({ open, onClose, resultMasterId, onApplied }: Props) {
  const push = useToastStore((state) => state.push);
  const lang = useLang();
  const t = useText(resultPanelText).recalc;
  const c = useText(commonText);
  const num = (value: number | string) => localizeDigits(value, lang);
  const single = Boolean(resultMasterId);

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<RecalcRow[]>([]);
  const [totals, setTotals] = useState<RecalcTotals | null>(null);
  const [includePublished, setIncludePublished] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const review = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await api.post("/results/recalculate", {
        ...(resultMasterId ? { result_master_id: resultMasterId } : {}),
        include_published: true,
        dry_run: true,
      });
      setRows(Array.isArray(res.data?.results) ? res.data.results : []);
      setTotals(res.data?.totals ?? null);
    } catch (err: any) {
      logger.error("Recalculate review error:", err);
      setLoadError(true);
      push("error", err?.response?.data?.message || getText(resultPanelText).recalc.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [resultMasterId, push]);

  useEffect(() => {
    if (!open) return;
    setIncludePublished(false);
    setRows([]);
    setTotals(null);
    review();
  }, [open, review]);

  const affected = rows.filter((r) => r.outcome === "WOULD_UPDATE");
  const affectedUnpublished = affected.filter((r) => !r.is_published);
  const affectedPublished = affected.filter((r) => r.is_published);
  const skippedIncomplete = rows.filter((r) => r.skip_reason === "INCOMPLETE_MARKS");

  const willApply = single || includePublished ? affected : affectedUnpublished;
  const studentsToChange = willApply.reduce((sum, r) => sum + r.changed_students, 0);

  const handleApply = async () => {
    try {
      setApplying(true);
      const res = await api.post("/results/recalculate", {
        ...(resultMasterId ? { result_master_id: resultMasterId } : {}),
        include_published: single || includePublished,
      });
      const applied: RecalcTotals | undefined = res.data?.totals;
      const failed = applied?.failed ?? 0;

      push(
        failed > 0 ? "error" : "success",
        failed > 0
          ? t.partialFail(num(applied?.updated ?? 0), num(failed))
          : t.done(num(applied?.updated ?? 0), num(applied?.changed_students ?? 0)),
      );
      onApplied?.();
      onClose();
    } catch (err: any) {
      logger.error("Recalculate apply error:", err);
      push("error", err?.response?.data?.message || t.failed);
    } finally {
      setApplying(false);
    }
  };

  const nothingToDo = !loading && !loadError && affected.length === 0;

  return (
    <Modal
      open={open}
      title={single ? t.titleOne : t.titleAll}
      onClose={applying ? () => undefined : onClose}
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-4 text-sm text-gray-700 dark:text-slate-300">
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {t.intro}
        </p>

        {loading && <p className="py-6 text-center text-gray-400 dark:text-slate-500">{t.checking}</p>}

        {loadError && !loading && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-400">
            <span>{t.fetchFailed}</span>
            <Button variant="secondary" onClick={review}>
              {t.retry}
            </Button>
          </div>
        )}

        {nothingToDo && (
          <div className="rounded-lg bg-emerald-50 p-4 text-center text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            {single ? t.nothingOne : t.nothingAll}
          </div>
        )}

        {affected.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border dark:border-slate-700">
              <table className="w-full min-w-[420px] text-xs sm:text-sm">
                <thead className="bg-gray-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-start">{t.examClass}</th>
                    <th className="px-3 py-2 text-center">{t.state}</th>
                    <th className="px-3 py-2 text-center">{t.willChange}</th>
                  </tr>
                </thead>
                <tbody>
                  {affected.map((r) => {
                    const badge = resultStatusBadge(r.status);
                    return (
                      <tr key={r.result_master_id} className="border-t dark:border-slate-700">
                        <td className="px-3 py-2">
                          {r.exam_name} — {r.class_name}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {t.people(num(r.changed_students), num(r.total_students))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {affectedPublished.length > 0 && !single && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={includePublished}
                  onChange={(e) => setIncludePublished(e.target.checked)}
                />
                <span>
                  <b>{t.includePublished}</b>
                  {t.includePublishedHint(num(affectedPublished.length))}
                </span>
              </label>
            )}

            <ul className="list-disc space-y-1 ps-5 text-xs text-gray-500 dark:text-slate-400">
              {affectedUnpublished.length > 0 && (
                <li>
                  {t.unpublishedNote}
                </li>
              )}
              {single && affectedPublished.length > 0 && (
                <li>{t.singlePublishedNote}</li>
              )}
            </ul>
          </>
        )}

        {skippedIncomplete.length > 0 && (
          <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-400">
            {t.skipped(num(skippedIncomplete.length))}
            {skippedIncomplete.map((r) => `${r.exam_name} — ${r.class_name}`).join("; ")}
          </p>
        )}

        {totals && totals.failed > 0 && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {t.totalsFailed(num(totals.failed))}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={applying}>
            {nothingToDo ? c.close : c.cancel}
          </Button>
          {affected.length > 0 && (
            <Button onClick={handleApply} disabled={applying || loading || willApply.length === 0}>
              {applying
                ? t.applying
                : t.apply(num(willApply.length), num(studentsToChange))}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
