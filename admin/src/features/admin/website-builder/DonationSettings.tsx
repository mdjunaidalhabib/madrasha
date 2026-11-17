import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { commonText, useLang, useText } from "@madrasha/shared-ui/src/i18n";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { WebsiteSettingsContentSkeleton } from "./WebsiteSettingsSkeleton";
import { donationAccountTypes, donationMethodDetails, donationMethodLabels, emptyDonationConfig, type DonationConfig, type DonationMethod } from "@madrasha/shared-ui/src/website/donations";
import SectionCard from "../../../components/settings/SectionCard";
import InlineTextField from "../../../components/settings/InlineTextField";
import { ToggleSwitch } from "../../../components/settings/ToggleSwitch";
import api from "../../../services/api";

const emptyMethod: DonationMethod = { type: "bkash", accountName: "", accountNumber: "", details: "", accountType: "personal" };
const labelClass = "mb-1 block text-sm font-medium text-gray-700 dark:text-slate-400";
const selectClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export default function DonationSettings() {
  const lang = useLang();
  const c = useText(commonText);
  const tx = (bn: string, en: string) => lang === "bn" ? bn : en;
  const [allowed, setAllowed] = useState(false);
  const [config, setConfig] = useState<DonationConfig>(emptyDonationConfig);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<DonationMethod | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [methodOriginal, setMethodOriginal] = useState<DonationMethod | null>(null);
  const openMethod = (index: number | null) => {
    const method = index === null ? emptyMethod : config.methods[index];
    const next = { ...method, accountType: method.accountType ?? (method.type === "bank" ? undefined : /merchant|মার্চেন্ট/i.test(method.details) ? "merchant" : "personal") };
    setEditingIndex(index); setDraft(next); setMethodOriginal(next);
  };
  const methodValid = !!draft?.accountName.trim() && !!draft?.accountNumber.trim() && !!draft?.accountType &&
    (draft.type !== "bank" || !!draft.bankName?.trim() && !!draft.branchName?.trim()) &&
    (!draft.routingNumber || /^[0-9]{9}$/.test(draft.routingNumber));
  const methodCanSave = !busy && methodValid && (editingIndex === null || JSON.stringify(draft) !== JSON.stringify(methodOriginal));
  const load = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/website/admin/donations", { silent: true });
      setAllowed(data.data.allowed);
      setConfig({ ...emptyDonationConfig, ...(data.data.config || {}) });
    } catch (err: any) { setError(err?.response?.data?.message || tx("অনুদানের তথ্য আনা যায়নি।", "Unable to load donation settings.")); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const persist = async (next: DonationConfig) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await api.put("/website/admin/donations", next, { silent: true });
      setConfig(data.data); setMessage(tx("অনুদানের সেটিংস সংরক্ষিত হয়েছে।", "Donation settings saved."));
    } catch (err: any) {
      if (err?.response?.status === 403) setAllowed(false);
      setError(err?.response?.data?.message || tx("সংরক্ষণ করা যায়নি।", "Unable to save donation settings."));
      throw err;
    } finally { setBusy(false); }
  };
  const loadDemo = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await api.get("/website/admin/donations/demo", { silent: true });
      await persist({ ...config, title: data.data.title, description: data.data.description,
        instructions: data.data.instructions, published: false });
    } catch (err: any) { setError(err?.response?.data?.message || tx("ডেমো সংরক্ষণ করা যায়নি।", "Unable to save demo text.")); }
    finally { setBusy(false); }
  };
  const saveMethod = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !methodCanSave) return;
    const method = { ...draft, accountName: draft.accountName.trim(), accountNumber: draft.accountNumber.trim(), details: draft.details.trim() };
    const methods = editingIndex === null ? [...config.methods, method] : config.methods.map((row, index) => index === editingIndex ? method : row);
    try { await persist({ ...config, methods }); setDraft(null); setEditingIndex(null); }
    catch { /* Keep the editor open; the error is displayed below. */ }
  };

  if (loading) return <WebsiteSettingsContentSkeleton tab="donations" />;
  if (!allowed) return <SectionCard title={tx("অনুদান গ্রহণের ব্যবস্থা", "Donation settings")}>
    <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-red-600" : "text-gray-500 dark:text-slate-400"}`}>{error || tx("এই প্রতিষ্ঠানের অনুদান সুবিধা চালু নেই। সুপার অ্যাডমিন অনুমতি দিলে এখানে অনুদান পরিচালনা করতে পারবেন।", "Donation access is not enabled for this institution. The super admin must grant access before you can manage donations.")}</p>
    <Button type="button" variant="secondary" className="mt-4" onClick={load}>{tx("আবার যাচাই করুন", "Check again")}</Button>
  </SectionCard>;

  return <fieldset disabled={busy} className="min-w-0 space-y-6">
    <SectionCard title={tx("অনুদান গ্রহণের ব্যবস্থা", "Donation settings")}
      hint={tx("পেন্সিল আইকনে ক্লিক করে প্রতিটি তথ্য সম্পাদনা ও সংরক্ষণ করুন।", "Use the pencil icon to edit and save each field.")}
      actions={<div className="flex items-center gap-2"><span className="text-xs text-gray-500 dark:text-slate-400">{tx("প্রকাশ করুন", "Publish")}</span><ToggleSwitch title={tx("পাবলিক ওয়েবসাইটে অনুদান প্রকাশ করুন", "Publish donations on the public website")} checked={config.published} disabled={busy} onChange={(published) => { void persist({ ...config, published }).catch(() => {}); }} /></div>}
    >
      <div className="space-y-2">
        <InlineTextField label={tx("শিরোনাম", "Title")} value={config.title} required onSave={(title) => persist({ ...config, title })} />
        <InlineTextField label={tx("অনুদানের উদ্দেশ্য ও বিবরণ", "Purpose and description")} value={config.description} multiline rows={5} onSave={(description) => persist({ ...config, description })} />
        <InlineTextField label={tx("টাকা পাঠানোর নির্দেশনা", "Payment instructions")} value={config.instructions} multiline rows={4} onSave={(instructions) => persist({ ...config, instructions })} />
      </div>
    </SectionCard>

    <SectionCard title={tx("পেমেন্ট মাধ্যম", "Payment methods")} hint={tx("মোবাইল ব্যাংকিং বা ব্যাংক অ্যাকাউন্ট যোগ করুন। তথ্য যাচাই করে সংরক্ষণ করুন।", "Add mobile wallets or bank accounts. Verify the details before saving.")}
      badge={config.methods.length}
      actions={<Button type="button" variant="secondary" disabled={config.methods.length >= 10 || draft !== null} onClick={() => openMethod(null)}><Plus size={14} />{tx("মাধ্যম যোগ করুন", "Add method")}</Button>}
    >
      <div className="space-y-3">
        {config.methods.map((method, index) => <div key={index} className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60">
          <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{lang === "bn" ? donationMethodLabels[method.type].bn : donationMethodLabels[method.type].en}</h3><p className="mt-1 break-words text-sm text-gray-600 dark:text-slate-400">{method.accountName}</p><p className="mt-1 break-all text-sm text-gray-900 dark:text-slate-100"><bdi>{method.accountNumber}</bdi></p>{donationMethodDetails(method, lang) && <p className="mt-1 whitespace-pre-line break-words text-xs text-gray-500 dark:text-slate-400">{donationMethodDetails(method, lang)}</p>}</div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" title={tx("মাধ্যম সম্পাদনা করুন", "Edit method")} disabled={draft !== null} onClick={() => openMethod(index)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"><Pencil size={14} /></button>
            <button type="button" title={tx("মাধ্যম সরান", "Remove method")} disabled={draft !== null} onClick={() => { void persist({ ...config, methods: config.methods.filter((_, i) => i !== index) }).catch(() => {}); }} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"><Trash2 size={14} /></button>
          </div>
        </div>)}
        {!config.methods.length && !draft && <p className="py-4 text-center text-sm text-gray-400 dark:text-slate-500">{tx("এখনো কোনো পেমেন্ট মাধ্যম যোগ করা হয়নি।", "No payment methods added yet.")}</p>}
        {draft && createPortal(<Modal open title={editingIndex === null ? tx("মাধ্যম যোগ করুন", "Add method") : tx("মাধ্যম সম্পাদনা করুন", "Edit method")} closeButtonTone="danger" onClose={() => { if (!busy) { setDraft(null); setEditingIndex(null); } }}><form onSubmit={saveMethod}><fieldset disabled={busy} className="space-y-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-4 dark:border-indigo-900 dark:from-indigo-950/30 dark:to-slate-900">
          <label className="block"><span className={labelClass}>{tx("মাধ্যম", "Method")}</span><select className={selectClass} value={draft.type} onChange={(e) => { const type = e.target.value as DonationMethod["type"]; setDraft({ ...draft, type, accountType: type === "bank" ? "savings" : "personal", bankName: "", branchName: "", routingNumber: "", details: "" }); }}>{Object.entries(donationMethodLabels).map(([key, label]) => <option key={key} value={key}>{lang === "bn" ? label.bn : label.en}</option>)}</select></label>
          <label className="block"><span className={labelClass}>{tx("অ্যাকাউন্টের ধরন", "Account type")}</span><select required className={selectClass} value={draft.accountType || ""} onChange={(e) => setDraft({ ...draft, accountType: e.target.value as DonationMethod["accountType"] })}><option value="" disabled>{tx("ধরন নির্বাচন করুন", "Select account type")}</option>{(draft.type === "bank" ? ["savings", "current"] as const : ["personal", "merchant"] as const).map((key) => <option key={key} value={key}>{lang === "bn" ? donationAccountTypes[key].bn : donationAccountTypes[key].en}</option>)}</select></label>
          {([
            ["accountName", tx("অ্যাকাউন্টধারীর নাম", "Account holder name"), 150],
            ["accountNumber", tx("অ্যাকাউন্ট / মোবাইল নম্বর", "Account / mobile number"), 80],
          ] as const).map(([key, label, max]) => <label key={key} className="block"><span className={labelClass}>{label}</span><Input required maxLength={max} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
          {draft.type === "bank" && <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={labelClass}>{tx("ব্যাংকের নাম", "Bank name")}</span><Input required maxLength={120} list="donation-saved-banks" value={draft.bankName || ""} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} placeholder={tx("ব্যাংকের নাম লিখুন বা বেছে নিন", "Enter or select bank name")} /><datalist id="donation-saved-banks">{[...new Set(config.methods.map((method) => method.bankName).filter(Boolean))].map((name) => <option key={name} value={name} />)}</datalist></label>
            <label className="block"><span className={labelClass}>{tx("শাখার নাম", "Branch name")}</span><Input required maxLength={120} value={draft.branchName || ""} onChange={(e) => setDraft({ ...draft, branchName: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className={labelClass}>{tx("রাউটিং নম্বর (ঐচ্ছিক)", "Routing number (optional)")}</span><Input inputMode="numeric" pattern="[0-9]{9}" maxLength={9} value={draft.routingNumber || ""} onChange={(e) => setDraft({ ...draft, routingNumber: e.target.value.replace(/[^0-9]/g, "") })} placeholder={tx("৯ সংখ্যার রাউটিং নম্বর", "9-digit routing number")} /></label>
          </div>}
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-medium text-gray-500 dark:text-slate-400">{tx("স্বয়ংক্রিয় বিবরণ", "Automatic description")}</p><p className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-slate-300">{donationMethodDetails(draft, lang)}</p></div>
          <div className="flex justify-end border-t border-indigo-100 pt-4 dark:border-indigo-900"><Button type="submit" disabled={!methodCanSave}>{busy ? c.saving : editingIndex === null ? c.add : c.save}</Button></div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}</fieldset></form></Modal>, document.body)}
      </div>
    </SectionCard>

    <SectionCard title={tx("যোগাযোগ ও অনলাইন পেমেন্ট", "Contact and online payment")} hint={tx("অনলাইনে অনুদানের জন্য নিজের পেমেন্ট লিংক এবং সহায়তার নম্বর দিন।", "Add your payment link and an assistance phone number.")}>
      <div className="space-y-2"><InlineTextField label={tx("যোগাযোগের নম্বর", "Contact phone")} value={config.contactPhone} onSave={(contactPhone) => persist({ ...config, contactPhone })} /><InlineTextField label={tx("অনলাইন পেমেন্ট লিংক (ঐচ্ছিক, HTTPS)", "Online payment link (optional, HTTPS)")} value={config.checkoutUrl} placeholder="https://" onSave={(checkoutUrl) => persist({ ...config, checkoutUrl })} /></div>
    </SectionCard>
    <SectionCard title={tx("অনুদানের ডেমো", "Donation demo")} hint={tx("ডেমোর লেখা বসিয়ে সংরক্ষণ করুন। প্রকাশ বন্ধ হবে; নিজের পেমেন্ট অ্যাকাউন্টের তথ্য অক্ষত থাকবে।", "Apply and save demo text. Publication is turned off and your payment accounts are preserved.")}><Button type="button" variant="secondary" onClick={loadDemo}>{tx("ডেমোর লেখা বসান", "Load demo text")}</Button></SectionCard>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">{message}</p>}
  </fieldset>;
}
