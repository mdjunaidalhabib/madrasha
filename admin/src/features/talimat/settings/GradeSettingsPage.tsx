import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { cachedGet } from "../../../services/api";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import { Skeleton } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import GeneralGradeList from "../../../components/ExamPanel/GeneralGradeList";
import MadrasaGradeList from "../../../components/ExamPanel/MadrasaGradeList";
import GradeBandPreview from "../../../components/ExamPanel/GradeBandPreview";
import GradeScopePanel, { type GradeScope } from "../../../components/ExamPanel/GradeScopePanel";
import ScopeSummaryCard from "../../../components/ExamPanel/ScopeSummaryCard";
import { hasOwnGrading, parseDivisionList, type DivisionFailMark } from "../../../components/ExamPanel/divisionGrading";
import type { GradeItem } from "../../../components/ExamPanel/GradeList";
import { failGradeName, withoutFailGrades } from "../../../components/ExamPanel/failGrade";
import PendingRecalculationBanner from "../../../components/ResultPanel/PendingRecalculationBanner";

type GradeKind = "madrasa" | "general";

type HubData = {
  /** Scope these rows were fetched for - guards against showing another scope's rows. */
  scope: GradeScope;
  failMark: number;
  divisions: DivisionFailMark[];
  /** Default (madrasa-wide) scales - also what a non-overridden division inherits. */
  defaultGeneral: GradeItem[];
  defaultMadrasa: GradeItem[];
  /** The selected division's own scales (empty unless it has an override). */
  ownGeneral: GradeItem[];
  ownMadrasa: GradeItem[];
};

const KIND_TABS: { key: GradeKind; label: string; icon: string }[] = [
  { key: "madrasa", label: "মাদরাসা গ্রেড", icon: "🕌" },
  { key: "general", label: "সাধারণ গ্রেড", icon: "📊" },
];

const parseScope = (raw: string | null): GradeScope => {
  const id = Number(raw);
  return raw && Number.isInteger(id) && id > 0 ? id : null;
};

function HubSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="লোড হচ্ছে">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-10 w-64 rounded-xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export default function GradeSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = parseScope(searchParams.get("scope"));

  const [data, setData] = useState<HubData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [kind, setKind] = useState<GradeKind>("madrasa");
  const requestId = useRef(0);
  const scopeRef = useRef<GradeScope>(scope);
  scopeRef.current = scope;

  const selectScope = useCallback(
    (next: GradeScope) => {
      setSearchParams(next === null ? {} : { scope: String(next) }, { replace: true });
    },
    [setSearchParams],
  );

  const load = useCallback(
    async (scopeId: GradeScope) => {
      const current = ++requestId.current;
      try {
        const [f, d, g, m] = await Promise.all([
          cachedGet("/fail-mark"),
          // Division overrides are an add-on: the default scale must still load without them.
          cachedGet("/fail-mark/divisions").catch(() => null),
          cachedGet("/general-grades"),
          cachedGet("/madrasa-grades"),
        ]);
        const divisions = parseDivisionList(d?.data);
        const division = scopeId === null ? null : divisions.find((x) => x.division_id === scopeId) ?? null;

        // Unknown / removed division in the URL: fall back to the default scope
        // (the scope change triggers a fresh load).
        if (scopeId !== null && !division) {
          if (current === requestId.current) selectScope(null);
          return;
        }

        let ownGeneral: GradeItem[] = [];
        let ownMadrasa: GradeItem[] = [];
        if (division && hasOwnGrading(division)) {
          const params = { division_id: division.division_id };
          const [og, om] = await Promise.all([
            cachedGet("/general-grades", { params }),
            cachedGet("/madrasa-grades", { params }),
          ]);
          ownGeneral = og.data;
          ownMadrasa = om.data;
        }
        if (current !== requestId.current) return; // a newer load superseded this one

        setData({
          scope: scopeId,
          failMark: Number(f.data),
          divisions,
          defaultGeneral: g.data,
          defaultMadrasa: m.data,
          ownGeneral,
          ownMadrasa,
        });
        setLoadError(false);
      } catch {
        if (current === requestId.current) setLoadError(true);
      }
    },
    [selectScope],
  );

  useEffect(() => {
    load(scope);
  }, [scope, load]);

  // Bumped after every settings change so the recalculation prompt re-checks.
  const [settingsVersion, setSettingsVersion] = useState(0);
  const reload = useCallback(() => {
    setSettingsVersion((v) => v + 1);
    return load(scopeRef.current);
  }, [load]);

  const activeDivision =
    data && scope !== null ? data.divisions.find((d) => d.division_id === scope) ?? null : null;
  const own = hasOwnGrading(activeDivision);
  const ready = data !== null && data.scope === scope;

  const banner = <PendingRecalculationBanner refreshKey={settingsVersion} />;

  if (loadError && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="গ্রেডিং সিস্টেম" subtitle="বিভাগভিত্তিক ফেল মার্ক ও গ্রেড স্কেল ব্যবস্থাপনা" />
        <ErrorState
          title="তথ্য লোড করা যায়নি"
          message="গ্রেডিং সেটিং আনতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
          onRetry={() => {
            setLoadError(false);
            load(scope);
          }}
          retryText="আবার চেষ্টা করুন"
        />
      </div>
    );
  }

  // Inherited (not yet overridden) division shows the default scale read-only.
  const inherited = scope !== null && !own;
  const failMark = data ? (own ? Number(activeDivision!.fail_mark) : data.failMark) : 0;
  // Legacy fail-named rows (রাসিব / F) are the automatic fail grade, not bands.
  const madrasaGrades = withoutFailGrades("madrasa", data ? (own ? data.ownMadrasa : data.defaultMadrasa) : []);
  const generalGrades = withoutFailGrades("general", data ? (own ? data.ownGeneral : data.defaultGeneral) : []);
  const shownGrades = kind === "madrasa" ? madrasaGrades : generalGrades;
  const kindLabel = kind === "madrasa" ? "মাদরাসা গ্রেড" : "সাধারণ গ্রেড";

  return (
    <div className="space-y-5">
      <PageHeader title="গ্রেডিং সিস্টেম" subtitle="বিভাগভিত্তিক ফেল মার্ক ও গ্রেড স্কেল ব্যবস্থাপনা" />
      {banner}

      {!data ? (
        <HubSkeleton />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <GradeScopePanel
            divisions={data.divisions}
            defaultFailMark={data.failMark}
            selected={scope}
            onSelect={selectScope}
          />

          <div className="min-w-0 flex-1 space-y-4">
            {!ready ? (
              <HubSkeleton />
            ) : (
              <div className="space-y-4" key={scope ?? "default"}>
                <ScopeSummaryCard division={activeDivision} defaultFailMark={data.failMark} reload={reload} />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="গ্রেডের ধরন">
                    {KIND_TABS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={kind === t.key}
                        onClick={() => setKind(t.key)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                          kind === t.key
                            ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        <span aria-hidden="true">{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {inherited && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Lock size={13} />
                      ডিফল্ট গ্রেড স্কেল — নিজস্ব গ্রেডিং চালু করলে এখানে সম্পাদনা করা যাবে
                    </span>
                  )}
                </div>

                <GradeBandPreview
                  grades={shownGrades}
                  failMark={failMark}
                  kind={kind}
                  failLabel={failGradeName(kind)}
                  title={
                    inherited
                      ? `${kindLabel} স্কেল প্রিভিউ (ডিফল্ট থেকে পাওয়া)`
                      : `${kindLabel} স্কেল প্রিভিউ`
                  }
                />

                {kind === "madrasa" ? (
                  <MadrasaGradeList
                    grades={madrasaGrades}
                    reload={reload}
                    failMark={failMark}
                    divisionId={own ? scope : null}
                    readOnly={inherited}
                  />
                ) : (
                  <GeneralGradeList
                    grades={generalGrades}
                    reload={reload}
                    failMark={failMark}
                    divisionId={own ? scope : null}
                    readOnly={inherited}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
