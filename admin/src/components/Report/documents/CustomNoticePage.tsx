import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import { useLetterDesign } from "./engine/useLetterDesign";
import LetterDocument from "./engine/LetterDocument";
import { DEFAULT_CUSTOM_NOTICE } from "@madrasha/shared-ui/src/utils/documentTemplates";

type CustomNoticePageProps = {
  rows: Record<string, any>[];
};

/**
 * A single, ad-hoc printable notice page — staff write free text in
 * Talimat's "নোটিশ" template editor (see TalimatDocumentsPage), then print
 * this page (with the madrasa's letterhead) to post physically on the
 * notice board. Shares the same letter design/frame as the other
 * letter-style documents (Sanad/Testimonial/Transfer/admit-card-rules)
 * instead of hardcoding its own look. Only one current notice is kept —
 * writing a new one overwrites the last, there's no history.
 */
const CustomNoticePage = ({ rows }: CustomNoticePageProps) => {
  const template = useDocumentTemplate("custom_notice_template", DEFAULT_CUSTOM_NOTICE);
  const { design, backgroundImage } = useLetterDesign();
  const row = rows[0] || {};

  return (
    <LetterDocument
      row={row}
      showBismillah
      heading="নোটিশ"
      headingClassName="mb-8 text-center text-2xl font-bold"
      bodyClassName="whitespace-pre-line text-lg leading-9 text-slate-800"
      template={template}
      design={design}
      backgroundImage={backgroundImage}
      footer={
        <div className="mt-16 flex justify-between text-sm font-semibold">
          <span>তারিখ: ........................</span>
          <span>প্রধান শিক্ষকের স্বাক্ষর ও সীল</span>
        </div>
      }
    />
  );
};

export default CustomNoticePage;
