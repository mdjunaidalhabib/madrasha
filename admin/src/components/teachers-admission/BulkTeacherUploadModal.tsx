// Compatibility exports: teachers and staff use the same personnel adapter.
export { default } from "../common/BulkPersonnelUploadModal";
export type {
  ExcelPersonnelRow as ExcelTeacherRow,
  BulkPersonnelResult as BulkTeacherUploadResult,
} from "../common/BulkPersonnelUploadModal";
