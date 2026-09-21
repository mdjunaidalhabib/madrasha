import { Link } from "react-router-dom";
import LetterDocument from "./engine/LetterDocument";
import { LETTER_BODY_CLASS, LETTER_HEADING_CLASS, LetterDateLine, LetterSignatureFooter } from "./engine/letterParts";
import { useNoticeBoardReportStore } from "../../../store/noticeBoardReportStore";

type NoticeBoardReportViewProps = {
  rows: Record<string, any>[];
};

/**
 * Renders inline in the "ডকুমেন্ট সমূহ" report module, same as
 * Sanad/Testimonial/AdmitCardRulesPage - the `rows` prop is ignored (see
 * printableConfig's "notice-board" -> "single" kind). Which saved notice
 * (backend/src/modules/notices) is on display is picked from the report's
 * top filter bar (NoticeBoardPicker in ReportFilterBar), which also loads the
 * list into noticeBoardReportStore; this component just shows the selection.
 * The page's usual print button (DataExportPrintActions in the toolbar) then
 * prints whichever one is selected, like any other document type here.
 */
const NoticeBoardReportView = ({ rows: _rows }: NoticeBoardReportViewProps) => {
  const notices = useNoticeBoardReportStore((s) => s.notices);
  const selectedId = useNoticeBoardReportStore((s) => s.selectedId);

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

  if (!selected) return null;

  return (
    <LetterDocument
      row={{}}
      heading={selected.title}
      headingClassName={LETTER_HEADING_CLASS}
      bodyClassName={LETTER_BODY_CLASS}
      template={selected.body}
      bare
      beforeHeading={
        <>
          {/* মাদরাসার নাম-ঠিকানার হেডারের নিচের দাগ - -mx-12 দিয়ে লেখার পাশের মার্জিন ছাড়িয়ে হেডারের পুরো প্রস্থে টানা। */}
          <div className="-mx-12 mb-3 border-b-2 border-black" />
          <LetterDateLine />
        </>
      }
      footer={<LetterSignatureFooter label="প্রধান শিক্ষকের স্বাক্ষর ও সীল" />}
    />
  );
};

export default NoticeBoardReportView;
