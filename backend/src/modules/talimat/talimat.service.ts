import { talimatRepository, TalimatRepository } from "./talimat.repository";
import { MarksheetResult } from "./talimat.types";
import { TALIMAT_GRADE_THRESHOLDS, TALIMAT_FAIL_GRADE } from "./talimat.constants";
import { CreateResultRequestDto } from "./talimat.dto";

const resolveGrade = (average: number): string => {
  const match = TALIMAT_GRADE_THRESHOLDS.find((t) => average >= t.min);
  return match ? match.grade : TALIMAT_FAIL_GRADE;
};

export class TalimatService {
  constructor(private readonly repository: TalimatRepository = talimatRepository) {}

  async createResult(madrasaId: number, dto: CreateResultRequestDto) {
    await this.repository.insertResult(madrasaId, dto.student_id, dto.subject_id, dto.marks);
  }

  async getMarksheet(madrasaId: number, studentId: number): Promise<MarksheetResult> {
    const rows = await this.repository.findMarksheetRows(madrasaId, studentId);

    let total = 0;
    rows.forEach((r) => (total += Number(r.marks)));

    const average = rows.length ? total / rows.length : 0;
    const grade = resolveGrade(average);

    return { subjects: rows, total, average, grade };
  }
}

export const talimatService = new TalimatService();
