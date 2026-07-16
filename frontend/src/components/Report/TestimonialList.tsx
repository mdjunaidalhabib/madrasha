import { useEffect } from "react";
import { useDocumentTemplateStore } from "../../store/documentTemplateStore";
import { DEFAULT_TESTIMONIAL_TEMPLATE, renderTemplateText } from "../../utils/documentTemplates";

type TestimonialListProps = {
  rows: Record<string, any>[];
};

const TestimonialList = ({ rows }: TestimonialListProps) => {
  const templates = useDocumentTemplateStore((s) => s.templates);
  const fetchTemplates = useDocumentTemplateStore((s) => s.fetchTemplates);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const template = templates?.testimonial_template || DEFAULT_TESTIMONIAL_TEMPLATE;

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div
          key={`certificate-${row.id || index}`}
          className="print-page-break rounded-xl border-2 border-slate-800 bg-white p-8"
        >
          <h3 className="mb-8 text-center text-2xl font-bold">প্রত্যয়ন পত্র</h3>

          <p className="whitespace-pre-line text-lg leading-9 text-slate-800">
            {renderTemplateText(template, row)}
          </p>

          <div className="mt-16 text-right text-sm font-semibold">প্রধান শিক্ষকের স্বাক্ষর</div>
        </div>
      ))}
    </div>
  );
};

export default TestimonialList;
