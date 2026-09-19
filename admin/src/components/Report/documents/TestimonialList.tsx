import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import LetterDocument from "./engine/LetterDocument";
import TemplatedLetter from "./engine/TemplatedLetter";
import { DEFAULT_TESTIMONIAL_TEMPLATE } from "@madrasha/shared-ui/src/utils/documentTemplates";

type TestimonialListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  bodyTextOverride?: string;
  // Explicit design chosen from the Reports screen (ReportFilterBar) -
  // positive = DB template, negative = built-in design. Null/undefined =
  // the plain default (ordinary report-style page).
  templateId?: number | null;
};

const TestimonialList = ({
  rows,
  isFirstPage = true,
  isLastPage = true,
  bodyTextOverride,
  templateId,
}: TestimonialListProps) => {
  const template = useDocumentTemplate("testimonial_template", DEFAULT_TESTIMONIAL_TEMPLATE);
  const row = rows[0] || {};

  return (
    <TemplatedLetter
      type="TESTIMONIAL"
      templateId={templateId}
      row={row}
      bodyTemplate={template}
      fallback={
        <LetterDocument
          row={row}
          heading="প্রত্যয়ন পত্র"
          headingClassName="mb-8 text-center text-2xl font-bold"
          bodyClassName="whitespace-pre-line text-lg leading-9 text-slate-800"
          template={template}
          isFirstPage={isFirstPage}
          isLastPage={isLastPage}
          bodyTextOverride={bodyTextOverride}
          footer={<div className="mt-16 text-right text-sm font-semibold">প্রধান শিক্ষকের স্বাক্ষর</div>}
        />
      }
    />
  );
};

export default TestimonialList;
