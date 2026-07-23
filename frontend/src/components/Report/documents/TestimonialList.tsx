import { useDocumentTemplate } from "./engine/useDocumentTemplate";
import LetterDocument from "./engine/LetterDocument";
import { DEFAULT_TESTIMONIAL_TEMPLATE } from "../../../utils/documentTemplates";

type TestimonialListProps = {
  rows: Record<string, any>[];
};

const TestimonialList = ({ rows }: TestimonialListProps) => {
  const template = useDocumentTemplate("testimonial_template", DEFAULT_TESTIMONIAL_TEMPLATE);

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <LetterDocument
          key={`certificate-${row.id || index}`}
          row={row}
          heading="প্রত্যয়ন পত্র"
          headingClassName="mb-8 text-center text-2xl font-bold"
          bodyClassName="whitespace-pre-line text-lg leading-9 text-slate-800"
          template={template}
          footer={
            <div className="mt-16 text-right text-sm font-semibold">প্রধান শিক্ষকের স্বাক্ষর</div>
          }
        />
      ))}
    </div>
  );
};

export default TestimonialList;
