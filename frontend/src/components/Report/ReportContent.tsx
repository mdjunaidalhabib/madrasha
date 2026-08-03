import { ReportMenuItem } from "../../../src/features/reports/types";
import { SkeletonTable } from "../ui/Skeleton";
import AcademicResultPrint from "./academic/AcademicResultPrint";
import ClassRoutinePrint from "./academic/ClassRoutinePrint";
import DailyAttendancePrint from "./academic/DailyAttendancePrint";
import DigitalAttendancePrint from "./academic/DigitalAttendancePrint";
import ResidentialAttendancePrint from "./academic/ResidentialAttendancePrint";
import ResultNoticeList from "./academic/ResultNoticeList";
import AdmitCardGrid from "./documents/AdmitCardGrid";
import IdCardGrid from "./documents/IdCardGrid";
import SanadList from "./documents/SanadList";
import TestimonialList from "./documents/TestimonialList";
import TransferLetterList from "./documents/TransferLetterList";
import ExamNumberSheet from "./exam/ExamNumberSheet";
import ExamSignatureSheet from "./exam/ExamSignatureSheet";
import GuardianPhoneListPrint from "./student/GuardianPhoneListPrint";
import MarksheetList from "./student/MarksheetList";
import StudentAdmissionListPrint from "./student/StudentAdmissionListPrint";
import TeacherListPrint from "./teacher/TeacherListPrint";
import TeacherPhoneListPrint from "./teacher/TeacherPhoneListPrint";
import ReportTable from "./ReportTable";

type ReportContentProps = {
  loading: boolean;
  report: ReportMenuItem;
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
  startIndex?: number;
  isLastPage?: boolean;
  isFirstPage?: boolean;
  bodyTextOverride?: string;
};

const ReportContent = ({
  loading,
  report,
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
  startIndex = 0,
  isLastPage = true,
  isFirstPage = true,
  bodyTextOverride,
}: ReportContentProps) => {
  if (loading) {
    return (
      <div className="border border-black bg-white p-4">
        <SkeletonTable rows={8} columns={6} className="border-0 shadow-none" />
      </div>
    );
  }

  if (!rows.length && isFirstPage) {
    // A non-first page can legitimately have zero rows - it's a dedicated
    // page for a footer/signature that had no room left on the last page
    // of actual content, not a "this report has no data" state.
    return (
      <div className="flex h-56 items-center justify-center border border-black bg-white text-sm text-slate-500">
        কোনো ডাটা পাওয়া যায়নি
      </div>
    );
  }

  if (report.printable === "marksheet") {
    return <MarksheetList rows={rows} isFirstPage={isFirstPage} isLastPage={isLastPage} />;
  }
  if (report.printable === "result-notice") {
    return (
      <ResultNoticeList
        rows={rows}
        startIndex={startIndex}
        columns={report.columns}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
      />
    );
  }
  if (report.printable === "id-card") return <IdCardGrid rows={rows} />;
  if (report.printable === "admit-card") return <AdmitCardGrid rows={rows} />;
  if (report.printable === "certificate") {
    return (
      <SanadList
        rows={rows}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
        bodyTextOverride={bodyTextOverride}
      />
    );
  }
  if (report.printable === "testimonial") {
    return (
      <TestimonialList
        rows={rows}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
        bodyTextOverride={bodyTextOverride}
      />
    );
  }
  if (report.printable === "transfer-letter") {
    return (
      <TransferLetterList
        rows={rows}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
        bodyTextOverride={bodyTextOverride}
      />
    );
  }

  if (report.printable === "attendance-register") {
    return (
      <ResidentialAttendancePrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        startIndex={startIndex}
        isFirstPage={isFirstPage}
      />
    );
  }

  if (report.printable === "daily-attendance-register") {
    return (
      <DailyAttendancePrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        startIndex={startIndex}
        isFirstPage={isFirstPage}
      />
    );
  }

  if (report.printable === "digital-attendance") {
    return (
      <DigitalAttendancePrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        startIndex={startIndex}
        isFirstPage={isFirstPage}
      />
    );
  }

  if (report.printable === "academic-result") {
    return (
      <AcademicResultPrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        startIndex={startIndex}
        columns={report.columns}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
      />
    );
  }

  if (report.printable === "class-routine") {
    return (
      <ClassRoutinePrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        startIndex={startIndex}
        isFirstPage={isFirstPage}
      />
    );
  }

  if (report.printable === "student-admission-list") {
    return (
      <StudentAdmissionListPrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        startIndex={startIndex}
        isFirstPage={isFirstPage}
      />
    );
  }

  if (report.printable === "guardian-phone-list") {
    return (
      <GuardianPhoneListPrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        startIndex={startIndex}
        isFirstPage={isFirstPage}
      />
    );
  }

  if (report.printable === "teacher-list") {
    return (
      <TeacherListPrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        startIndex={startIndex}
        isFirstPage={isFirstPage}
      />
    );
  }

  if (report.printable === "teacher-phone-list") {
    return (
      <TeacherPhoneListPrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        startIndex={startIndex}
        isFirstPage={isFirstPage}
      />
    );
  }

  if (report.printable === "exam-signature-sheet") {
    return (
      <ExamSignatureSheet
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        startIndex={startIndex}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
      />
    );
  }

  if (report.printable === "exam-number-sheet") {
    return (
      <ExamNumberSheet
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
        startIndex={startIndex}
        columns={report.columns}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
      />
    );
  }

  return (
    <div className="border bg-white">
      <div className="overflow-x-auto">
        <ReportTable report={report} rows={rows} startIndex={startIndex} />
      </div>
    </div>
  );
};

export default ReportContent;
