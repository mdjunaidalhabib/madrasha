import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import ReportContent from "../../components/Report/ReportContent";
import { ReportBrandHeader, ReportWatermark } from "../../components/Report/ReportBranding";
import ReportFilterBar from "../../components/Report/ReportFilterBar";
import ReportSidebar from "../../components/Report/ReportSidebar";
import { ClassItem, Division, ReportColumn, ReportMenuItem, ReportShellProps } from "./types";
import { getRowClassId, getRowDivisionId } from "../../utils/reportUtils";
import { logger } from "../../utils/logger";

export type { ReportColumn, ReportMenuItem } from "./types";

const ReportShell = ({ reports, hideBrandHeader = false }: ReportShellProps) => {
  const [activeKey, setActiveKey] = useState(reports[0]?.key || "");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState("");

  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const activeReport = useMemo(
    () => reports.find((item) => item.key === activeKey) || reports[0],
    [activeKey, reports],
  );

  const loadReport = async () => {
    if (!activeReport?.endpoint) return;

    try {
      setLoading(true);
      setWarning("");

      const res = await api.get(activeReport.endpoint);
      const data =
        res.data?.data || res.data?.students || res.data?.teachers || res.data?.result || [];

      setRows(Array.isArray(data) ? data : []);
      setWarning(res.data?.warning || "");
    } catch (error: any) {
      logger.error("REPORT LOAD ERROR:", error);
      setRows([]);
      setWarning(error?.response?.data?.message || "রিপোর্ট লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  const loadDivisions = async () => {
    try {
      const res = await api.get("/madrasa-divisions");
      const data = res.data?.data || res.data?.result || res.data || [];
      setDivisions(Array.isArray(data) ? data : []);
    } catch {
      setDivisions([]);
    }
  };

  const loadClassesByDivision = async (divisionId: string) => {
    setSelectedClass("");

    if (!divisionId) {
      setClasses([]);
      return;
    }

    try {
      const res = await api.get(`/madrasa-classes?division_id=${divisionId}`);
      const data = res.data?.data || res.data?.result || res.data || [];
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    }
  };

  useEffect(() => {
    loadDivisions();
  }, []);

  useEffect(() => {
    loadReport();
    setSearch("");
    setSelectedDivision("");
    setSelectedClass("");
    setClasses([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const filteredRows = rows.filter((row) => {
    const keyword = search.trim().toLowerCase();
    const rowDivisionId = String(getRowDivisionId(row));
    const rowClassId = String(getRowClassId(row));

    const searchableText = [
      row.id,
      row.student_id,
      row.teacher_id,
      row.name,
      row.name_bn,
      row.student_name,
      row.teacher_name,
      row.father_name,
      row.guardian_phone,
      row.mobile,
      row.phone,
      row.class_name,
      row.division_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!keyword || searchableText.includes(keyword)) &&
      (!selectedDivision || rowDivisionId === String(selectedDivision)) &&
      (!selectedClass || rowClassId === String(selectedClass))
    );
  });

  const selectedDivisionName =
    divisions.find((division) => String(division.division_id) === String(selectedDivision))
      ?.division_name_bn || "";

  const selectedClassName =
    classes.find((cls) => String(cls.class_id) === String(selectedClass))?.class_name_bn || "";

  const exportRows = filteredRows.map((row, index) => ({
    serial: index + 1,
    ...row,
  }));

  const exportColumns: ReportColumn[] = [
    { header: "ক্রমিক", key: "serial" },
    ...activeReport.columns,
  ];

  const clearFilters = () => {
    setSearch("");
    setSelectedDivision("");
    setSelectedClass("");
    setClasses([]);
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] p-4 md:p-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
        <ReportSidebar reports={reports} activeKey={activeReport.key} onChange={setActiveKey} />

        <main className="overflow-hidden border border-slate-300 bg-white">
          <div className="no-print border-b border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{activeReport.title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">{activeReport.subtitle}</p>
              </div>

              <div className="border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                মোট <span className="font-bold text-slate-900">{filteredRows.length}</span> টি
                রেকর্ড
              </div>
            </div>

            <ReportFilterBar
              search={search}
              selectedDivision={selectedDivision}
              selectedClass={selectedClass}
              divisions={divisions}
              classes={classes}
              activeReport={activeReport}
              exportColumns={exportColumns}
              exportRows={exportRows}
              onSearchChange={setSearch}
              onDivisionChange={(value) => {
                setSelectedDivision(value);
                loadClassesByDivision(value);
              }}
              onClassChange={setSelectedClass}
              onClear={clearFilters}
            />

            {warning && (
              <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {warning}
              </div>
            )}
          </div>

          <div className="print-preview-wrap">
            <div className="print-area print-page-preview bg-white">
              <ReportWatermark />
              {!hideBrandHeader && <ReportBrandHeader />}
              <div className="report-content-body">
                <ReportContent
                  loading={loading}
                  report={activeReport}
                  rows={filteredRows}
                  selectedDivisionName={selectedDivisionName}
                  selectedClassName={selectedClassName}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReportShell;
