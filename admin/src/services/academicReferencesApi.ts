import { cachedGet } from "./api";

export interface AcademicExcelReferences {
  divisions: { division_id: number; local_no: number; division_name_bn: string }[];
  classes: {
    class_id: number;
    local_no: number;
    class_name_bn: string;
    division_id: number | null;
  }[];
  subjects: { book_id: number; local_no: number; book_name_bn: string; class_id: number }[];
}

/** Includes inactive/trash references so existing historical values round-trip safely. */
export async function getAcademicExcelReferences(): Promise<AcademicExcelReferences> {
  const response = await cachedGet("/academic-references");
  return response.data?.data ?? response.data;
}
