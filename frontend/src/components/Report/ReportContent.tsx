import { ReportMenuItem } from "../../../src/features/reports/types";
import AbashikAttendancePrint from "./abashikAttendancePrint";
import DailyAttendancePrint from "./DailyAttendancePrint";
import DigitalAttendancePrint from "./DigitalAttendancePrint";
import TestimonialList from "./TestimonialList";
import SanadList from "./SanadList";
import AdmitCardGrid from "./AdmitCardGrid";
import TransferLetterList from "./TransferLetterList";
import IdCardGrid from "./IdCardGrid";
import ReportTable from "./ReportTable";

type ReportContentProps = {
  loading: boolean;
  report: ReportMenuItem;
  rows: Record<string, any>[];
  selectedDivisionName?: string;
  selectedClassName?: string;
};

const ReportContent = ({
  loading,
  report,
  rows,
  selectedDivisionName = "",
  selectedClassName = "",
}: ReportContentProps) => {
  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center border border-black bg-white text-sm text-slate-500">
        রিপোর্ট লোড হচ্ছে...
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex h-56 items-center justify-center border border-black bg-white text-sm text-slate-500">
        কোনো ডাটা পাওয়া যায়নি
      </div>
    );
  }

  if (report.printable === "id-card") {
    return <IdCardGrid rows={rows} />;
  }

  if (report.printable === "admit-card") {
    return <AdmitCardGrid rows={rows} />;
  }

  if (report.printable === "certificate") {
    return <SanadList rows={rows} />;
  }

  if (report.printable === "testimonial") {
    return <TestimonialList rows={rows} />;
  }

  if (report.printable === "transfer-letter") {
    return <TransferLetterList rows={rows} />;
  }

  if (report.printable === "attendance-register") {
    return (
      <AbashikAttendancePrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
      />
    );
  }

  if (report.printable === "daily-attendance-register") {
    return (
      <DailyAttendancePrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
      />
    );
  }

  if (report.printable === "digital-attendance") {
    return (
      <DigitalAttendancePrint
        rows={rows}
        selectedDivisionName={selectedDivisionName}
        selectedClassName={selectedClassName}
      />
    );
  }

  return (
    <div className="border bg-white">
      <div className="overflow-x-auto">
        <ReportTable report={report} rows={rows} />
      </div>
    </div>
  );
};

export default ReportContent;
