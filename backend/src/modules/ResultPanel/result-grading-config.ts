import { DEFAULT_FAIL_MARK, FAIL_MARK_SETTING_NAME } from "./result-panel.constants";
import { pickGradeScale, resolveFailMark, withoutFailGradeRows } from "./division-grading";
import { GradeRow } from "./result-panel.types";

/** Grade + fail-mark rules that apply to ONE class's results: the class's
 * division override when it has one, otherwise the madrasa-wide defaults. */
export interface ClassGradingConfig {
  generalGrades: GradeRow[];
  madrasaGrades: GradeRow[];
  failMark: number;
}

type GradeRowWithDivision = GradeRow & { divisionId?: number | null };

/** The slice of the result repository the resolver needs (kept structural so
 * tests can hand in plain objects). */
export interface GradingConfigSource {
  findSettings(madrasaId: number): Promise<{ name: string; value: string | null }[]>;
  findGeneralGrades(madrasaId: number): Promise<GradeRowWithDivision[]>;
  findMadrasaGrades(madrasaId: number): Promise<GradeRowWithDivision[]>;
  /** The class's division and that division's fail-mark override (null = none). */
  findClassGradingScope(
    madrasaId: number,
    classId: number,
  ): Promise<{ divisionId: number | null; divisionFailMark: number | null }>;
}

/**
 * Per-madrasa resolver for division-scoped grading rules. Everything shared
 * across classes (the global fail-mark setting, the full grade lists - ONE
 * query each per madrasa) is loaded lazily and once; each class then resolves
 * to its own division's failMark/grade scale, cached per class. With no
 * division overrides every class resolves to exactly the old madrasa-wide
 * values.
 */
export class MadrasaGradingConfig {
  private globalFailMarkPromise: Promise<number> | null = null;
  private gradesPromise: Promise<{ general: GradeRowWithDivision[]; madrasa: GradeRowWithDivision[] }> | null =
    null;
  private readonly scopeByClass = new Map<
    number,
    Promise<{ divisionId: number | null; divisionFailMark: number | null }>
  >();
  private readonly failMarkByClass = new Map<number, Promise<number>>();
  private readonly configByDivision = new Map<number | null, Promise<ClassGradingConfig>>();

  constructor(
    private readonly source: GradingConfigSource,
    private readonly madrasaId: number,
  ) {}

  private globalFailMark() {
    if (!this.globalFailMarkPromise) {
      this.globalFailMarkPromise = this.source.findSettings(this.madrasaId).then((settings) => {
        const fail = settings.find((row) => row.name === FAIL_MARK_SETTING_NAME);
        return fail ? Number(fail.value) : DEFAULT_FAIL_MARK;
      });
    }
    return this.globalFailMarkPromise;
  }

  private grades() {
    if (!this.gradesPromise) {
      this.gradesPromise = Promise.all([
        this.source.findGeneralGrades(this.madrasaId),
        this.source.findMadrasaGrades(this.madrasaId),
        // Legacy fail-named rows (F / রাসিব) are not bands - failed students get
        // them automatically - so they never take part in a scale.
      ]).then(([general, madrasa]) => ({
        general: withoutFailGradeRows(general, "general"),
        madrasa: withoutFailGradeRows(madrasa, "madrasa"),
      }));
    }
    return this.gradesPromise;
  }

  private scope(classId: number) {
    let cached = this.scopeByClass.get(classId);
    if (!cached) {
      cached = this.source.findClassGradingScope(this.madrasaId, classId);
      this.scopeByClass.set(classId, cached);
    }
    return cached;
  }

  /** Fail mark for the class (division override, else the global setting). */
  failMarkForClass(classId: number): Promise<number> {
    let cached = this.failMarkByClass.get(classId);
    if (!cached) {
      cached = Promise.all([this.scope(classId), this.globalFailMark()]).then(
        ([scope, globalFailMark]) => resolveFailMark(scope.divisionFailMark, globalFailMark),
      );
      this.failMarkByClass.set(classId, cached);
    }
    return cached;
  }

  /** Full rules (fail mark + both grade scales) for the class. */
  async forClass(classId: number): Promise<ClassGradingConfig> {
    const scope = await this.scope(classId);
    const [failMark, grades] = await Promise.all([this.failMarkForClass(classId), this.grades()]);

    // Grade scales depend only on the division; share the picked lists between
    // classes of the same division. The fail mark is class-resolved above
    // (it also depends only on the division, but stays a separate cache).
    let scales = this.configByDivision.get(scope.divisionId);
    if (!scales) {
      scales = Promise.resolve({
        generalGrades: pickGradeScale(grades.general, scope.divisionId),
        madrasaGrades: pickGradeScale(grades.madrasa, scope.divisionId),
        failMark,
      });
      this.configByDivision.set(scope.divisionId, scales);
    }
    return scales;
  }
}
