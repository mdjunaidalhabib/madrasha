import { useState, type FormEvent } from "react";
import axios from "axios";
import { ArrowRight, Check, CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useLang, LanguageSwitcher } from "@madrasha/shared-ui/src/i18n";
import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";

const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10";
function campaignAttribution() {
  const params = new URLSearchParams(window.location.search);
  const keys = { utm_source: "utmSource", utm_medium: "utmMedium", utm_campaign: "utmCampaign", utm_content: "utmContent", utm_term: "utmTerm", fbclid: "fbclid" };
  const current: Record<string, string> = {};
  for (const [key, field] of Object.entries(keys)) {
    const value = params.get(key);
    if (value) current[field] = value.slice(0, field === "fbclid" ? 500 : 200);
  }
  try {
    if (Object.keys(current).length) sessionStorage.setItem("ems-lead-attribution", JSON.stringify(current));
    else Object.assign(current, JSON.parse(sessionStorage.getItem("ems-lead-attribution") || "{}"));
  } catch { /* Forms still work when browser storage is disabled. */ }
  return { ...current, landingPath: window.location.pathname.slice(0, 300) };
}

export default function LeadCapture() {
  const bn = useLang() === "bn";
  const say = (bnText: string, enText: string) => bn ? bnText : enText;
  const [attribution] = useState(campaignAttribution);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    try {
      await axios.post(`${API_BASE_URL}/public/leads`, { ...values, studentCount: values.studentCount || undefined, consent: values.consent === "on", ...attribution }, { timeout: 20000 });
      setDone(true);
    } catch (err) {
      setError(axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : say("অনুরোধ পাঠানো যায়নি। আবার চেষ্টা করুন।", "Could not send your request. Please try again."));
    } finally { setBusy(false); }
  }
  return <section id="demo" className="relative scroll-mt-24 overflow-hidden bg-[#091d20] px-4 py-20 sm:px-6">
    <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-3xl" />
    <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
      <div className="text-white">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-300"><Sparkles size={14} /> {say("আপনার প্রতিষ্ঠানের পরবর্তী পদক্ষেপ", "YOUR NEXT CHAPTER STARTS HERE")}</span>
        <h2 className="mt-6 text-3xl font-bold leading-tight sm:text-5xl">{say("প্রতিষ্ঠান পরিচালনা হোক", "Less paperwork.")}<span className="mt-3 block text-emerald-300">{say("আরও সহজ, আরও স্মার্ট।", "More possibilities.")}</span></h2>
        <p className="mt-6 max-w-md text-base leading-8 text-slate-300">{say("EMS কীভাবে আপনার প্রতিষ্ঠানের ভর্তি, হাজিরা, ফি ও ফলাফল এক জায়গায় আনতে পারে—দেখুন একটি ব্যক্তিগত ডেমোতে।", "See how EMS brings admissions, attendance, fees and results together in a personal walkthrough for your institution.")}</p>
        <div className="my-8 space-y-4">{[
          say("আপনার প্রতিষ্ঠানের প্রয়োজন অনুযায়ী ডেমো", "A walkthrough tailored to your institution"),
          say("ফিচার ও প্যাকেজ সম্পর্কে সরাসরি পরামর্শ", "Clear guidance on features and packages"),
          say("শুরু করার প্রতিটি ধাপে সহযোগিতা", "Support to help your team get started"),
        ].map((text) => <div key={text} className="flex items-center gap-3 text-sm text-slate-200"><span className="rounded-full bg-emerald-400/15 p-1 text-emerald-300"><Check size={15} /></span>{text}</div>)}</div>
        <div className="flex items-center gap-3 border-t border-white/10 pt-6 text-sm text-slate-400"><ShieldCheck className="shrink-0 text-emerald-400" size={22} />{say("কোনো পেমেন্ট ছাড়াই ডেমোর অনুরোধ করুন।", "Request your demo. No payment required.")}</div>
      </div>
      <div className="rounded-3xl border border-white/15 bg-white p-6 shadow-2xl sm:p-9">
        {done ? <div role="status" className="flex min-h-[510px] flex-col items-center justify-center text-center">
          <div className="mb-6 rounded-full bg-emerald-50 p-5 text-emerald-600"><CheckCircle2 size={48} /></div>
          <h3 className="text-2xl font-bold text-slate-900">{say("ধন্যবাদ! অনুরোধ পেয়েছি।", "You're on the list!")}</h3>
          <p className="mt-4 max-w-sm leading-7 text-slate-600">{say("আমাদের টিম আপনার দেওয়া নম্বরে যোগাযোগ করে ডেমোর সময় ঠিক করবে।", "Our team will contact you on the number you provided to arrange your demo.")}</p>
          <a href="tel:01624114405" className="mt-8 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white">{say("সরাসরি কথা বলুন", "Call our team")}</a>
        </div> : <>
          <div className="mb-6 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">LET’S TALK EMS</p><h3 className="mt-2 text-2xl font-bold text-slate-900">{say("ফ্রি ডেমো বুক করুন", "Book your free demo")}</h3><p className="mt-2 text-sm text-slate-500">{say("আপনার তথ্য দিন, বাকিটা আমরা দেখছি।", "A few details. A better way to manage.")}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{say("ফ্রি", "FREE")}</span></div>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">{say("আপনার নাম", "Your name")} *<input autoComplete="name" name="name" required minLength={2} maxLength={100} placeholder={say("সম্পূর্ণ নাম", "Full name")} className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">{say("মোবাইল নম্বর", "Mobile number")} *<input autoComplete="tel" inputMode="tel" name="phone" required maxLength={40} placeholder="01XXXXXXXXX" className={inputClass} /></label>
            </div>
            <label className="block text-sm font-medium text-slate-700">{say("প্রতিষ্ঠানের নাম", "Institution name")} *<input autoComplete="organization" name="institution" required minLength={2} maxLength={180} placeholder={say("আপনার প্রতিষ্ঠানের নাম লিখুন", "Enter your institution name")} className={inputClass} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">{say("প্রতিষ্ঠানের ধরন", "Institution type")} *<select name="institutionType" required defaultValue="" className={inputClass}><option value="" disabled>{say("বেছে নিন", "Select type")}</option>{[["madrasa", "মাদরাসা", "Madrasa"], ["school", "স্কুল", "School"], ["college", "কলেজ", "College"], ["kindergarten", "কিন্ডারগার্টেন", "Kindergarten"], ["other", "অন্যান্য", "Other"]].map(([v, b, e]) => <option key={v} value={v}>{say(b, e)}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">{say("শিক্ষার্থী সংখ্যা", "Number of students")}<select name="studentCount" defaultValue="" className={inputClass}><option value="">{say("বেছে নিন (ঐচ্ছিক)", "Select (optional)")}</option>{["1-100", "101-300", "301-500", "501-1000", "1000+"].map((v) => <option key={v}>{v}</option>)}</select></label>
            </div>
            <label className="block text-sm font-medium text-slate-700">{say("কী জানতে চান? (ঐচ্ছিক)", "Anything you'd like us to know? (optional)")}<textarea name="message" maxLength={2000} rows={2} className={inputClass} placeholder={say("আপনার প্রয়োজন সংক্ষেপে লিখুন", "Tell us what your team needs")} /></label>
            <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <label className="flex items-start gap-2.5 text-xs leading-5 text-slate-500"><input name="consent" type="checkbox" required className="mt-1 accent-emerald-600" />{say("ডেমো ও EMS সেবা সম্পর্কে আমার দেওয়া নম্বরে যোগাযোগ করতে সম্মতি দিচ্ছি।", "I agree to be contacted at my number about this demo and EMS services.")}</label>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={20} /> : <>{say("আমার ডেমো বুক করুন", "Request my free demo")}<ArrowRight size={19} /></>}</button>
          </form>
        </>}
      </div>
    </div>
  </section>;
}

export function DemoLandingPage() {
  const bn = useLang() === "bn";
  return <main className="min-h-screen bg-[#091d20]"><header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><a href="/" className="text-2xl font-black tracking-tight text-white">EMS<span className="text-emerald-400">.</span></a><LanguageSwitcher /></header><LeadCapture /><footer className="px-6 pb-8 text-center text-xs text-slate-400">EMS · Hikmah IT · <a href="tel:01624114405">01624114405</a> · <a href="/" className="underline">{bn ? "মূল ওয়েবসাইট" : "Visit website"}</a></footer></main>;
}
