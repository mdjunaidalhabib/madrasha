import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import { saveDocumentTemplates } from "../../services/documentTemplateApi";
import { useDocumentTemplateStore } from "../../store/documentTemplateStore";
import {
  ADMIT_CARD_RULE_TOKENS,
  DEFAULT_ADMIT_CARD_RULES,
  DEFAULT_SANAD_TEMPLATE,
  DEFAULT_TESTIMONIAL_TEMPLATE,
  DEFAULT_TRANSFER_LETTER_TEMPLATE,
  SANAD_TOKENS,
  TESTIMONIAL_TOKENS,
  TRANSFER_LETTER_TOKENS,
  renderTemplateText,
  type TemplateToken,
} from "../../utils/documentTemplates";

type TemplateKey =
  | "sanad_template"
  | "testimonial_template"
  | "transfer_letter_template"
  | "admit_card_rules";

type DocType = {
  key: string;
  title: string;
  subtitle: string;
  // fixed data fields shown on this document — always auto-filled from the
  // real student record, never editable free text
  dataFields: string[];
  // which template (if any) has editable surrounding wording
  templateKey?: TemplateKey;
  tokens?: TemplateToken[];
  fallback?: string;
};

const docTypes: DocType[] = [
  {
    key: "id-card",
    title: "আইডি কার্ড",
    subtitle: "শিক্ষার্থীর পরিচয়পত্র",
    dataFields: ["নাম", "রেজিস্ট্রেশন নম্বর", "রোল নম্বর", "শ্রেণি", "বিভাগ", "মোবাইল"],
  },
  {
    key: "admit-card",
    title: "প্রবেশপত্র",
    subtitle: "পরীক্ষার প্রবেশপত্র",
    dataFields: ["নাম", "রেজিস্ট্রেশন নম্বর", "রোল নম্বর", "শ্রেণি", "বিভাগ", "পরীক্ষা", "সেশন"],
    templateKey: "admit_card_rules",
    tokens: ADMIT_CARD_RULE_TOKENS,
    fallback: DEFAULT_ADMIT_CARD_RULES,
  },
  {
    key: "certificate",
    title: "সনদ / সার্টিফিকেট",
    subtitle: "শিক্ষাগত সনদ",
    dataFields: ["নাম", "পিতা", "মাতা", "বিভাগ", "শ্রেণি", "সেশন", "ফলাফল"],
    templateKey: "sanad_template",
    tokens: SANAD_TOKENS,
    fallback: DEFAULT_SANAD_TEMPLATE,
  },
  {
    key: "testimonial",
    title: "প্রত্যয়ন পত্র",
    subtitle: "ছাত্রের প্রত্যয়নপত্র",
    dataFields: ["নাম", "পিতা", "শ্রেণি", "বিভাগ"],
    templateKey: "testimonial_template",
    tokens: TESTIMONIAL_TOKENS,
    fallback: DEFAULT_TESTIMONIAL_TEMPLATE,
  },
  {
    key: "transfer",
    title: "ছাড় পত্র",
    subtitle: "মাদ্রাসা ত্যাগ/ছাড়পত্র",
    dataFields: ["নাম", "পিতা", "রেজিস্ট্রেশন নম্বর", "রোল নম্বর", "শ্রেণি", "বিভাগ", "সেশন"],
    templateKey: "transfer_letter_template",
    tokens: TRANSFER_LETTER_TOKENS,
    fallback: DEFAULT_TRANSFER_LETTER_TEMPLATE,
  },
];

// শুধুমাত্র প্রিভিউ দেখানোর জন্য নমুনা তথ্য — এটি কোনো প্রকৃত শিক্ষার্থীর তথ্য নয় এবং কোথাও সেভ হয় না
const PREVIEW_ROW: Record<string, any> = {
  student_name: "মোহাম্মদ ইয়াসিন",
  father_name: "আব্দুল করিম",
  mother_name: "রহিমা বেগম",
  division_name: "হিফজ",
  class_name: "৫ম শ্রেণি",
  academic_year: "১৪৪৬-১৪৪৭",
  result_summary: "PASS (মুমতাজ)",
  id: "১০৪৫",
  roll: "০৭",
  exam_name: "বার্ষিক পরীক্ষা",
};

export default function TalimatDocumentsPage() {
  const templates = useDocumentTemplateStore((s) => s.templates);
  const fetchTemplates = useDocumentTemplateStore((s) => s.fetchTemplates);
  const setTemplates = useDocumentTemplateStore((s) => s.setTemplates);

  const [activeKey, setActiveKey] = useState(docTypes[0].key);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const active = useMemo(
    () => docTypes.find((item) => item.key === activeKey) || docTypes[0],
    [activeKey],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchTemplates(true);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!templates) return;
    const next: Record<string, string> = {};
    for (const d of docTypes) {
      if (d.templateKey) {
        next[d.templateKey] = (templates as any)[d.templateKey] || d.fallback || "";
      }
    }
    setValues(next);
  }, [templates]);

  const insertToken = (token: string) => {
    if (!active.templateKey) return;
    const key = active.templateKey;
    setValues((prev) => ({
      ...prev,
      [key]: `${prev[key] ?? ""}{{${token}}}`,
    }));
  };

  const resetToDefault = () => {
    if (!active.templateKey) return;
    setValues((prev) => ({ ...prev, [active.templateKey as string]: active.fallback || "" }));
  };

  const handleSave = async () => {
    if (!active.templateKey) return;
    setMessage("");
    setError("");
    setSaving(true);
    try {
      const payload = { [active.templateKey]: values[active.templateKey] };
      await saveDocumentTemplates(payload);
      setTemplates({ ...(templates || {}), ...payload });
      setMessage(
        "সেভ হয়েছে। এখন থেকে প্রকৃত শিক্ষার্থীর ডকুমেন্ট প্রিন্ট করার সময় এই লেখা দেখাবে।",
      );
    } catch {
      setError("সেভ করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl bg-white p-6 shadow">লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ডকুমেন্ট টেমপ্লেট"
        subtitle="আইডি কার্ড, প্রবেশপত্র, সনদ, প্রত্যয়ন পত্র ও ছাড়পত্রের লেখা এখান থেকে সাজান"
      />

      <div className="grid gap-3 md:grid-cols-5">
        {docTypes.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveKey(item.key)}
            className={`rounded-2xl border p-4 text-left transition ${activeKey === item.key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"}`}
          >
            <span className="block font-bold">{item.title}</span>
            <span className="mt-1 block text-xs text-slate-500">{item.subtitle}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        নাম, পিতা, রেজিস্ট্রেশন নম্বর, রোল, শ্রেণি, বিভাগ, সেশন, পরীক্ষার নাম — এই তথ্যগুলো সবসময়
        শিক্ষার্থীর প্রকৃত তথ্য থেকে স্বয়ংক্রিয়ভাবে বসবে, এখানে হাতে লিখে পরিবর্তন করা যাবে না।
        নিচে শুধু চারপাশের লেখা (বাক্য/নিয়ম-কানুন) এডিট করা যাবে, আর সেভ করলে সেটি প্রকৃত প্রিন্টেও
        দেখাবে।
      </div>

      {message && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">{active.title} — টেমপ্লেট এডিট</h2>

          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-slate-500">
              এই ডকুমেন্টে যেসব তথ্য স্বয়ংক্রিয়ভাবে বসে:
            </p>
            <div className="flex flex-wrap gap-2">
              {active.dataFields.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {active.templateKey ? (
            <div className="mt-5 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  লেখার মধ্যে যোগ করুন (এগুলো নিজে থেকে সঠিক তথ্য দিয়ে পূরণ হবে)
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(active.tokens || []).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => insertToken(t.key)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      + {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={values[active.templateKey] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [active.templateKey as string]: e.target.value }))
                }
                rows={9}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm leading-6 focus:border-blue-400 focus:outline-none"
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={saving} onClick={handleSave}>
                  {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
                </Button>
                <button
                  type="button"
                  onClick={resetToDefault}
                  className="text-xs font-medium text-gray-500 underline hover:text-gray-700"
                >
                  ডিফল্ট লেখায় ফিরিয়ে নিন
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              এই ডকুমেন্টে এডিট করার মতো কোনো বাক্য নেই — এটি শুধু শিক্ষার্থীর তথ্য দেখায়।
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            প্রিভিউ (নমুনা তথ্য দিয়ে)
          </p>
          <div className="rounded-xl border-2 border-slate-800 p-5 text-center">
            <p className="text-sm text-slate-500">بسم الله الرحمن الرحيم</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{active.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{active.subtitle}</p>

            {active.templateKey ? (
              <div className="mt-6 whitespace-pre-line text-left text-sm leading-7 text-slate-800">
                {renderTemplateText(values[active.templateKey] ?? "", PREVIEW_ROW)}
              </div>
            ) : (
              <div className="mt-6 space-y-3 text-left">
                {active.dataFields.map((label) => (
                  <div key={label} className="flex justify-between border-b pb-2 text-sm">
                    <span className="font-semibold text-slate-700">{label}</span>
                    <span className="text-slate-900">নমুনা তথ্য</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10 flex justify-between text-sm text-slate-700">
              <span>তারিখ: {new Date().toLocaleDateString("bn-BD")}</span>
              <span>স্বাক্ষর: ........................</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
