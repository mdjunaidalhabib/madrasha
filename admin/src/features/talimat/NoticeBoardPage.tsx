import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Printer, X } from "lucide-react";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { localizeDigits, useLang, usePrintLang, usePrintText, useText, type Lang } from "@madrasha/shared-ui/src/i18n";
import { noticeText } from "./talimatMisc.text";
import { noticeApi, type NoticeDto } from "../../services/noticeApi";
import { ReportBackground, ReportBrandHeader, ReportWatermark } from "../../components/Report/ReportBranding";
import LetterDocument from "../../components/Report/documents/engine/LetterDocument";
import { useLetterDesign } from "../../components/Report/documents/engine/useLetterDesign";

// নোটিশ বোর্ড — একাধিক ওয়াল-নোটিশ সেভ করে রাখা ও দরকারমতো প্রিন্ট করার জন্য।
// Replaces the old single custom_notice_template (Talimat's সেটিং >
// ডকুমেন্টস টেমপ্লেট > নোটিশ tab) which could only hold ONE notice at a
// time — writing a new one silently overwrote the last. Each notice here is
// its own row (see backend/src/modules/notices), so any number can be kept
// around and reprinted later. Every notice renders through the same
// LetterDocument shell + ReportBrandHeader used by Sanad/Testimonial/
// Transfer Letter, so it automatically carries the madrasa's logo, name and
// address — no more blank preview / missing letterhead.

const formatDate = (iso: string, lang: Lang) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return localizeDigits(`${dd}/${mm}/${d.getFullYear()}`, lang);
};

const NOTICE_PRINT_STYLE_ID = "notice-board-a4-print-style";

const printNotice = () => {
  const style = document.createElement("style");
  style.id = NOTICE_PRINT_STYLE_ID;
  style.textContent = "@media print { @page { size: A4; margin: 0.6in; } }";
  document.head.appendChild(style);

  const cleanup = () => {
    document.getElementById(NOTICE_PRINT_STYLE_ID)?.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
};

function NoticeLetter({ title, body }: { title: string; body: string }) {
  const { design, backgroundImage } = useLetterDesign();
  // Printed notice follows the institution's default language.
  const pt = usePrintText(noticeText);
  const { lang, dir } = usePrintLang();
  return (
    // Card border/rounding/padding live on this OUTER wrapper only, for the
    // on-screen preview look - they must never sit on the .print-area div
    // itself, or the print CSS (which pulls .print-area out with
    // position:absolute but does not touch border/background) would print
    // that border and card background onto the actual page. The printed
    // page should be a plain white sheet, same as Sanad/Testimonial.
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
      <div lang={lang} dir={dir} className="print-area relative">
        <ReportBackground />
        <ReportWatermark />
        <ReportBrandHeader />
        <div className="report-content-body relative">
          <LetterDocument
            row={{}}
            showBismillah
            heading={title || pt.notice}
            headingClassName="mb-8 text-center text-2xl font-bold"
            bodyClassName="whitespace-pre-line text-lg leading-9 text-slate-800"
            template={body}
            design={design}
            backgroundImage={backgroundImage}
            footer={
              <div className="mt-16 flex justify-between text-sm font-semibold">
                <span>{pt.dateLine}</span>
                <span>{pt.headSignature}</span>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

type EditorState = { id: number | null; title: string; body: string };

const EMPTY_EDITOR: EditorState = { id: null, title: "", body: "" };

export default function NoticeBoardPage() {
  const t = useText(noticeText);
  const lang = useLang();
  const [notices, setNotices] = useState<NoticeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [printingNotice, setPrintingNotice] = useState<NoticeDto | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadNotices = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await noticeApi.list();
      setNotices(res.data?.data || []);
    } catch {
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const openNewEditor = () => {
    setSaveError("");
    setEditor({ ...EMPTY_EDITOR });
  };

  const openEditEditor = (notice: NoticeDto) => {
    setSaveError("");
    setEditor({ id: notice.id, title: notice.title, body: notice.body });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
  };

  const handleSave = async () => {
    if (!editor) return;
    const title = editor.title.trim();
    const body = editor.body.trim();
    if (!title || !body) {
      setSaveError(t.bothRequired);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      if (editor.id) {
        await noticeApi.update(editor.id, { title, body });
      } else {
        await noticeApi.create({ title, body });
      }
      setEditor(null);
      await loadNotices();
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (notice: NoticeDto) => {
    if (!window.confirm(t.confirmDelete(notice.title))) return;
    setDeletingId(notice.id);
    try {
      await noticeApi.delete(notice.id);
      setNotices((prev) => prev.filter((n) => n.id !== notice.id));
    } catch {
      window.alert(t.deleteError);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Button onClick={openNewEditor}>
            <Plus size={16} className="me-1 inline" /> {t.newNotice}
          </Button>
        }
      />

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
          {error}
        </div>
      )}

      {!loading && !error && notices.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {t.empty}
        </div>
      )}

      {!loading && !error && notices.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="flex flex-col rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <h3 className="line-clamp-1 text-base font-bold text-slate-800 dark:text-slate-100">
                {notice.title}
              </h3>
              <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">
                {notice.body}
              </p>
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                {t.lastUpdated(formatDate(notice.updatedAt, lang))}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setPrintingNotice(notice)}>
                  <Printer size={14} className="me-1 inline" /> {t.previewPrint}
                </Button>
                <Button variant="secondary" onClick={() => openEditEditor(notice)}>
                  <Pencil size={14} className="me-1 inline" /> {t.edit}
                </Button>
                <Button
                  variant="danger"
                  disabled={deletingId === notice.id}
                  onClick={() => handleDelete(notice)}
                >
                  <Trash2 size={14} className="me-1 inline" />
                  {deletingId === notice.id ? t.deleting : t.delete}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* এডিটর: শিরোনাম + লেখা, পাশে লেটারহেড-সহ লাইভ প্রিভিউ */}
      <Modal
        open={!!editor}
        title={editor?.id ? t.editNotice : t.writeNotice}
        onClose={closeEditor}
        maxWidthClassName="max-w-4xl"
      >
        {editor && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">{t.noticeTitle}</label>
                <input
                  type="text"
                  value={editor.title}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  placeholder={t.titlePlaceholder}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">{t.noticeBody}</label>
                <textarea
                  value={editor.body}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, body: e.target.value } : prev))}
                  rows={12}
                  placeholder={t.bodyPlaceholder}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm leading-6 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {saveError && <p className="text-sm text-rose-600 dark:text-rose-400">{saveError}</p>}

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={closeEditor} disabled={saving}>
                  <X size={14} className="me-1 inline" /> {t.cancel}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? t.saving : t.save}
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {t.preview}
              </p>
              <div className="overflow-auto rounded-xl bg-slate-100 p-4" style={{ maxHeight: 520 }}>
                <div style={{ width: 420 }}>
                  <NoticeLetter title={editor.title || t.notice} body={editor.body} />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* প্রিভিউ / প্রিন্ট মোডাল */}
      <Modal
        open={!!printingNotice}
        title={t.printPreview}
        onClose={() => setPrintingNotice(null)}
        maxWidthClassName="max-w-lg"
      >
        {printingNotice && (
          <>
            <NoticeLetter title={printingNotice.title} body={printingNotice.body} />
            <div className="no-print mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPrintingNotice(null)}>
                {t.close}
              </Button>
              <Button onClick={printNotice}>
                <Printer size={16} className="me-1 inline" /> {t.print}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
