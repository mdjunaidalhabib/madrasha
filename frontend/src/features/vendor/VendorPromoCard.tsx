import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, GraduationCap, Mail, Phone } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import Card from "../../components/ui/Card";
import { getVendorPromo, VendorPromoPayload } from "../../services/vendorPromoApi";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const displayHost = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** The "Hikmah IT" promo card — every piece of copy comes from Super Admin
 * (see SuperAdminVendorPromoPage.tsx / vendorPromoApi.ts). Reused on the
 * Dashboard sidebar and the Plan/Subscription settings page so both stay
 * visually and behaviorally identical; renders nothing while loading or
 * when a Super Admin has turned the card off. */
export default function VendorPromoCard({ adminBase }: { adminBase: string }) {
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

      <div className="space-y-4 p-5">
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          {promo.teaser_text}{" "}
          <Link
            to={`${adminBase}/hikmah-it`}
            className="font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
          >
            {promo.detail_link_text} →
          </Link>
        </p>

        <Link
          to={`${adminBase}/hikmah-it`}
          className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {promo.founder.photo_url ? (
            <img
              src={promo.founder.photo_url}
              alt={promo.founder.name}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-xs font-bold text-white">
              {initials(promo.founder.name)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              {promo.founder.name}
            </span>
            <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
              {promo.founder.title}
            </span>
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600"
            strokeWidth={1.75}
          />
        </Link>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <a
              href={`tel:${promo.contact.phone_display}`}
              title="কল করুন"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-emerald-600 hover:text-white dark:bg-slate-800 dark:text-slate-300"
            >
              <Phone className="h-4 w-4" strokeWidth={1.75} />
            </a>
            <a
              href={`https://wa.me/${promo.contact.phone_intl}`}
              target="_blank"
              rel="noopener noreferrer"
              title="হোয়াটসঅ্যাপ"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-[#25D366] hover:text-white dark:bg-slate-800 dark:text-slate-300"
            >
              <FaWhatsapp size={15} />
            </a>
            <a
              href={`mailto:${promo.contact.email}`}
              title="ইমেইল করুন"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-emerald-600 hover:text-white dark:bg-slate-800 dark:text-slate-300"
            >
              <Mail className="h-4 w-4" strokeWidth={1.75} />
            </a>
          </div>
          <a
            href={promo.contact.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
          >
            {displayHost(promo.contact.website)}
          </a>
        </div>
      </div>
    </Card>
  );
}
