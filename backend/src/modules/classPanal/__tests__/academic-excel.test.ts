import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import * as reader from "xlsx";
import {
  academicExcelId,
  academicExcelValue,
  appendAcademicExcelIds,
  resolveAcademicExcelIds,
  AcademicExcelIdError,
} from "../../../../../admin/src/utils/academicExcelIds";

const divisions = [
  { id: 67, local_no: 1 },
  { id: 68, local_no: 2 },
];
const classes = [
  { id: 211, local_no: 1 },
  { id: 212, local_no: 2 },
];
function workbook() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["name_bn", "academic_division", "current_class"]]),
    "Data",
  );
  appendAcademicExcelIds(XLSX, wb, {
    academic_division: divisions,
    division_id: divisions,
    current_class: classes,
    class_id: classes,
    previous_class: classes,
    previous_class_id: classes,
    book_id: [{ id: 900, local_no: 1 }],
    exam_id: [{ id: 1000, local_no: 1 }],
  });
  return reader.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
}

describe("institution-local academic Excel numbers", () => {
  it("resolves repeated class/subject numbers using their parent, regardless of field order", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["name_bn"]]), "Data");
    const scopedClasses = [
      { id: 211, local_no: 1, scope_id: 67, scope_key: "1", parent_fields: ["division_id"] },
      { id: 301, local_no: 1, scope_id: 68, scope_key: "2", parent_fields: ["division_id"] },
    ];
    appendAcademicExcelIds(XLSX, wb, {
      book_id: [
        { id: 900, local_no: 1, scope_id: 211, scope_key: "1/1", parent_fields: ["class_id"] },
        { id: 901, local_no: 1, scope_id: 301, scope_key: "2/1", parent_fields: ["class_id"] },
      ],
      class_id: scopedClasses,
      previous_class_id: scopedClasses.map(({ parent_fields, ...r }) => r),
      division_id: divisions,
    });
    const roundTrip = reader.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), {
      type: "buffer",
    });
    expect(
      resolveAcademicExcelIds(reader, roundTrip, [
        { division_id: 1, class_id: 1, book_id: 1, previous_class_id: "2/1" },
        { division_id: 2, class_id: 1, book_id: 1, previous_class_id: "1/1" },
      ]),
    ).toEqual([
      { division_id: 67, class_id: 211, book_id: 900, previous_class_id: 301 },
      { division_id: 68, class_id: 301, book_id: 901, previous_class_id: 211 },
    ]);
    expect(academicExcelValue(scopedClasses, 301)).toBe("2/1");
    expect(() => resolveAcademicExcelIds(reader, roundTrip, [{ previous_class_id: 1 }])).toThrow(
      AcademicExcelIdError,
    );
    expect(() =>
      resolveAcademicExcelIds(reader, roundTrip, [{ division_id: 1, class_id: "2/1" }]),
    ).toThrow(AcademicExcelIdError);
  });

  it("still reads maps embedded in templates downloaded before parent scopes", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["edin_local_academic_ids_v1"],
        ["field", "local_no", "record_id"],
        ["class_id", 9, 211],
      ]),
      "__AcademicIds",
    );
    expect(resolveAcademicExcelIds(reader, wb, [{ class_id: 9 }])).toEqual([{ class_id: 211 }]);
  });

  it("exports local numbers while preserving database IDs for API requests", () => {
    expect(divisions.map(academicExcelId)).toEqual([1, 2]);
    expect(classes.map(academicExcelId)).toEqual([1, 2]);
    expect(academicExcelValue(classes, 212)).toBe(2);
    const wb = workbook();
    const rows = [
      {
        name_bn: "Example",
        academic_division: "1",
        current_class: "2",
        previous_class: "",
        book_id: "1",
        exam_id: "1",
      },
    ];
    expect(resolveAcademicExcelIds(reader, wb, rows)).toEqual([
      {
        name_bn: "Example",
        academic_division: 67,
        current_class: 212,
        previous_class: "",
        book_id: 900,
        exam_id: 1000,
      },
    ]);
    expect(rows[0].current_class).toBe("2");
    expect(wb.Workbook?.Sheets?.find((s) => s.name === "__AcademicIds")?.Hidden).toBe(2);
  });

  it("round-trips bulk-update reference values without inventing changes", () => {
    const exported = {
      division_id: academicExcelValue(divisions, 68),
      previous_class_id: academicExcelValue(classes, 211),
    };
    expect(exported).toEqual({ division_id: 2, previous_class_id: 1 });
    expect(resolveAcademicExcelIds(reader, workbook(), [exported])).toEqual([
      { division_id: 68, previous_class_id: 211 },
    ]);
  });

  it("keeps old unmarked workbooks using their existing database IDs", () => {
    const wb = XLSX.utils.book_new();
    const rows = [{ academic_division: 67, current_class: 211 }];
    expect(resolveAcademicExcelIds(reader, wb, rows)).toBe(rows);
  });

  it("accepts Bangla digits and preserves empty optional references", () => {
    expect(
      resolveAcademicExcelIds(reader, workbook(), [
        { academic_division: "১", current_class: "২", previous_class: null },
      ]),
    ).toEqual([{ academic_division: 67, current_class: 212, previous_class: null }]);
  });

  it("rejects unknown local numbers instead of treating them as database IDs", () => {
    expect(() => resolveAcademicExcelIds(reader, workbook(), [{ current_class: 211 }], 4)).toThrow(
      AcademicExcelIdError,
    );
    try {
      resolveAcademicExcelIds(reader, workbook(), [{ current_class: 99 }], 4);
    } catch (e) {
      expect(e).toMatchObject({ row: 4, field: "current_class", value: "99" });
    }
  });

  it("requires stored local numbers and rejects ambiguous maps", () => {
    expect(() => academicExcelId({ local_no: null })).toThrow();
    expect(() => academicExcelValue(classes, 999)).toThrow();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["name_bn"]]), "Data");
    appendAcademicExcelIds(XLSX, wb, {
      class_id: [
        { id: 211, local_no: 1 },
        { id: 212, local_no: 1 },
      ],
    });
    expect(() => resolveAcademicExcelIds(reader, wb, [{ class_id: 1 }])).toThrow("Ambiguous");
  });
});
