import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import api from "../../services/api";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { toBanglaDigits } from "@madrasha/shared-ui/src/utils/reportUtils";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import RecalculateResultsModal from "./RecalculateResultsModal";
import { RESULT_PERMISSIONS } from "./resultStatus";

type Pending = { sessions: number; students: number; published: number };

/** "🔄 ফলাফল পুনঃগণনা" prompt that is only ACTIVE while something actually needs
 * recalculating. It quietly dry-runs the recalculation (nothing is written):
 * amber banner + enabled button when results would change, otherwise the same
 * banner in a neutral state with the button disabled. Bump `refreshKey` after a
 * setting changes to re-check. Renders nothing for a user who couldn't
 * recalculate. */
export default function PendingRecalculationBanner({ refreshKey }: { refreshKey?: unknown }) {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const allowed =
    hasPermission(user, permissions, RESULT_PERMISSIONS.resultProcess) ||
    hasPermission(user, permissions, RESULT_PERMISSIONS.legacyFallback);

  const [pending, setPending] = useState<Pending | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  const check = useCallback(async () => {
    const current = ++requestId.current;
    setChecking(true);
    setCheckFailed(false);
    try {
      const res = await api.post("/results/recalculate", { include_published: true, dry_run: true });
      if (current !== requestId.current) return; // a newer check superseded this one
      const rows: { outcome: string; is_published: boolean; changed_students: number }[] = Array.isArray(
        res.data?.results,
      )
        ? res.data.results
        : [];
      const affected = rows.filter((r) => r.outcome === "WOULD_UPDATE");
      setPending(
        affected.length
          ? {
              sessions: affected.length,
              students: affected.reduce((sum, r) => sum + Number(r.changed_students || 0), 0),
              published: affected.filter((r) => r.is_published).length,
            }
          : null,
      );
    } catch (err) {
      // Don't claim "all up to date" when we couldn't tell: say so, and leave the
      // button usable (the dialog runs its own review).
      logger.error("Pending recalculation check error:", err);
      if (current === requestId.current) {
        setPending(null);
        setCheckFailed(true);
      }
    } finally {
      if (current === requestId.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    // Debounced so a burst of edits (chained band updates) triggers one check.
    const timer = window.setTimeout(check, 400);
    return () => window.clearTimeout(timer);
  }, [allowed, check, refreshKey]);

  if (!allowed) return null;

  const active = pending !== null;
  const enabled = active || checkFailed;

  return (
    <>
      <div
        role="status"
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors ${
          active
            ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
        }`}
      >
        <p className="min-w-0 flex-1">
          {active ? (
            <>
              <span className="font-semibold">ফলাফল হালনাগাদ করা দরকার:</span> বর্তমান ফেল মার্ক ও গ্রেড সেটিং অনুযায়ী{" "}
              {toBanglaDigits(pending.sessions)}টি ফলাফলে {toBanglaDigits(pending.students)} জন শিক্ষার্থীর ফলাফল বদলাবে
              {pending.published > 0 ? ` (${toBanglaDigits(pending.published)}টি প্রকাশিত)` : ""}। কী বদলাবে আগেই দেখাবে, আপনি
              নিশ্চিত করলে তবেই প্রয়োগ হবে।
            </>
          ) : checking ? (
            "ফলাফল যাচাই করা হচ্ছে..."
          ) : checkFailed ? (
            "ফলাফল হালনাগাদ আছে কি না যাচাই করা যায়নি। চাইলে পুনঃগণনা খুলে নিজে দেখে নিতে পারেন।"
          ) : (
            <>
              <span className="font-semibold">সব ফলাফল হালনাগাদ আছে।</span> গ্রেড সীমা বা ফেল মার্ক বদলালে এবং কোনো ফলাফলে
              পরিবর্তন প্রয়োজন হলে এখানে পুনঃগণনার বাটন চালু হবে।
            </>
          )}
        </p>
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          disabled={!enabled}
          className="shrink-0"
          title={enabled ? undefined : "এখন কোনো ফলাফল পুনঃগণনার প্রয়োজন নেই"}
        >
          <RefreshCw size={15} className={`mr-1.5 ${checking ? "animate-spin" : ""}`} /> ফলাফল পুনঃগণনা
        </Button>
      </div>
      <RecalculateResultsModal open={open} onClose={() => setOpen(false)} onApplied={check} />
    </>
  );
}
