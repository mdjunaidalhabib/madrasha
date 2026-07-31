export interface PromotionPreviewRequestDto {
  from_class_id: number | string;
  from_year: string;
  exam_id?: number | string; // final exam used to determine pass/fail, optional
}

export interface PromotionDecisionDto {
  student_id: number | string;
  status: "PROMOTED" | "RETAINED" | "TRANSFERRED";
}

export interface PromotionExecuteRequestDto {
  from_class_id: number | string;
  to_class_id: number | string;
  from_year: string;
  to_year: string;
  decisions: PromotionDecisionDto[];
}
