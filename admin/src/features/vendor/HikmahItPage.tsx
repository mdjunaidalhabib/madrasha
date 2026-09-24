import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { FaWhatsapp, FaFacebook } from "react-icons/fa";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Card, { CardHeader } from "@madrasha/shared-ui/src/components/ui/Card";
import { getVendorPromo, VendorPromoPayload } from "../../services/vendorPromoApi";
import { VendorIcon } from "./vendorIcons";
import { FounderRow } from "./VendorPromoCard";

// ড্যাশবোর্ডের VendorPromoCard-এর রো-স্টাইলের সাথে মিলিয়ে
const rowClass =
  "flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100 hover:shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700";
const rowIconClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400";

const displayHost = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export default function HikmahItPage() {
  const [promo, setPromo] = useState<VendorPromoPayload | null>(null);

  useEffect(() => {
    getVendorPromo()
      .then(setPromo)
      .catch(() => setPromo({ enabled: false }));
  }, []);

  if (!promo) {
    return (
      <div className="space-y-6">
        <PageHeader title="Hikmah IT"/>
        <Card>
          <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">লোড হচ্ছে...</p>
        </Card>
      </div>
    );
  }

  if (!promo.enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Hikmah IT"/>
        <Card>
          <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            এই পেজটি এই মুহূর্তে উপলব্ধ নেই
          </p>
        </Card>
      </div>
    );
  }

  const { contact, services } = promo;

  const contactRows = [
    { key: "phone", href: `tel:${contact.phone_display}`, icon: <Phone className="h-4 w-4" strokeWidth={1.75} />, label: "ফোন", value: contact.phone_display, ltr: true },
    { key: "whatsapp", href: `https://wa.me/${contact.phone_intl}`, external: true, icon: <FaWhatsapp size={16} />, label: "হোয়াটসঅ্যাপ", value: contact.phone_display, ltr: true },
    { key: "email", href: `mailto:${contact.email}`, icon: <Mail className="h-4 w-4" strokeWidth={1.75} />, label: "ইমেইল", value: contact.email },
    promo.founder.facebook_url && { key: "facebook", href: promo.founder.facebook_url, external: true, icon: <FaFacebook size={15} />, label: "ফেসবুক", value: "প্রোফাইল দেখুন" },
    { key: "website", href: contact.website, external: true, icon: <ExternalLink className="h-4 w-4" strokeWidth={1.75} />, label: "ওয়েবসাইট", value: displayHost(contact.website) },
  ].filter(Boolean) as {
    key: string;
    href: string;
    external?: boolean;
    icon: ReactNode;
    label: string;
    value: string;
    ltr?: boolean;
  }[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={promo.company_name}
        subtitle="আপনার QMS সিস্টেমটি যারা তৈরি ও রক্ষণাবেক্ষণ করছে"
      />

      {/* মোবাইলে পাশের কলাম (ফাউন্ডার + যোগাযোগ) উপরে আসে, বড় স্ক্রিনে ডানে */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <aside className="space-y-4 xl:order-2 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader title="প্রতিষ্ঠাতা" />
            <FounderRow promo={promo} fallbackTo={null} />
          </Card>

          <Card>
            <CardHeader title="যোগাযোগ" />
            <div className="space-y-2">
              {contactRows.map((row) => (
                <a
                  key={row.key}
                  href={row.href}
                  {...(row.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={rowClass}
                >
                  <span className={rowIconClass}>{row.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500">{row.label}</span>
                    <span
                      className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200"
                      dir={row.ltr ? "ltr" : undefined}
                    >
                      {row.value}
                    </span>
                  </span>
                </a>
              ))}
              {contact.address && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800">
                  <span className={rowIconClass}>
                    <MapPin className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500">ঠিকানা</span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {contact.address}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden" padding="none">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white sm:px-10">
              <h2 className="text-xl font-extrabold sm:text-2xl">{promo.hero_title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/90">{promo.hero_text}</p>
            </div>
          </Card>

          {services.length > 0 && (
            <Card>
              <CardHeader title="আমাদের সেবাসমূহ" subtitle="QMS ছাড়াও আমরা যা তৈরি করে দিই" />
              <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </div>
    </div>
  );
}
