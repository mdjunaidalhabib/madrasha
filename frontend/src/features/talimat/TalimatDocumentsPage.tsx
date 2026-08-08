import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import { SkeletonCard } from "../../components/ui/Skeleton";
import { saveDocumentTemplates } from "../../services/documentTemplateApi";
import { useDocumentTemplateStore } from "../../store/documentTemplateStore";
import { useBrandingStore } from "../../store/brandingStore";
import { useIdCardDesignStore } from "../../store/idCardDesignStore";
import { saveIdCardDesign, type IdCardDesignKey } from "../../services/idCardDesignApi";
import { useAdmitCardDesignStore } from "../../store/admitCardDesignStore";
import { saveAdmitCardDesign, type AdmitCardDesignKey } from "../../services/admitCardDesignApi";
import { useLetterDesignStore } from "../../store/letterDesignStore";
import { saveLetterDesign, type LetterDesignKey } from "../../services/letterDesignApi";
import { useBookLabelDesignStore } from "../../store/bookLabelDesignStore";
import { saveBookLabelDesign, type BookLabelDesignKey } from "../../services/bookLabelDesignApi";
import IdCardClassic from "../../components/Report/documents/id-card-designs/IdCardClassic";
import IdCardMinimal from "../../components/Report/documents/id-card-designs/IdCardMinimal";
import IdCardArch from "../../components/Report/documents/id-card-designs/IdCardArch";
import IdCardCustom from "../../components/Report/documents/id-card-designs/IdCardCustom";
import AdmitCardClassic from "../../components/Report/documents/admit-card-designs/AdmitCardClassic";
import AdmitCardMinimal from "../../components/Report/documents/admit-card-designs/AdmitCardMinimal";
import AdmitCardArch from "../../components/Report/documents/admit-card-designs/AdmitCardArch";
import AdmitCardCustom from "../../components/Report/documents/admit-card-designs/AdmitCardCustom";
import BookLabelClassic from "../../components/Report/documents/book-label-designs/BookLabelClassic";
import BookLabelMinimal from "../../components/Report/documents/book-label-designs/BookLabelMinimal";
import BookLabelArch from "../../components/Report/documents/book-label-designs/BookLabelArch";
import BookLabelCustom from "../../components/Report/documents/book-label-designs/BookLabelCustom";
import LetterDocument from "../../components/Report/documents/engine/LetterDocument";
import {
  ADMIT_CARD_RULE_TOKENS,
  DEFAULT_ADMIT_CARD_RULES,
  DEFAULT_SANAD_TEMPLATE,
  DEFAULT_TESTIMONIAL_TEMPLATE,
  DEFAULT_TRANSFER_LETTER_TEMPLATE,
  SANAD_TOKENS,
  TESTIMONIAL_TOKENS,
  TRANSFER_LETTER_TOKENS,
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
    dataFields: ["ছবি", "নাম", "রেজিস্ট্রেশন নম্বর", "রোল নম্বর", "শ্রেণি", "বিভাগ", "পিতা", "মোবাইল"],
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
  {
    key: "book-label",
    title: "পুরস্কার বই-লেবেল",
    subtitle: "মেধাক্রম ১-৩ / মুমতাজ শিক্ষার্থীদের বইয়ের প্রচ্ছদ-লেবেল",
    dataFields: ["নাম", "মেধাক্রম", "রোল নম্বর", "শ্রেণি", "বিভাগ", "গ্রেড", "পরীক্ষা", "সেশন"],
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
  registration_no: "৪৫৬৭৮৯",
  roll: "০৭",
  guardian_phone: "০১৭xxxxxxxx",
  exam_name: "বার্ষিক পরীক্ষা",
  exam_year: "১৪৪৬",
  rank_no: 1,
  madrasa_grade: "মুমতায",
};

// LetterDocument (Sanad/Testimonial/Transfer) heading/footer wiring — kept in
// sync with each list's own config (SanadList.tsx etc.) so the settings-page
// preview matches the real printed document exactly.
const LETTER_CONFIG: Record<
  string,
  {
    heading: string;
    showBismillah?: boolean;
    headingClassName?: string;
    bodyClassName?: string;
    footer: ReactNode;
  }
> = {
  certificate: {
    heading: "সনদ পত্র",
    showBismillah: true,
    footer: (
      <div className="mt-16 flex justify-between text-sm font-semibold">
        <span>তারিখ: ........................</span>
        <span>প্রধান শিক্ষকের স্বাক্ষর ও সীল</span>
      </div>
    ),
  },
  testimonial: {
    heading: "প্রত্যয়ন পত্র",
    headingClassName: "mb-8 text-center text-2xl font-bold",
    bodyClassName: "whitespace-pre-line text-lg leading-9 text-slate-800",
    footer: <div className="mt-16 text-right text-sm font-semibold">প্রধান শিক্ষকের স্বাক্ষর</div>,
  },
  transfer: {
    heading: "ছাড়পত্র",
    showBismillah: true,
    footer: (
      <div className="mt-16 flex justify-between text-sm font-semibold">
        <span>তারিখ: ........................</span>
        <span>প্রধান শিক্ষকের স্বাক্ষর ও সীল</span>
      </div>
    ),
  },
};

const ID_CARD_PRESETS: { key: Exclude<IdCardDesignKey, "custom">; label: string }[] = [
  { key: "classic", label: "ধ্রুপদী" },
  { key: "minimal", label: "মিনিমাল" },
  { key: "arch", label: "খিলান" },
];

const CARD_THUMB_SCALE = 0.42;

const IdCardThumb = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{ width: `${54 * CARD_THUMB_SCALE}mm`, height: `${85.6 * CARD_THUMB_SCALE}mm`, overflow: "hidden" }}
  >
    <div
      style={{
        transform: `scale(${CARD_THUMB_SCALE})`,
        transformOrigin: "top left",
        width: "54mm",
        height: "85.6mm",
      }}
    >
      {children}
    </div>
  </div>
);

const ADMIT_THUMB_BASE = 480;
const ADMIT_THUMB_SCALE = 0.4;

const AdmitThumb = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: ADMIT_THUMB_BASE * ADMIT_THUMB_SCALE,
      height: 150,
      overflow: "hidden",
    }}
  >
    <div
      style={{ transform: `scale(${ADMIT_THUMB_SCALE})`, transformOrigin: "top left", width: ADMIT_THUMB_BASE }}
    >
      {children}
    </div>
  </div>
);

const LETTER_THUMB_BASE = 480;
const LETTER_THUMB_SCALE = 0.36;

const LetterThumb = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: LETTER_THUMB_BASE * LETTER_THUMB_SCALE,
      height: 220,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        transform: `scale(${LETTER_THUMB_SCALE})`,
        transformOrigin: "top left",
        width: LETTER_THUMB_BASE,
      }}
    >
      {children}
    </div>
  </div>
);

const BOOK_LABEL_THUMB_SCALE = 0.42;

const BookLabelThumb = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: `${92 * BOOK_LABEL_THUMB_SCALE}mm`, height: `${58 * BOOK_LABEL_THUMB_SCALE}mm`, overflow: "hidden" }}>
    <div
      style={{
        transform: `scale(${BOOK_LABEL_THUMB_SCALE})`,
        transformOrigin: "top left",
        width: "92mm",
        height: "58mm",
      }}
    >
      {children}
    </div>
  </div>
);

const PRESET_LABELS: { key: "classic" | "minimal" | "arch"; label: string }[] = [
  { key: "classic", label: "ধ্রুপদী" },
  { key: "minimal", label: "মিনিমাল" },
  { key: "arch", label: "খিলান" },
];

export default function TalimatDocumentsPage() {
  const templates = useDocumentTemplateStore((s) => s.templates);
  const fetchTemplates = useDocumentTemplateStore((s) => s.fetchTemplates);
  const setTemplates = useDocumentTemplateStore((s) => s.setTemplates);

  const branding = useBrandingStore((s) => s.branding);
  const fetchBranding = useBrandingStore((s) => s.fetchBranding);

  const idCardDesign = useIdCardDesignStore((s) => s.design);
  const fetchIdCardDesign = useIdCardDesignStore((s) => s.fetchDesign);
  const setIdCardDesignStore = useIdCardDesignStore((s) => s.setDesign);

  const admitCardDesign = useAdmitCardDesignStore((s) => s.design);
  const fetchAdmitCardDesign = useAdmitCardDesignStore((s) => s.fetchDesign);
  const setAdmitCardDesignStore = useAdmitCardDesignStore((s) => s.setDesign);

  const letterDesign = useLetterDesignStore((s) => s.design);
  const fetchLetterDesign = useLetterDesignStore((s) => s.fetchDesign);
  const setLetterDesignStore = useLetterDesignStore((s) => s.setDesign);

  const bookLabelDesign = useBookLabelDesignStore((s) => s.design);
  const fetchBookLabelDesign = useBookLabelDesignStore((s) => s.fetchDesign);
  const setBookLabelDesignStore = useBookLabelDesignStore((s) => s.setDesign);

  const [activeKey, setActiveKey] = useState(docTypes[0].key);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [designKey, setDesignKey] = useState<IdCardDesignKey>("classic");
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [designSaving, setDesignSaving] = useState(false);
  const [designMessage, setDesignMessage] = useState("");
  const [designError, setDesignError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [admitDesignKey, setAdmitDesignKey] = useState<AdmitCardDesignKey>("classic");
  const [admitCustomBg, setAdmitCustomBg] = useState<string | null>(null);
  const [admitDesignSaving, setAdmitDesignSaving] = useState(false);
  const [admitDesignMessage, setAdmitDesignMessage] = useState("");
  const [admitDesignError, setAdmitDesignError] = useState("");
  const admitFileRef = useRef<HTMLInputElement>(null);

  const [letterDesignKey, setLetterDesignKey] = useState<LetterDesignKey>("classic");
  const [letterCustomBg, setLetterCustomBg] = useState<string | null>(null);
  const [letterDesignSaving, setLetterDesignSaving] = useState(false);
  const [letterDesignMessage, setLetterDesignMessage] = useState("");
  const [letterDesignError, setLetterDesignError] = useState("");
  const letterFileRef = useRef<HTMLInputElement>(null);

  const [bookLabelDesignKey, setBookLabelDesignKey] = useState<BookLabelDesignKey>("classic");
  const [bookLabelCustomBg, setBookLabelCustomBg] = useState<string | null>(null);
  const [bookLabelDesignSaving, setBookLabelDesignSaving] = useState(false);
  const [bookLabelDesignMessage, setBookLabelDesignMessage] = useState("");
  const [bookLabelDesignError, setBookLabelDesignError] = useState("");
  const bookLabelFileRef = useRef<HTMLInputElement>(null);

  const active = useMemo(
    () => docTypes.find((item) => item.key === activeKey) || docTypes[0],
    [activeKey],
  );

  const madrasaName = branding?.name || "মাদ্রাসার নাম";

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        fetchTemplates(true),
        fetchIdCardDesign(true),
        fetchAdmitCardDesign(true),
        fetchLetterDesign(true),
        fetchBookLabelDesign(true),
        fetchBranding(),
      ]);
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

  useEffect(() => {
    if (!idCardDesign) return;
    setDesignKey(idCardDesign.id_card_design);
    setCustomBg(idCardDesign.id_card_background_image);
  }, [idCardDesign]);

  useEffect(() => {
    if (!admitCardDesign) return;
    setAdmitDesignKey(admitCardDesign.admit_card_design);
    setAdmitCustomBg(admitCardDesign.admit_card_background_image);
  }, [admitCardDesign]);

  useEffect(() => {
    if (!letterDesign) return;
    setLetterDesignKey(letterDesign.letter_design);
    setLetterCustomBg(letterDesign.letter_background_image);
  }, [letterDesign]);

  useEffect(() => {
    if (!bookLabelDesign) return;
    setBookLabelDesignKey(bookLabelDesign.book_label_design);
    setBookLabelCustomBg(bookLabelDesign.book_label_background_image);
  }, [bookLabelDesign]);

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

  const readImageFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setError2: (msg: string) => void,
    onLoaded: (dataUrl: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError2("");

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError2("শুধু PNG বা JPG ছবি আপলোড করা যাবে");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError2("ছবির সাইজ ২MB এর কম হতে হবে");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => onLoaded(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleBackgroundFile = (e: React.ChangeEvent<HTMLInputElement>) =>
    readImageFile(e, setDesignError, (dataUrl) => {
      setCustomBg(dataUrl);
      setDesignKey("custom");
    });

  const handleRemoveBackground = () => {
    setCustomBg(null);
    setDesignKey("classic");
  };

  const handleSaveIdCardDesign = async () => {
    setDesignMessage("");
    setDesignError("");
    setDesignSaving(true);
    try {
      const payload: { id_card_design: IdCardDesignKey; id_card_background_image?: string | null } = {
        id_card_design: designKey,
      };
      if (customBg !== (idCardDesign?.id_card_background_image ?? null)) {
        payload.id_card_background_image = customBg;
      }

      await saveIdCardDesign(payload);
      setIdCardDesignStore({
        id_card_design: designKey,
        id_card_background_image:
          payload.id_card_background_image !== undefined
            ? payload.id_card_background_image
            : idCardDesign?.id_card_background_image ?? null,
      });
      setDesignMessage("ডিজাইন সেভ হয়েছে। এখন থেকে আইডি কার্ড প্রিন্টে এই ডিজাইন দেখাবে।");
    } catch {
      setDesignError("সেভ করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setDesignSaving(false);
    }
  };

  const handleAdmitBackgroundFile = (e: React.ChangeEvent<HTMLInputElement>) =>
    readImageFile(e, setAdmitDesignError, (dataUrl) => {
      setAdmitCustomBg(dataUrl);
      setAdmitDesignKey("custom");
    });

  const handleRemoveAdmitBackground = () => {
    setAdmitCustomBg(null);
    setAdmitDesignKey("classic");
  };

  const handleSaveAdmitCardDesign = async () => {
    setAdmitDesignMessage("");
    setAdmitDesignError("");
    setAdmitDesignSaving(true);
    try {
      const payload: {
        admit_card_design: AdmitCardDesignKey;
        admit_card_background_image?: string | null;
      } = { admit_card_design: admitDesignKey };
      if (admitCustomBg !== (admitCardDesign?.admit_card_background_image ?? null)) {
        payload.admit_card_background_image = admitCustomBg;
      }

      await saveAdmitCardDesign(payload);
      setAdmitCardDesignStore({
        admit_card_design: admitDesignKey,
        admit_card_background_image:
          payload.admit_card_background_image !== undefined
            ? payload.admit_card_background_image
            : admitCardDesign?.admit_card_background_image ?? null,
      });
      setAdmitDesignMessage("ডিজাইন সেভ হয়েছে। এখন থেকে প্রবেশপত্র প্রিন্টে এই ডিজাইন দেখাবে।");
    } catch {
      setAdmitDesignError("সেভ করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setAdmitDesignSaving(false);
    }
  };

  const handleLetterBackgroundFile = (e: React.ChangeEvent<HTMLInputElement>) =>
    readImageFile(e, setLetterDesignError, (dataUrl) => {
      setLetterCustomBg(dataUrl);
      setLetterDesignKey("custom");
    });

  const handleRemoveLetterBackground = () => {
    setLetterCustomBg(null);
    setLetterDesignKey("classic");
  };

  const handleSaveLetterDesign = async () => {
    setLetterDesignMessage("");
    setLetterDesignError("");
    setLetterDesignSaving(true);
    try {
      const payload: { letter_design: LetterDesignKey; letter_background_image?: string | null } = {
        letter_design: letterDesignKey,
      };
      if (letterCustomBg !== (letterDesign?.letter_background_image ?? null)) {
        payload.letter_background_image = letterCustomBg;
      }

      await saveLetterDesign(payload);
      setLetterDesignStore({
        letter_design: letterDesignKey,
        letter_background_image:
          payload.letter_background_image !== undefined
            ? payload.letter_background_image
            : letterDesign?.letter_background_image ?? null,
      });
      setLetterDesignMessage(
        "ডিজাইন সেভ হয়েছে। এখন থেকে সনদ, প্রত্যয়ন পত্র ও ছাড়পত্র — তিনটাতেই এই ডিজাইন দেখাবে।",
      );
    } catch {
      setLetterDesignError("সেভ করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setLetterDesignSaving(false);
    }
  };

  const handleBookLabelBackgroundFile = (e: React.ChangeEvent<HTMLInputElement>) =>
    readImageFile(e, setBookLabelDesignError, (dataUrl) => {
      setBookLabelCustomBg(dataUrl);
      setBookLabelDesignKey("custom");
    });

  const handleRemoveBookLabelBackground = () => {
    setBookLabelCustomBg(null);
    setBookLabelDesignKey("classic");
  };

  const handleSaveBookLabelDesign = async () => {
    setBookLabelDesignMessage("");
    setBookLabelDesignError("");
    setBookLabelDesignSaving(true);
    try {
      const payload: {
        book_label_design: BookLabelDesignKey;
        book_label_background_image?: string | null;
      } = { book_label_design: bookLabelDesignKey };
      if (bookLabelCustomBg !== (bookLabelDesign?.book_label_background_image ?? null)) {
        payload.book_label_background_image = bookLabelCustomBg;
      }

      await saveBookLabelDesign(payload);
      setBookLabelDesignStore({
        book_label_design: bookLabelDesignKey,
        book_label_background_image:
          payload.book_label_background_image !== undefined
            ? payload.book_label_background_image
            : bookLabelDesign?.book_label_background_image ?? null,
      });
      setBookLabelDesignMessage("ডিজাইন সেভ হয়েছে। এখন থেকে পুরস্কার বই-লেবেল প্রিন্টে এই ডিজাইন দেখাবে।");
    } catch {
      setBookLabelDesignError("সেভ করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBookLabelDesignSaving(false);
    }
  };

  if (loading) {
    return <SkeletonCard lines={5} />;
  }

  const isAdmitCard = active.key === "admit-card";
  const isLetterDoc = active.key === "certificate" || active.key === "testimonial" || active.key === "transfer";

  const renderIdCardPreview = () => {
    if (designKey === "minimal") return <IdCardMinimal row={PREVIEW_ROW} madrasaName={madrasaName} />;
    if (designKey === "arch") return <IdCardArch row={PREVIEW_ROW} madrasaName={madrasaName} />;
    if (designKey === "custom" && customBg) {
      return <IdCardCustom row={PREVIEW_ROW} backgroundImage={customBg} />;
    }
    return <IdCardClassic row={PREVIEW_ROW} madrasaName={madrasaName} />;
  };

  const renderBookLabelPreview = () => {
    if (bookLabelDesignKey === "minimal") {
      return <BookLabelMinimal row={PREVIEW_ROW} madrasaName={madrasaName} />;
    }
    if (bookLabelDesignKey === "arch") {
      return <BookLabelArch row={PREVIEW_ROW} madrasaName={madrasaName} />;
    }
    if (bookLabelDesignKey === "custom" && bookLabelCustomBg) {
      return <BookLabelCustom row={PREVIEW_ROW} backgroundImage={bookLabelCustomBg} />;
    }
    return <BookLabelClassic row={PREVIEW_ROW} madrasaName={madrasaName} />;
  };

  const admitRulesTemplate = values.admit_card_rules ?? DEFAULT_ADMIT_CARD_RULES;

  const renderAdmitCardPreview = () => {
    if (admitDesignKey === "minimal") {
      return <AdmitCardMinimal row={PREVIEW_ROW} madrasaName={madrasaName} rulesTemplate={admitRulesTemplate} />;
    }
    if (admitDesignKey === "arch") {
      return <AdmitCardArch row={PREVIEW_ROW} madrasaName={madrasaName} rulesTemplate={admitRulesTemplate} />;
    }
    if (admitDesignKey === "custom" && admitCustomBg) {
      return (
        <AdmitCardCustom row={PREVIEW_ROW} rulesTemplate={admitRulesTemplate} backgroundImage={admitCustomBg} />
      );
    }
    return <AdmitCardClassic row={PREVIEW_ROW} madrasaName={madrasaName} rulesTemplate={admitRulesTemplate} />;
  };

  const renderLetterPreview = () => {
    const cfg = LETTER_CONFIG[active.key];
    if (!cfg) return null;
    return (
      <LetterDocument
        row={PREVIEW_ROW}
        showBismillah={cfg.showBismillah}
        heading={cfg.heading}
        headingClassName={cfg.headingClassName}
        bodyClassName={cfg.bodyClassName}
        template={values[active.templateKey as string] ?? ""}
        footer={cfg.footer}
        design={letterDesignKey}
        backgroundImage={letterCustomBg}
      />
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ডকুমেন্ট টেমপ্লেট"
        subtitle="আইডি কার্ড, প্রবেশপত্র, সনদ, প্রত্যয়ন পত্র, ছাড়পত্র ও পুরস্কার বই-লেবেলের লেখা ও ডিজাইন এখান থেকে সাজান"
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
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

      {designMessage && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{designMessage}</div>
      )}
      {designError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{designError}</div>}
      {admitDesignMessage && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{admitDesignMessage}</div>
      )}
      {admitDesignError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{admitDesignError}</div>
      )}
      {letterDesignMessage && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{letterDesignMessage}</div>
      )}
      {letterDesignError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{letterDesignError}</div>
      )}
      {bookLabelDesignMessage && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{bookLabelDesignMessage}</div>
      )}
      {bookLabelDesignError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{bookLabelDesignError}</div>
      )}
      {message && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
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

          {active.key === "id-card" && (
            <div className="mt-5 space-y-4">
              <p className="text-sm font-medium text-gray-700">ডিজাইন বেছে নিন</p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ID_CARD_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setDesignKey(preset.key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${designKey === preset.key ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"}`}
                  >
                    <IdCardThumb>
                      {preset.key === "classic" && (
                        <IdCardClassic row={PREVIEW_ROW} madrasaName={madrasaName} />
                      )}
                      {preset.key === "minimal" && (
                        <IdCardMinimal row={PREVIEW_ROW} madrasaName={madrasaName} />
                      )}
                      {preset.key === "arch" && <IdCardArch row={PREVIEW_ROW} madrasaName={madrasaName} />}
                    </IdCardThumb>
                    <span className="text-xs font-semibold text-slate-700">{preset.label}</span>
                  </button>
                ))}

                <div
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${designKey === "custom" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}
                >
                  {customBg ? (
                    <button type="button" onClick={() => setDesignKey("custom")}>
                      <IdCardThumb>
                        <IdCardCustom row={PREVIEW_ROW} backgroundImage={customBg} />
                      </IdCardThumb>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      style={{ width: `${54 * CARD_THUMB_SCALE}mm`, height: `${85.6 * CARD_THUMB_SCALE}mm` }}
                      className="flex items-center justify-center rounded border-2 border-dashed border-slate-300 bg-slate-50 px-2 text-center text-[9px] text-slate-400 hover:bg-slate-100"
                    >
                      নিজের ব্যাকগ্রাউন্ড ছবি আপলোড করুন
                    </button>
                  )}
                  <span className="text-xs font-semibold text-slate-700">কাস্টম</span>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="font-medium text-blue-600 underline"
                    >
                      {customBg ? "পরিবর্তন" : "আপলোড"}
                    </button>
                    {customBg && (
                      <button
                        type="button"
                        onClick={handleRemoveBackground}
                        className="font-medium text-red-500 underline"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileRef}
                    hidden
                    accept="image/png,image/jpeg"
                    onChange={handleBackgroundFile}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                কাস্টম ডিজাইনে তুমি নিজের বানানো ব্যাকগ্রাউন্ড ছবি (Canva/Photoshop-এ ডিজাইন করা)
                আপলোড করলে তার উপর শিক্ষার্থীর ছবি, নাম, রোল ইত্যাদি স্বয়ংক্রিয়ভাবে বসে যাবে।
              </p>

              <Button disabled={designSaving} onClick={handleSaveIdCardDesign}>
                {designSaving ? "সেভ হচ্ছে..." : "ডিজাইন সেভ করুন"}
              </Button>
            </div>
          )}

          {isAdmitCard && (
            <div className="mt-5 space-y-4 border-b pb-6">
              <p className="text-sm font-medium text-gray-700">ডিজাইন বেছে নিন</p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRESET_LABELS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setAdmitDesignKey(preset.key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${admitDesignKey === preset.key ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"}`}
                  >
                    <AdmitThumb>
                      {preset.key === "classic" && (
                        <AdmitCardClassic row={PREVIEW_ROW} madrasaName={madrasaName} rulesTemplate={admitRulesTemplate} />
                      )}
                      {preset.key === "minimal" && (
                        <AdmitCardMinimal row={PREVIEW_ROW} madrasaName={madrasaName} rulesTemplate={admitRulesTemplate} />
                      )}
                      {preset.key === "arch" && (
                        <AdmitCardArch row={PREVIEW_ROW} madrasaName={madrasaName} rulesTemplate={admitRulesTemplate} />
                      )}
                    </AdmitThumb>
                    <span className="text-xs font-semibold text-slate-700">{preset.label}</span>
                  </button>
                ))}

                <div
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${admitDesignKey === "custom" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}
                >
                  {admitCustomBg ? (
                    <button type="button" onClick={() => setAdmitDesignKey("custom")}>
                      <AdmitThumb>
                        <AdmitCardCustom row={PREVIEW_ROW} rulesTemplate={admitRulesTemplate} backgroundImage={admitCustomBg} />
                      </AdmitThumb>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => admitFileRef.current?.click()}
                      style={{ width: ADMIT_THUMB_BASE * ADMIT_THUMB_SCALE, height: 150 }}
                      className="flex items-center justify-center rounded border-2 border-dashed border-slate-300 bg-slate-50 px-2 text-center text-[9px] text-slate-400 hover:bg-slate-100"
                    >
                      নিজের ব্যাকগ্রাউন্ড ছবি আপলোড করুন
                    </button>
                  )}
                  <span className="text-xs font-semibold text-slate-700">কাস্টম</span>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => admitFileRef.current?.click()}
                      className="font-medium text-blue-600 underline"
                    >
                      {admitCustomBg ? "পরিবর্তন" : "আপলোড"}
                    </button>
                    {admitCustomBg && (
                      <button
                        type="button"
                        onClick={handleRemoveAdmitBackground}
                        className="font-medium text-red-500 underline"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={admitFileRef}
                    hidden
                    accept="image/png,image/jpeg"
                    onChange={handleAdmitBackgroundFile}
                  />
                </div>
              </div>

              <Button disabled={admitDesignSaving} onClick={handleSaveAdmitCardDesign}>
                {admitDesignSaving ? "সেভ হচ্ছে..." : "ডিজাইন সেভ করুন"}
              </Button>
            </div>
          )}

          {isLetterDoc && (
            <div className="mt-5 space-y-4 border-b pb-6">
              <div>
                <p className="text-sm font-medium text-gray-700">ডিজাইন বেছে নিন</p>
                <p className="text-xs text-slate-500">
                  এই ডিজাইন সনদ, প্রত্যয়ন পত্র ও ছাড়পত্র — তিনটাতেই একসাথে প্রযোজ্য হবে।
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRESET_LABELS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setLetterDesignKey(preset.key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${letterDesignKey === preset.key ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"}`}
                  >
                    <LetterThumb>
                      <LetterDocument
                        row={PREVIEW_ROW}
                        showBismillah={LETTER_CONFIG[active.key]?.showBismillah}
                        heading={LETTER_CONFIG[active.key]?.heading || ""}
                        headingClassName={LETTER_CONFIG[active.key]?.headingClassName}
                        bodyClassName={LETTER_CONFIG[active.key]?.bodyClassName}
                        template={values[active.templateKey as string] ?? ""}
                        footer={LETTER_CONFIG[active.key]?.footer}
                        design={preset.key}
                      />
                    </LetterThumb>
                    <span className="text-xs font-semibold text-slate-700">{preset.label}</span>
                  </button>
                ))}

                <div
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${letterDesignKey === "custom" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}
                >
                  {letterCustomBg ? (
                    <button type="button" onClick={() => setLetterDesignKey("custom")}>
                      <LetterThumb>
                        <LetterDocument
                          row={PREVIEW_ROW}
                          showBismillah={LETTER_CONFIG[active.key]?.showBismillah}
                          heading={LETTER_CONFIG[active.key]?.heading || ""}
                          headingClassName={LETTER_CONFIG[active.key]?.headingClassName}
                          bodyClassName={LETTER_CONFIG[active.key]?.bodyClassName}
                          template={values[active.templateKey as string] ?? ""}
                          footer={LETTER_CONFIG[active.key]?.footer}
                          design="custom"
                          backgroundImage={letterCustomBg}
                        />
                      </LetterThumb>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => letterFileRef.current?.click()}
                      style={{ width: LETTER_THUMB_BASE * LETTER_THUMB_SCALE, height: 220 }}
                      className="flex items-center justify-center rounded border-2 border-dashed border-slate-300 bg-slate-50 px-2 text-center text-[9px] text-slate-400 hover:bg-slate-100"
                    >
                      নিজের ব্যাকগ্রাউন্ড ছবি আপলোড করুন
                    </button>
                  )}
                  <span className="text-xs font-semibold text-slate-700">কাস্টম</span>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => letterFileRef.current?.click()}
                      className="font-medium text-blue-600 underline"
                    >
                      {letterCustomBg ? "পরিবর্তন" : "আপলোড"}
                    </button>
                    {letterCustomBg && (
                      <button
                        type="button"
                        onClick={handleRemoveLetterBackground}
                        className="font-medium text-red-500 underline"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={letterFileRef}
                    hidden
                    accept="image/png,image/jpeg"
                    onChange={handleLetterBackgroundFile}
                  />
                </div>
              </div>

              <Button disabled={letterDesignSaving} onClick={handleSaveLetterDesign}>
                {letterDesignSaving ? "সেভ হচ্ছে..." : "ডিজাইন সেভ করুন"}
              </Button>
            </div>
          )}

          {active.key === "book-label" && (
            <div className="mt-5 space-y-4">
              <p className="text-sm font-medium text-gray-700">ডিজাইন বেছে নিন</p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRESET_LABELS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setBookLabelDesignKey(preset.key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${bookLabelDesignKey === preset.key ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"}`}
                  >
                    <BookLabelThumb>
                      {preset.key === "classic" && (
                        <BookLabelClassic row={PREVIEW_ROW} madrasaName={madrasaName} />
                      )}
                      {preset.key === "minimal" && (
                        <BookLabelMinimal row={PREVIEW_ROW} madrasaName={madrasaName} />
                      )}
                      {preset.key === "arch" && (
                        <BookLabelArch row={PREVIEW_ROW} madrasaName={madrasaName} />
                      )}
                    </BookLabelThumb>
                    <span className="text-xs font-semibold text-slate-700">{preset.label}</span>
                  </button>
                ))}

                <div
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${bookLabelDesignKey === "custom" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}
                >
                  {bookLabelCustomBg ? (
                    <button type="button" onClick={() => setBookLabelDesignKey("custom")}>
                      <BookLabelThumb>
                        <BookLabelCustom row={PREVIEW_ROW} backgroundImage={bookLabelCustomBg} />
                      </BookLabelThumb>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => bookLabelFileRef.current?.click()}
                      style={{ width: `${92 * BOOK_LABEL_THUMB_SCALE}mm`, height: `${58 * BOOK_LABEL_THUMB_SCALE}mm` }}
                      className="flex items-center justify-center rounded border-2 border-dashed border-slate-300 bg-slate-50 px-2 text-center text-[9px] text-slate-400 hover:bg-slate-100"
                    >
                      নিজের ব্যাকগ্রাউন্ড ছবি আপলোড করুন
                    </button>
                  )}
                  <span className="text-xs font-semibold text-slate-700">কাস্টম</span>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => bookLabelFileRef.current?.click()}
                      className="font-medium text-blue-600 underline"
                    >
                      {bookLabelCustomBg ? "পরিবর্তন" : "আপলোড"}
                    </button>
                    {bookLabelCustomBg && (
                      <button
                        type="button"
                        onClick={handleRemoveBookLabelBackground}
                        className="font-medium text-red-500 underline"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={bookLabelFileRef}
                    hidden
                    accept="image/png,image/jpeg"
                    onChange={handleBookLabelBackgroundFile}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                কাস্টম ডিজাইনে তুমি নিজের বানানো ব্যাকগ্রাউন্ড ছবি (Canva/Photoshop-এ ডিজাইন করা)
                আপলোড করলে তার উপর শিক্ষার্থীর নাম, মেধাক্রম, রোল ইত্যাদি স্বয়ংক্রিয়ভাবে বসে যাবে।
              </p>

              <Button disabled={bookLabelDesignSaving} onClick={handleSaveBookLabelDesign}>
                {bookLabelDesignSaving ? "সেভ হচ্ছে..." : "ডিজাইন সেভ করুন"}
              </Button>
            </div>
          )}

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
            active.key !== "id-card" &&
            active.key !== "book-label" && (
              <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                এই ডকুমেন্টে এডিট করার মতো কোনো বাক্য নেই — এটি শুধু শিক্ষার্থীর তথ্য দেখায়।
              </div>
            )
          )}
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            প্রিভিউ (নমুনা তথ্য দিয়ে)
          </p>

          {active.key === "id-card" && (
            <div className="flex justify-center rounded-xl bg-slate-100 p-6">{renderIdCardPreview()}</div>
          )}
          {isAdmitCard && (
            <div className="flex justify-center overflow-auto rounded-xl bg-slate-100 p-6">
              <div style={{ width: 420 }}>{renderAdmitCardPreview()}</div>
            </div>
          )}
          {isLetterDoc && (
            <div className="flex justify-center overflow-auto rounded-xl bg-slate-100 p-6">
              <div style={{ width: 420 }}>{renderLetterPreview()}</div>
            </div>
          )}
          {active.key === "book-label" && (
            <div className="flex justify-center overflow-auto rounded-xl bg-slate-100 p-6">
              {renderBookLabelPreview()}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
