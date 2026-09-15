import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronRight, ExternalLink, GraduationCap, Sparkles } from "lucide-react";
import Card from "@madrasha/shared-ui/src/components/ui/Card";
import { getVendorPromo, VendorPromoPayload } from "../../services/vendorPromoApi";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const rowClass =
  "flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100 hover:shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700";
const rowTitleClass = "block truncate text-sm font-semibold text-slate-800 dark:text-slate-200";
const rowSubtitleClass = "block truncate text-[11px] text-slate-400 dark:text-slate-500";
const rowTrailIconClass = "h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600";

/** The "Hikmah IT" promo card — every piece of copy comes from Super Admin
 * (see SuperAdminVendorPromoPage.tsx / vendorPromoApi.ts). Reused on the
 * Dashboard sidebar and the Plan/Subscription settings page so both stay
 * visually and behaviorally identical; renders nothing while loading or
 * when a Super Admin has turned the card off. Two rows, both into this
 * page: the services/detail overview, and the founder/CEO profile. */
export default function VendorPromoCard() {
  const [promo, setPromo] = useState<VendorPromoPayload | null>(null);

  useEffect(() => {
    getVendorPromo()
      .then(setPromo)
      .catch(() => setPromo({ enabled: false }));
  }, []);

  if (!promo?.enabled) return null;

  return (
    <Card className="overflow-hidden" padding="none">
      <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <GraduationCap className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{promo.company_name}</p>
            <p className="truncate text-[11px] text-emerald-50/90">{promo.tagline}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 p-5">
        <Link to={`/hikmah-it`} className={rowClass}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={rowTitleClass}>সকল সেবা ও বিস্তারিত</span>
            <span className={rowSubtitleClass}>{promo.teaser_text}</span>
          </span>
          <ChevronRight className={rowTrailIconClass} strokeWidth={1.75} />
        </Link>

        {(() => {
          const founderRowClass =
            "flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-900";

          const founderContent = (
            <>
              {promo.founder.photo_url ? (
                <img
                  src={promo.founder.photo_url}
                  alt={promo.founder.name}
                  className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-emerald-50 dark:ring-emerald-950/40"
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-xs font-bold text-white ring-2 ring-emerald-50 dark:ring-emerald-950/40">
                  {initials(promo.founder.name)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <span className="truncate">{promo.founder.name}</span>
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={2} />
                </span>
                <span className={rowSubtitleClass}>{promo.founder.title}</span>
              </span>
            </>
          );

          return promo.contact.portfolio_url ? (
            <a
              href={promo.contact.portfolio_url}
              target="_blank"
              rel="noopener noreferrer"
              className={founderRowClass}
            >
              {founderContent}
              <ExternalLink className={rowTrailIconClass} strokeWidth={1.75} />
            </a>
          ) : (
            <Link to={`/hikmah-it`} className={founderRowClass}>
              {founderContent}
              <ChevronRight className={rowTrailIconClass} strokeWidth={1.75} />
            </Link>
          );
        })()}
      </div>
    </Card>
  );
}
