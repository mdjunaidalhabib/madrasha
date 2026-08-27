import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { FaWhatsapp, FaFacebook } from "react-icons/fa";
import PageHeader from "../../components/ui/PageHeader";
import Card, { CardHeader } from "../../components/ui/Card";
import { getTenantAdminBase } from "../../utils/tenantSlug";
import { getVendorPromo, VendorPromoPayload } from "../../services/vendorPromoApi";
import { VendorIcon } from "./vendorIcons";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const displayHost = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export default function HikmahItPage() {
  const { madrasaSlug = "" } = useParams();
  const adminBase = getTenantAdminBase(madrasaSlug);
  const [promo, setPromo] = useState<VendorPromoPayload | null>(null);

  useEffect(() => {
    getVendorPromo()
      .then(setPromo)
      .catch(() => setPromo({ enabled: false }));
  }, []);

  const backLink = (
    <Link
      to={`${adminBase}/dashboard`}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <ArrowLeft size={15} />
      ড্যাশবোর্ডে ফিরুন
    </Link>
  );

  if (!promo) {
    return (
      <div className="space-y-6">
        <PageHeader title="Hikmah IT" actions={backLink} />
        <Card>
          <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">লোড হচ্ছে...</p>
        </Card>
      </div>
    );
  }

  if (!promo.enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Hikmah IT" actions={backLink} />
        <Card>
          <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            এই পেজটি এই মুহূর্তে উপলব্ধ নেই
          </p>
        </Card>
      </div>
    );
  }

  const { founder, contact, services } = promo;

  return (
    <div className="space-y-6">
      <PageHeader
        title={promo.company_name}
        subtitle="আপনার QMS সিস্টেমটি যারা তৈরি ও রক্ষণাবেক্ষণ করছে"
        actions={backLink}
      />

      <Card className="overflow-hidden" padding="none">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white sm:px-10">
          <h2 className="text-xl font-extrabold sm:text-2xl">{promo.hero_title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/90">{promo.hero_text}</p>
        </div>
      </Card>

      {services.length > 0 && (
        <Card>
          <CardHeader title="আমাদের সেবাসমূহ" subtitle="QMS ছাড়াও আমরা যা তৈরি করে দিই" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((s) => (
              <div
                key={s.id}
                className={`relative rounded-2xl border p-4 ${
                  s.is_current
                    ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                }`}
              >
                {s.is_current && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    <CheckCircle2 size={11} />
                    আপনি ব্যবহার করছেন
                  </span>
                )}
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <VendorIcon iconKey={s.icon_key} className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {s.label}
                </h3>
                {s.desc && (
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{s.desc}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title={founder.title} />
          <div className="flex flex-col items-start gap-5 sm:flex-row">
            {founder.photo_url ? (
              <img
                src={founder.photo_url}
                alt={founder.name}
                className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-sm"
              />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-2xl font-bold text-white shadow-sm">
                {initials(founder.name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                {founder.title}
              </span>
              <h3 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                {founder.name}
              </h3>
              {founder.location && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  {founder.location}
                </p>
              )}
              {founder.bio && (
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{founder.bio}</p>
              )}
              {founder.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {founder.skills.map((skill: string) => (
                    <span
                      key={skill}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`https://wa.me/${contact.phone_intl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-95"
                >
                  <FaWhatsapp size={13} />
                  WhatsApp
                </a>
                {founder.facebook_url && (
                  <a
                    href={founder.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <FaFacebook size={13} className="text-[#1877F2]" />
                    ফেসবুক প্রোফাইল
                  </a>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="যোগাযোগ" />
          <div className="space-y-2">
            <a
              href={`tel:${contact.phone_display}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-slate-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Phone className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-slate-400 dark:text-slate-500">ফোন</span>
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200" dir="ltr">
                  {contact.phone_display}
                </span>
              </span>
            </a>
            <a
              href={`https://wa.me/${contact.phone_intl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-slate-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <FaWhatsapp size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-slate-400 dark:text-slate-500">হোয়াটসঅ্যাপ</span>
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200" dir="ltr">
                  {contact.phone_display}
                </span>
              </span>
            </a>
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-slate-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Mail className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-slate-400 dark:text-slate-500">ইমেইল</span>
                <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {contact.email}
                </span>
              </span>
            </a>
            {contact.address && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <MapPin className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-slate-400 dark:text-slate-500">ঠিকানা</span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {contact.address}
                  </span>
                </span>
              </div>
            )}
            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-slate-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-slate-400 dark:text-slate-500">ওয়েবসাইট</span>
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {displayHost(contact.website)}
                </span>
              </span>
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
