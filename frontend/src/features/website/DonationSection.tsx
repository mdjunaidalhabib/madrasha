import { useState, type CSSProperties } from "react";
import { Copy, Heart, ExternalLink, Phone, Check } from "lucide-react";
import { useLang } from "@madrasha/shared-ui/src/i18n";
import { donationMethodDetails, donationMethodLabels, type DonationConfig } from "@madrasha/shared-ui/src/website/donations";

export default function DonationSection({ config, accent }: { config: DonationConfig; accent: string }) {
  const lang = useLang();
  const tx = (bn: string, en: string) => lang === "bn" ? bn : en;
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState("");
  const copy = async (value: string, index: number) => {
    try { await navigator.clipboard.writeText(value); setCopied(index); setError(""); }
    catch { setError(tx("কপি করা যায়নি। নম্বরটি নির্বাচন করে কপি করুন।", "Unable to copy. Select and copy the account number.")); }
  };
  return <section id="donation" className="scroll-mt-28 bg-slate-50 px-4 py-14 md:py-20" style={{ "--donation-accent": accent } as CSSProperties}>
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm" style={{ color: accent }}><Heart size={17} />{tx("আপনার সহযোগিতা, আমাদের পথচলা", "Together, we make a difference")}</span>
          <h2 className="mt-5 text-3xl font-extrabold leading-tight text-slate-900 md:text-4xl">{config.title}</h2>
          {config.description && <p className="mt-5 whitespace-pre-line text-base leading-8 text-slate-600">{config.description}</p>}
          {config.checkoutUrl && <a href={config.checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-sm" style={{ backgroundColor: accent }}>{tx("অনলাইনে অনুদান দিন", "Donate online")}<ExternalLink size={17} /></a>}
          {config.contactPhone && <a href={`tel:${config.contactPhone.replace(/[^+\d]/g, "")}`} className="mt-5 flex w-fit items-center gap-2 text-sm font-medium text-slate-700"><Phone size={16} />{tx("সহায়তার জন্য", "For assistance")}: <bdi>{config.contactPhone}</bdi></a>}
        </div>
        <div className="space-y-4">
          {config.methods.map((method, index) => <article key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-lg font-bold text-slate-900">{lang === "bn" ? donationMethodLabels[method.type].bn : donationMethodLabels[method.type].en}</h3><p className="mt-1 text-sm text-slate-500">{method.accountName}</p></div>
              <button type="button" onClick={() => copy(method.accountNumber, index)} aria-label={tx("অ্যাকাউন্ট নম্বর কপি করুন", "Copy account number")} className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{copied === index ? <Check size={16} /> : <Copy size={16} />}{copied === index ? tx("কপি হয়েছে", "Copied") : tx("কপি করুন", "Copy")}</button>
            </div>
            <p dir="ltr" className="mt-4 select-all break-all text-start text-xl font-bold tracking-wide text-slate-900">{method.accountNumber}</p>
            {donationMethodDetails(method, lang) && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{donationMethodDetails(method, lang)}</p>}
          </article>)}
          {config.instructions && <div className="rounded-xl border border-slate-200 p-5"><h3 className="text-sm font-bold text-slate-900">{tx("অনুদান পাঠানোর নির্দেশনা", "How to send your donation")}</h3><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{config.instructions}</p></div>}
          <p className="text-xs leading-6 text-slate-500">{tx("আপনার অনুদান সরাসরি প্রতিষ্ঠানের দেওয়া অ্যাকাউন্ট বা পেমেন্ট লিংকের মাধ্যমে পাঠান। রসিদ ও প্রাপ্তি নিশ্চিত করতে প্রতিষ্ঠানের সঙ্গে যোগাযোগ করুন।", "Send your donation directly to the institution’s listed account or payment link. Contact the institution for a receipt and confirmation.")}</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <span role="status" className="sr-only">{copied !== null ? tx("অ্যাকাউন্ট নম্বর কপি হয়েছে", "Account number copied") : ""}</span>
        </div>
      </div>
    </div>
  </section>;
}
