import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import LetterDocument from "./engine/LetterDocument";
import { useLetterDesign } from "./engine/useLetterDesign";
import { noticeApi, type NoticeDto } from "../../../services/noticeApi";

type NoticeBoardReportViewProps = {
  rows: Record<string, any>[];
};

/**
 * Renders inline in the "ডকুমেন্ট সমূহ" report module, same as
 * Sanad/Testimonial/AdmitCardRulesPage - the `rows` prop is ignored (see
 * printableConfig's "notice-board" -> "single" kind); this component fetches
 * its own list of saved notices (backend/src/modules/notices) and lets the
 * user pick which one is on display. The page's usual print button
 * (DataExportPrintActions in the toolbar) then prints whichever one is
 * selected, exactly like it prints any other document type here.
 */
const NoticeBoardReportView = ({ rows: _rows }: NoticeBoardReportViewProps) => {
  const { design, backgroundImage } = useLetterDesign();
  const [notices, setNotices] = useState<NoticeDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    noticeApi
      .list()
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data || [];
        setNotices(list);
        setSelectedId(list[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setNotices([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = notices?.find((n) => n.id === selectedId) || null;

  if (notices === null) {
    return <p className="py-10 text-center text-sm text-slate-400">লোড হচ্ছে...</p>;
  }

  if (notices.length === 0) {
    return (
      <div className="no-print py-10 text-center text-sm text-slate-500">
        এখনো কোনো নোটিশ তৈরি করা হয়নি।{" "}
        <Link to="/talimat/settings/notices" className="font-semibold text-blue-700 underline">
          এখান থেকে প্রথম নোটিশটি লিখুন
        </Link>
        ।
      </div>
    );
  }

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">নোটিশ বাছাই করুন:</label>
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          className="rounded-md border px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {notices.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
        <Link
          to="/talimat/settings/notices"
          className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
        >
          <Settings2 size={14} /> নতুন/এডিট/ডিলিট করুন
        </Link>
      </div>

      {selected && (
        <LetterDocument
          row={{}}
          showBismillah
          heading={selected.title}
          headingClassName="mb-8 text-center text-2xl font-bold"
          bodyClassName="whitespace-pre-line text-lg leading-9 text-slate-800"
          template={selected.body}
          design={design}
          backgroundImage={backgroundImage}
          footer={
            <div className="mt-16 flex justify-between text-sm font-semibold">
              <span>তারিখ: ........................</span>
              <span>প্রধান শিক্ষকের স্বাক্ষর ও সীল</span>
            </div>
          }
        />
      )}
    </div>
  );
};

export default NoticeBoardReportView;
