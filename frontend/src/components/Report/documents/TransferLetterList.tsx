import { useEffect, useState } from "react";
import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import { useLetterDesign } from "./engine/useLetterDesign";
import LetterDocument from "./engine/LetterDocument";
import DocumentPreview from "../../DocumentDesigner/DocumentPreview";
import { useDocumentTemplateDefaultStore } from "../../../store/documentTemplateDefaultStore";
import { DEFAULT_TRANSFER_LETTER_TEMPLATE } from "../../../utils/documentTemplates";
import { getTemplate, type TemplateDetailDto } from "../../../services/documentTemplateLibraryApi";

type TransferLetterListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  bodyTextOverride?: string;
  // Explicit non-default published template chosen from the Reports screen
  // (ReportFilterBar) - when set, overrides the tenant's effective default
  // fetched below. Null/undefined keeps today's default-lookup behaviour.
  templateId?: number | null;
};

const TransferLetterList = ({
  rows,
  isFirstPage = true,
  isLastPage = true,
  bodyTextOverride,
  templateId,
}: TransferLetterListProps) => {
  const template = useDocumentTemplate("transfer_letter_template", DEFAULT_TRANSFER_LETTER_TEMPLATE);
  const { design, backgroundImage } = useLetterDesign();
  const row = rows[0] || {};

  const defaultDocTemplate = useDocumentTemplateDefaultStore((s) => s.defaults.CLEARANCE_CERTIFICATE);
  const defaultDocTemplateLoaded = useDocumentTemplateDefaultStore((s) => s.loaded.CLEARANCE_CERTIFICATE);
  const fetchDefault = useDocumentTemplateDefaultStore((s) => s.fetchDefault);
  const [overrideTemplate, setOverrideTemplate] = useState<TemplateDetailDto | null>(null);
  const [overrideLoaded, setOverrideLoaded] = useState(false);

  useEffect(() => {
    fetchDefault("CLEARANCE_CERTIFICATE");
  }, [fetchDefault]);

  useEffect(() => {
    if (!templateId) {
      setOverrideTemplate(null);
      setOverrideLoaded(false);
      return;
    }

    let cancelled = false;
    setOverrideLoaded(false);
    getTemplate(templateId)
      .then((detail) => {
        if (!cancelled) {
          setOverrideTemplate(detail);
          setOverrideLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOverrideTemplate(null);
          setOverrideLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const docTemplate = templateId ? overrideTemplate : defaultDocTemplate;
  const docTemplateLoaded = templateId ? overrideLoaded : defaultDocTemplateLoaded;
  const version = docTemplate?.published || docTemplate?.draft;

  if (version) {
    return (
      <DocumentPreview
        className="print-page-break"
        layout={{
          id: String(docTemplate!.id),
          kind: "transfer-letter",
          width: version.width,
          height: version.height,
          background: version.background || undefined,
          layers: version.layers,
        }}
        row={row}
      />
    );
  }

  // Not yet resolved (still loading) - render nothing this pass rather than
  // flashing the fallback layout, PaginatedReportPreview re-measures once
  // `loaded` flips.
  if (!docTemplateLoaded) return null;

  return (
    <LetterDocument
      row={row}
      showBismillah
      heading="ছাড়পত্র"
      template={template}
      design={design}
      backgroundImage={backgroundImage}
      isFirstPage={isFirstPage}
      isLastPage={isLastPage}
      bodyTextOverride={bodyTextOverride}
      footer={
        <div className="mt-16 flex justify-between text-sm font-semibold">
          <span>তারিখ: ........................</span>
          <span>প্রধান শিক্ষকের স্বাক্ষর ও সীল</span>
        </div>
      }
    />
  );
};

export default TransferLetterList;
