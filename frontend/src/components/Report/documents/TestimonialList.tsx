import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import { useLetterDesign } from "./engine/useLetterDesign";
import LetterDocument from "./engine/LetterDocument";
import { DEFAULT_TESTIMONIAL_TEMPLATE } from "../../../utils/documentTemplates";

type TestimonialListProps = {
  rows: Record<string, any>[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  bodyTextOverride?: string;
};

const TestimonialList = ({
  rows,
  isFirstPage = true,
  isLastPage = true,
  bodyTextOverride,
}: TestimonialListProps) => {
  const template = useDocumentTemplate("testimonial_template", DEFAULT_TESTIMONIAL_TEMPLATE);
  const { design, backgroundImage } = useLetterDesign();
  const row = rows[0] || {};

  return (
    <LetterDocument
      row={row}
      heading="প্রত্যয়ন পত্র"
      headingClassName="mb-8 text-center text-2xl font-bold"
      bodyClassName="whitespace-pre-line text-lg leading-9 text-slate-800"
      template={template}
      design={design}
      backgroundImage={backgroundImage}
      isFirstPage={isFirstPage}
      isLastPage={isLastPage}
      bodyTextOverride={bodyTextOverride}
      footer={<div className="mt-16 text-right text-sm font-semibold">প্রধান শিক্ষকের স্বাক্ষর</div>}
    />
  );
};

export default TestimonialList;
