export interface MarksheetSubjectRow {
  subject: string;
  marks: number;
}

export interface MarksheetResult {
  subjects: MarksheetSubjectRow[];
  total: number;
  average: number;
  grade: string;
}
