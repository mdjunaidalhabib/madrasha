import type { ReactNode } from "react";
import { useMemo } from "react";
import type { BackendDocumentType } from "@madrasha/shared-ui/src/components/DocumentDesigner/documentTypeMap";
import { withBodyTemplate } from "@madrasha/shared-ui/src/components/DocumentDesigner/builtin/registry";
import { FittedCanvas } from "./CardSheet";
import { useBrandedRows, useDocumentLayout } from "./useDocumentLayout";

type TemplatedLetterProps = {
  type: BackendDocumentType;
  /** পজিটিভ = DB টেমপ্লেট, নেগেটিভ = বিল্ট-ইন ডিজাইন, null = ডিফল্ট (সাধারণ)। */
  templateId?: number | null;
  row: Record<string, any>;
  /** অ্যাডমিনের সেট করা wording টেমপ্লেট (sanad_template ইত্যাদি) - ডিজাইনের BODY লেয়ারে বসে। */
  bodyTemplate: string;
  /** কোনো ডিজাইন নির্বাচিত না থাকলে (ডিফল্ট) যেটা দেখাবে - সাধারণ রিপোর্ট-ধাঁচের পাতা। */
  fallback: ReactNode;
};

/**
 * সনদ / প্রত্যয়ন পত্র / ছাড়পত্র / মার্কশিটের সাধারণ রেন্ডার-নিয়ম:
 *   - কোনো ডিজাইন নির্বাচিত নেই → `fallback` (সাধারণ রিপোর্ট-ধাঁচের ডিজাইন);
 *   - ডিজাইন নির্বাচিত → সেই টেমপ্লেট, পাতার মাপে আঁটিয়ে।
 */
const TemplatedLetter = ({ type, templateId, row, bodyTemplate, fallback }: TemplatedLetterProps) => {
  const { layout, loaded } = useDocumentLayout(type, templateId);
  const [brandedRow] = useBrandedRows([row]);

  const layers = useMemo(
    () => (layout ? withBodyTemplate(layout.layers, bodyTemplate) : null),
    [layout, bodyTemplate],
  );

  if (!loaded) return null;
  if (!layout || !layers) return <>{fallback}</>;

  return <FittedCanvas layout={{ ...layout, layers }} row={brandedRow} />;
};

export default TemplatedLetter;
