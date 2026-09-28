import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Link2,
  Linkedin,
  MessageCircle,
  Music2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Twitter,
  UserRound,
  Users,
  Youtube,
} from "lucide-react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { commonText, useText } from "@madrasha/shared-ui/src/i18n";
import { settingsUiText } from "./settingsUi.text";
import {
  MAX_SOCIAL_LINKS,
  SOCIAL_LINK_TYPES,
  type SocialLinkItem,
  type SocialLinkType,
} from "../../services/brandingApi";
import { servicesText } from "../../services/services.text";

const TYPE_ICONS: Record<SocialLinkType, ReactNode> = {
  whatsapp: <MessageCircle size={15} />,
  facebook_page: <Facebook size={15} />,
  facebook_profile: <UserRound size={15} />,
  facebook_group: <Users size={15} />,
  youtube: <Youtube size={15} />,
  instagram: <Instagram size={15} />,
  telegram: <Send size={15} />,
  tiktok: <Music2 size={15} />,
  x: <Twitter size={15} />,
  linkedin: <Linkedin size={15} />,
  website: <Globe size={15} />,
  other: <Link2 size={15} />,
};

const TYPE_COLORS: Record<SocialLinkType, string> = {
  whatsapp: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
  facebook_page: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  facebook_profile: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  facebook_group: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  youtube: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  instagram: "bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400",
  telegram: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400",
  tiktok: "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200",
  x: "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200",
  linkedin: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  website: "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
  other: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300",
};

const PLACEHOLDERS: Record<SocialLinkType, string> = {
  whatsapp: "01712345678 / +8801712345678",
  facebook_page: "https://facebook.com/yourpage",
  facebook_profile: "https://facebook.com/profile.php?id=...",
  facebook_group: "https://facebook.com/groups/...",
  youtube: "https://youtube.com/@yourchannel",
  instagram: "https://instagram.com/yourname",
  telegram: "https://t.me/yourchannel",
  tiktok: "https://tiktok.com/@yourname",
  x: "https://x.com/yourname",
  linkedin: "https://linkedin.com/in/yourname",
  website: "https://example.com",
  other: "",
};

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

/** WhatsApp নম্বর → wa.me লিংক (বাংলাদেশি 01... নম্বরে 88 যোগ হয়)। */
function whatsappHref(number: string) {
  let digits = toAsciiDigits(number).replace(/\D/g, "");
  if (digits.startsWith("01") && digits.length === 11) digits = `88${digits}`;
  return `https://wa.me/${digits}`;
}

export function socialLinkHref(link: SocialLinkItem) {
  return link.type === "whatsapp" ? whatsappHref(link.value) : link.value;
}

function validate(link: SocialLinkItem): "invalidWhatsapp" | "invalidLink" | null {
  const value = link.value.trim();
  if (!value) return null;
  if (link.type === "whatsapp") {
    return /^\+?[0-9০-৯][0-9০-৯\s-]{5,19}$/.test(value) ? null : "invalidWhatsapp";
  }
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return /^https?:\/\/[^\s]+\.[^\s]+/i.test(withScheme) ? null : "invalidLink";
}

const emptyRow = (type: SocialLinkType = "whatsapp"): SocialLinkItem => ({ type, label: "", value: "" });

/**
 * InlineListField-এর মতোই read-only/ক্লিক-করে-এডিট প্যাটার্ন, তবে প্রতিটি সারিতে
 * ধরন (WhatsApp/Facebook পেজ/YouTube…), ঐচ্ছিক নাম আর নম্বর/লিংক থাকে - একই ধরনের
 * একাধিক এন্ট্রি (যেমন কয়েকটি WhatsApp নম্বর) দেওয়া যায়।
 */
export default function InlineSocialLinksField({
  values,
  onSave,
}: {
  values: SocialLinkItem[];
  onSave: (values: SocialLinkItem[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SocialLinkItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const tx = useText(settingsUiText);
  const c = useText(commonText);
  const typeLabels = useText(servicesText).socialLinkTypes;
  const placeholderFor = (type: SocialLinkType) =>
    PLACEHOLDERS[type] ? tx.example(PLACEHOLDERS[type]) : tx.anyLink;

  const startEdit = () => {
    setDraft(values.length ? values.map((v) => ({ ...v, label: v.label ?? "" })) : [emptyRow()]);
    setShowErrors(false);
    setEditing(true);
  };

  const updateAt = (index: number, patch: Partial<SocialLinkItem>) => {
    setDraft((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeAt = (index: number) => setDraft((prev) => prev.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addRow = (type?: SocialLinkType) =>
    setDraft((prev) => (prev.length >= MAX_SOCIAL_LINKS ? prev : [...prev, emptyRow(type)]));

  const save = async () => {
    if (draft.some((l) => validate(l))) {
      setShowErrors(true);
      return;
    }
    const cleaned = draft
      .map((l) => {
        const value = l.value.trim();
        // Same normalization the backend applies, so the saved list shows as-is.
        const normalized = !value || l.type === "whatsapp" || /^https?:\/\//i.test(value) ? value : `https://${value}`;
        return { type: l.type, label: l.label?.trim() || null, value: normalized };
      })
      .filter((l) => l.value);
    setSaving(true);
    try {
      await onSave(cleaned);
      setEditing(false);
    } catch {
      // error toast already shown by onSave — stay in edit mode so the user can retry
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="group flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{tx.socialLinks}</p>
          {values.length ? (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {values.map((link, i) => (
                <a
                  key={i}
                  href={socialLinkHref(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2 transition hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-900"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TYPE_COLORS[link.type]}`}
                  >
                    {TYPE_ICONS[link.type]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                      {link.label || typeLabels[link.type]}
                    </span>
                    <span className="block truncate text-xs text-gray-500 dark:text-slate-400">{link.value}</span>
                  </span>
                  <ExternalLink size={13} className="shrink-0 text-gray-300 dark:text-slate-600" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-0.5 text-sm text-gray-400 dark:text-slate-500">{tx.notAdded}</p>
          )}
        </div>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 opacity-100 transition hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 sm:opacity-0 sm:group-hover:opacity-100"
          title={tx.editTitle}
        >
          <Pencil size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
      <p className="mb-1 text-xs font-medium text-gray-500 dark:text-slate-400">{tx.socialLinks}</p>
      <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
        {tx.socialLinksHint}
      </p>

      <div className="space-y-2">
        {draft.map((link, index) => {
          const error = showErrors ? validate(link) : null;
          return (
            <div
              key={index}
              className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 sm:w-52 sm:shrink-0">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_COLORS[link.type]}`}
                  >
                    {TYPE_ICONS[link.type]}
                  </span>
                  <select
                    value={link.type}
                    onChange={(e) => updateAt(index, { type: e.target.value as SocialLinkType })}
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {SOCIAL_LINK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {typeLabels[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:w-40 sm:shrink-0">
                  <Input
                    value={link.label ?? ""}
                    onChange={(e) => updateAt(index, { label: e.target.value })}
                    placeholder={tx.nameOptional}
                    maxLength={80}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    type={link.type === "whatsapp" ? "tel" : "url"}
                    value={link.value}
                    invalid={!!error}
                    onChange={(e) => updateAt(index, { value: e.target.value })}
                    placeholder={placeholderFor(link.type)}
                    maxLength={500}
                  />
                </div>
                <div className="flex shrink-0 items-center justify-end gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:bg-slate-800"
                    title={tx.moveUp}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === draft.length - 1}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:bg-slate-800"
                    title={tx.moveDown}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    title={c.delete}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{tx[error]}</p>}
            </div>
          );
        })}
      </div>

      {draft.length < MAX_SOCIAL_LINKS && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addRow()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <Plus size={13} /> {tx.addAnother}
          </button>
          <span className="text-xs text-gray-300 dark:text-slate-600">|</span>
          {(["whatsapp", "facebook_page", "youtube"] as SocialLinkType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addRow(t)}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <Plus size={11} /> {typeLabels[t]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={saving} onClick={() => setEditing(false)}>
          {c.cancel}
        </Button>
        <Button type="button" disabled={saving} onClick={save}>
          {saving ? c.saving : c.save}
        </Button>
      </div>
    </div>
  );
}
