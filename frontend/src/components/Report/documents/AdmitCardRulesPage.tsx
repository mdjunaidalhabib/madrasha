import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import { useLetterDesign } from "./engine/useLetterDesign";
import LetterDocument from "./engine/LetterDocument";
import { DEFAULT_ADMIT_CARD_RULES } from "../../../utils/documentTemplates";

type AdmitCardRulesPageProps = {
  rows: Record<string, any>[];
};

/**
 * Appended once after every student's admit-card page (see
 * PaginatedReportPreview's grid pagination for "admit-card") - shares the
 * admin-editable admit_card_rules template/tokens and letter design/frame
 * with the other letter-style documents instead of hardcoding its own look.
 */
const AdmitCardRulesPage = ({ rows }: AdmitCardRulesPageProps) => {
  const template = useDocumentTemplate("admit_card_rules", DEFAULT_ADMIT_CARD_RULES);
  const { design, backgroundImage } = useLetterDesign();
  const row = rows[0] || {};

  return (
    <LetterDocument
      row={row}
      showBismillah
      heading="পরীক্ষার নিয়মাবলী"
      headingClassName="mb-8 text-center text-2xl font-bold"
      bodyClassName="whitespace-pre-line text-lg leading-9 text-slate-800"
      template={template}
      design={design}
      backgroundImage={backgroundImage}
      footer={
        <div className="mt-16 flex justify-between text-sm font-semibold">
          <span>পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</span>
          <span>প্রধান শিক্ষকের স্বাক্ষর</span>
        </div>
      }
    />
  );
};

export default AdmitCardRulesPage;
