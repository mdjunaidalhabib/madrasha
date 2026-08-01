import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedGet } from "../../services/api";
import { studentStatementApi } from "../../services/phase2Api";
import DataExportPrintActions from "../../components/common/DataExportPrintActions";
import { logger } from "../../utils/logger";
import { SkeletonList } from "../../components/ui/Skeleton";

type Division = { division_id: number; division_name_bn: string };
type ClassItem = { class_id: number; class_name_bn: string };
type Student = { id: number; name_bn?: string; roll?: number; class_id?: number };

type Payment = {
  id: number;
  amount: string | number;
  method: string;
  paidAt: string;
};

type InvoiceRow = {
  id: number;
  title: string;
  amount: string | number;
  paidAmount: string | number;
  dueDate: string;
  status: string;
  month?: string | null;
  payments: Payment[];
};

type StatementResponse = {
  invoices: InvoiceRow[];
  summary: { totalBilled: number; totalPaid: number; totalDue: number };
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  UNPAID: { label: "অপরিশোধিত", className: "bg-red-100 text-red-700" },
  PARTIALLY_PAID: { label: "আংশিক পরিশোধিত", className: "bg-amber-100 text-amber-700" },
  PAID: { label: "পরিশোধিত", className: "bg-green-100 text-green-700" },
  OVERDUE: { label: "মেয়াদোত্তীর্ণ", className: "bg-gray-200 text-gray-700" },
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const formatDate = (value: string) => String(value).slice(0, 10);

const StudentStatementPage = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [division, setDivision] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [classLoading, setClassLoading] = useState(false);

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");

  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD DIVISIONS ERROR:", err);
      setDivisions([]);
    }
  }, []);

  const loadAllStudents = useCallback(async () => {
    try {
      const res = await cachedGet("/students");
      setAllStudents(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD STUDENTS ERROR:", err);
      setAllStudents([]);
    }
  }, []);

  useEffect(() => {
    loadDivisions();
    loadAllStudents();
  }, [loadDivisions, loadAllStudents]);

  const loadClasses = async (divisionId: string) => {
    setClassId("");
    setStudentId("");
    if (!divisionId) {
      setClasses([]);
      return;
    }
    try {
      setClassLoading(true);
      const res = await cachedGet(`/madrasa-classes?division_id=${divisionId}`);
      setClasses(normalizeArray(res));
    } catch (err) {
      logger.error("CLASS LOAD ERROR:", err);
      setClasses([]);
    } finally {
      setClassLoading(false);
    }
  };

  const studentsInClass = useMemo(() => {
    if (!classId) return [];
    return allStudents.filter((student) => String(student.class_id) === String(classId));
  }, [allStudents, classId]);

  useEffect(() => {
    if (!studentId) {
      setStatement(null);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const res = await studentStatementApi.get(Number(studentId));
        setStatement((res.data as any)?.data || null);
      } catch (err) {
        logger.error("LOAD STATEMENT ERROR:", err);
        setStatement(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  const selectedStudent = studentsInClass.find((s) => String(s.id) === studentId);

  const exportRows = useMemo(() => {
    if (!statement) return [];
    return statement.invoices.map((invoice) => ({
      title: invoice.title,
      month: invoice.month || "-",
      due_date: formatDate(invoice.dueDate),
      amount: invoice.amount,
      paid_amount: invoice.paidAmount,
      due: Number(invoice.amount) - Number(invoice.paidAmount),
      status: STATUS_LABELS[invoice.status]?.label || invoice.status,
    }));
  }, [statement]);

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">শিক্ষার্থীর হিসাব বিবরণী</h1>
          <p className="mt-1 text-sm text-gray-500">
            একজন ছাত্রের সব ইনভয়েস ও পেমেন্টের হিসাব একসাথে দেখুন
          </p>
        </div>

        {/* Student picker */}
        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={division}
              onChange={(event) => {
                const value = event.target.value;
                setDivision(value);
                loadClasses(value);
              }}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none sm:w-[160px]"
            >
              <option value="">বিভাগ নির্বাচন করুন</option>
              {divisions.map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>

            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setStudentId("");
              }}
              disabled={!division || classLoading}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 sm:w-[180px]"
            >
              <option value="">{classLoading ? "লোড হচ্ছে..." : "শ্রেণি নির্বাচন করুন"}</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name_bn}
                </option>
              ))}
            </select>

            <select
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              disabled={!classId}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400 sm:w-[200px]"
            >
              <option value="">ছাত্র নির্বাচন করুন</option>
              {studentsInClass
                .slice()
                .sort((a, b) => Number(a.roll || 0) - Number(b.roll || 0))
                .map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.roll ? `${student.roll} - ` : ""}
                    {student.name_bn}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {!studentId ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
            হিসাব দেখতে প্রথমে একজন ছাত্র নির্বাচন করুন
          </div>
        ) : loading ? (
          <SkeletonList items={5} />
        ) : !statement || statement.invoices.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
            এই ছাত্রের কোনো ইনভয়েস নেই
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">মোট বিল</p>
                <p className="mt-1 text-lg font-bold text-gray-800">৳{statement.summary.totalBilled}</p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">মোট পরিশোধিত</p>
                <p className="mt-1 text-lg font-bold text-green-700">৳{statement.summary.totalPaid}</p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">মোট বাকি</p>
                <p className="mt-1 text-lg font-bold text-red-700">৳{statement.summary.totalDue}</p>
              </div>
            </div>

            {/* Export/Print */}
            <div className="mb-3 flex justify-end">
              <DataExportPrintActions
                title={`হিসাব বিবরণী — ${selectedStudent?.name_bn || ""}`}
                fileName={`statement-${studentId}`}
                columns={[
                  { header: "বিবরণ", key: "title" },
                  { header: "মাস", key: "month" },
                  { header: "ডিউ তারিখ", key: "due_date" },
                  { header: "পরিমাণ", key: "amount" },
                  { header: "পরিশোধিত", key: "paid_amount" },
                  { header: "বাকি", key: "due" },
                  { header: "স্ট্যাটাস", key: "status" },
                ]}
                data={exportRows}
              />
            </div>

            {/* Invoice list */}
            <div className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-col gap-3">
                {statement.invoices.map((invoice) => {
                  const due = Number(invoice.amount) - Number(invoice.paidAmount);
                  return (
                    <div key={invoice.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm">
                          <span className="font-semibold text-gray-800">{invoice.title}</span>
                          {invoice.month && (
                            <span className="text-gray-500"> ({invoice.month})</span>
                          )}{" "}
                          <span className="text-gray-500">
                            · ডিউ: {formatDate(invoice.dueDate)}
                          </span>
                        </div>
                        <span
                          className={`w-fit rounded px-2 py-0.5 text-xs ${
                            STATUS_LABELS[invoice.status]?.className || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {STATUS_LABELS[invoice.status]?.label || invoice.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                        <span>পরিমাণ: ৳{invoice.amount}</span>
                        <span className="text-green-700">পরিশোধিত: ৳{invoice.paidAmount}</span>
                        {due > 0 && <span className="text-red-700">বাকি: ৳{due}</span>}
                      </div>

                      {invoice.payments.length > 0 && (
                        <div className="mt-2 border-t border-gray-100 pt-2">
                          <p className="mb-1 text-xs font-medium text-gray-500">পেমেন্ট ইতিহাস:</p>
                          <div className="flex flex-col gap-1">
                            {invoice.payments.map((payment) => (
                              <div key={payment.id} className="text-xs text-gray-600">
                                {formatDate(payment.paidAt)} — ৳{payment.amount} ({payment.method})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentStatementPage;
