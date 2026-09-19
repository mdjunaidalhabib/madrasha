import { useEffect, useState } from "react";
import api, { cachedGet } from "../../services/api";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { withoutFailGrades } from "../ExamPanel/failGrade";

/**
 * Fail mark that applies to a class. It is division-scoped: a division may
 * override the madrasa-wide fail mark, and the backend resolves that for us
 * via `GET /fail-mark?class_id=N`.
 *
 * Returns `null` while nothing is selected or the class's value is still
 * loading (callers must not colour pass/fail from a guess), otherwise the
 * effective number. A failed request falls back to `fallback` so entry can
 * continue; a late response for a previously selected class is ignored.
 */
export function useClassFailMark(classId: string | number | null | undefined, fallback = 33) {
  const [state, setState] = useState<{ classId: string; value: number } | null>(null);
  const key = classId ? String(classId) : "";

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    api
      .get("/fail-mark", { params: { class_id: key } })
      .then((res) => {
        if (cancelled) return;
        const value = Number(res.data);
        setState({ classId: key, value: Number.isNaN(value) ? fallback : value });
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error("Fail mark load error:", err);
        setState({ classId: key, value: fallback });
      });

    return () => {
      cancelled = true;
    };
  }, [key, fallback]);

  // Only trust a value that was fetched for the class currently selected.
  return state && state.classId === key ? state.value : null;
}

const extractArray = (res: any): any[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

export type ScaleGrade = {
  id: string | number;
  name: string;
  divisionId?: number | null;
  division_id?: number | null;
};

const rowDivisionId = (row: ScaleGrade): number | null => {
  const raw = row.divisionId ?? row.division_id;
  return raw === null || raw === undefined ? null : Number(raw);
};

/**
 * Grade scale that applies to a division: its own rows if it has any,
 * otherwise the madrasa-wide default rows (no division). Mirrors the backend's
 * pickGradeScale. If the backend already filtered the list to one scale the
 * rows are returned unchanged.
 */
export function pickGradeScale<T extends ScaleGrade>(
  rows: T[],
  divisionId: number | null | undefined,
): T[] {
  if (divisionId !== null && divisionId !== undefined) {
    const own = rows.filter((row) => rowDivisionId(row) === Number(divisionId));
    if (own.length) return own;
  }
  return rows.filter((row) => rowDivisionId(row) === null);
}

/**
 * The general + madrasa grade scales for a class's division, for legends.
 * Fetches the default scale plus the division's own rows and picks the scale
 * that applies (own rows if any, else default).
 */
export function useDivisionGradeScales<T extends ScaleGrade>(
  classId: string | number | null | undefined,
  divisionId: number | null | undefined,
) {
  const [general, setGeneral] = useState<T[]>([]);
  const [madrasa, setMadrasa] = useState<T[]>([]);
  const cls = classId ? String(classId) : "";
  const div = divisionId ?? null;

  useEffect(() => {
    let cancelled = false;

    // Without a query the endpoints return only the default scale; with
    // `division_id` they return only that division's own rows (empty when it
    // follows the default). So fetch both and let pickGradeScale decide.
    const load = async (path: string): Promise<T[]> => {
      const [def, own] = await Promise.all([
        cachedGet(path),
        div !== null ? cachedGet(path, { params: { division_id: div } }) : null,
      ]);
      return [...extractArray(def.data), ...(own ? extractArray(own.data) : [])] as T[];
    };

    Promise.all([load("/general-grades"), load("/madrasa-grades")])
      .then(([g, m]) => {
        if (cancelled) return;
        // Legacy fail-named rows (F / রাসিব) are not grade bands - keep them out of legends.
        setGeneral(withoutFailGrades("general", pickGradeScale(g, div)));
        setMadrasa(withoutFailGrades("madrasa", pickGradeScale(m, div)));
      })
      .catch((err) => {
        if (!cancelled) logger.error("Grades load error:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [cls, div]);

  return { generalGrades: general, madrasaGrades: madrasa };
}
