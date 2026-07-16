export { TenantNotFoundInRequestError } from "../../shared/errors";

export interface GradeRow {
  name: string;
  minMark: any;
  maxMark: any;
}

export interface ClassStatusRow {
  class_id: number;
  class_name_bn: string;
  result_master_id: number | null;
  publish_status: string | null;
  total_students: number | bigint;
  entered_students: number | bigint;
}

export interface OverviewStatusRow {
  class_id: number;
  division_id: number;
  exam_id: number;
  result_master_id: number | null;
  publish_status: string | null;
  total_students: number | bigint;
  entered_students: number | bigint;
}
