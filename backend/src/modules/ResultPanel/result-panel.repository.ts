import { Prisma, ResultPublishStatus } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { ClassStatusRow, OverviewStatusRow } from "./result-panel.types";

export class ResultPanelRepository {
  findResultMaster(madrasaId: number, examId: number, classId: number) {
    return prisma.resultMaster.findFirst({
      where: { madrasaId, examId, classId },
    });
  }

  findLatestResultMasterId(madrasaId: number, examId: number, classId: number) {
    return prisma.resultMaster.findFirst({
      where: { madrasaId, examId, classId },
      orderBy: { id: "desc" },
      select: { id: true },
    });
  }

  createResultMaster(madrasaId: number, examId: number, classId: number) {
    return prisma.resultMaster.create({
      data: { madrasaId, examId, classId, status: "DRAFT" },
    });
  }

  findResultMasterById(id: number, madrasaId: number) {
    return prisma.resultMaster.findFirst({ where: { id, madrasaId }, select: { id: true } });
  }

  updateResultMasterStatus(id: number, status: ResultPublishStatus) {
    return prisma.resultMaster.update({ where: { id }, data: { status } });
  }

  upsertMarksInTransaction(rows: Prisma.MarkUpsertArgs[]) {
    return prisma.$transaction(rows.map((row) => prisma.mark.upsert(row)));
  }

  findMarks(madrasaId: number, examId: number, classId: number, resultMasterId: number) {
    return prisma.mark.findMany({
      where: { madrasaId, examId, classId, resultMasterId },
      select: { studentId: true, bookId: true, mark: true, resultMasterId: true },
      orderBy: [{ studentId: "asc" }, { bookId: "asc" }],
    });
  }

  findSettings(madrasaId: number) {
    return prisma.setting.findMany({
      where: { madrasaId },
      select: { name: true, value: true },
    });
  }

  findGeneralGrades(madrasaId: number) {
    return prisma.generalGrade.findMany({ where: { madrasaId }, orderBy: { minMark: "desc" } });
  }

  findMadrasaGrades(madrasaId: number) {
    return prisma.madrasaGrade.findMany({ where: { madrasaId }, orderBy: { minMark: "desc" } });
  }

  groupMarksByStudent(madrasaId: number, examId: number, classId: number, resultMasterId: number) {
    return prisma.mark.groupBy({
      by: ["studentId"],
      where: { madrasaId, examId, classId, resultMasterId },
      _sum: { mark: true },
      _count: { _all: true },
    });
  }

  saveResultSummaryInTransaction(resultMasterId: number, summaryData: Prisma.ResultSummaryCreateManyInput[]) {
    return prisma.$transaction([
      prisma.resultSummary.deleteMany({ where: { resultMasterId } }),
      prisma.resultSummary.createMany({ data: summaryData }),
      prisma.resultMaster.update({ where: { id: resultMasterId }, data: { status: "DRAFT" } }),
    ]);
  }

  findClassStatus(madrasaId: number, examId: number, divisionId: number) {
    return prisma.$queryRaw<ClassStatusRow[]>`
      SELECT
        c.id AS class_id,
        c.name_bn AS class_name_bn,
        rm.id AS result_master_id,
        rm.status AS publish_status,
        (SELECT COUNT(*) FROM students st
           WHERE st.madrasa_id = ${madrasaId} AND st.class_id = c.id AND st.division_id = ${divisionId}
        ) AS total_students,
        (SELECT COUNT(DISTINCT rs.student_id) FROM results_summary rs
           WHERE rs.result_master_id = rm.id
        ) AS entered_students
      FROM madrasa_classes mc
      JOIN classes c ON c.id = mc.class_id
      LEFT JOIN results_master rm
        ON rm.class_id = c.id AND rm.exam_id = ${examId} AND rm.madrasa_id = ${madrasaId}
      WHERE mc.madrasa_id = ${madrasaId} AND c.division_id = ${divisionId} AND mc.is_active = 1
      ORDER BY c.id ASC
    `;
  }

  findActiveDivisions(madrasaId: number) {
    return prisma.madrasaDivision.findMany({
      where: { madrasaId, isActive: 1 },
      select: { division: { select: { id: true, nameBn: true } } },
      orderBy: { division: { id: "asc" } },
    });
  }

  findExams(madrasaId: number) {
    return prisma.exam.findMany({
      where: { madrasaId },
      select: { id: true, name: true },
      orderBy: { id: "desc" },
    });
  }

  findActiveClasses(madrasaId: number) {
    return prisma.madrasaClass.findMany({
      where: { madrasaId, isActive: 1 },
      select: { class: { select: { id: true, nameBn: true, divisionId: true } } },
      orderBy: [{ class: { divisionId: "asc" } }, { class: { id: "asc" } }],
    });
  }

  findOverviewStatuses(madrasaId: number) {
    return prisma.$queryRaw<OverviewStatusRow[]>`
      SELECT
        c.id AS class_id,
        c.division_id,
        e.id AS exam_id,
        rm.id AS result_master_id,
        rm.status AS publish_status,
        (SELECT COUNT(*) FROM students st
           WHERE st.madrasa_id = ${madrasaId} AND st.class_id = c.id
        ) AS total_students,
        (SELECT COUNT(DISTINCT rs.student_id) FROM results_summary rs
           WHERE rs.result_master_id = rm.id
        ) AS entered_students
      FROM madrasa_classes mc
      JOIN classes c ON c.id = mc.class_id
      JOIN exams e ON e.madrasa_id = ${madrasaId}
      LEFT JOIN results_master rm
        ON rm.class_id = c.id AND rm.exam_id = e.id AND rm.madrasa_id = ${madrasaId}
      WHERE mc.madrasa_id = ${madrasaId} AND mc.is_active = 1
    `;
  }

  findResultSummaries(madrasaId: number, examId: number, classId: number) {
    return prisma.resultSummary.findMany({
      where: { resultMaster: { madrasaId, examId, classId } },
      select: {
        resultMasterId: true,
        studentId: true,
        total: true,
        average: true,
        generalGrade: true,
        madrasaGrade: true,
        status: true,
        rankNo: true,
        resultMaster: { select: { status: true } },
        student: { select: { nameBn: true } },
      },
      orderBy: [{ rankNo: "asc" }, { studentId: "asc" }],
    });
  }

  findResultSummaryExists(resultMasterId: number) {
    return prisma.resultSummary.findFirst({ where: { resultMasterId }, select: { id: true } });
  }

  deleteResultInTransaction(id: number) {
    return prisma.$transaction([
      prisma.mark.deleteMany({ where: { resultMasterId: id } }),
      prisma.resultSummary.deleteMany({ where: { resultMasterId: id } }),
      prisma.resultMaster.delete({ where: { id } }),
    ]);
  }

  findFullResultSummaries(madrasaId: number, resultMasterId: number) {
    return prisma.resultSummary.findMany({
      where: { resultMasterId, resultMaster: { madrasaId } },
      select: {
        resultMasterId: true,
        total: true,
        average: true,
        generalGrade: true,
        madrasaGrade: true,
        status: true,
        rankNo: true,
        resultMaster: { select: { status: true } },
        student: {
          select: {
            id: true,
            nameBn: true,
            marks: {
              where: { resultMasterId },
              select: { bookId: true, mark: true, book: { select: { nameBn: true, name: true } } },
              orderBy: { bookId: "asc" },
            },
          },
        },
      },
      orderBy: [{ rankNo: "asc" }, { studentId: "asc" }],
    });
  }
}

export const resultPanelRepository = new ResultPanelRepository();
