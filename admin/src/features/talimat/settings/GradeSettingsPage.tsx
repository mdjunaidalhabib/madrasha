import { useEffect, useState } from "react";
import { cachedGet } from "../../../services/api";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import GeneralGradeList from "../../../components/ExamPanel/GeneralGradeList";
import MadrasaGradeList from "../../../components/ExamPanel/MadrasaGradeList";
import RecalculateResultsButton from "../../../components/ResultPanel/RecalculateResultsButton";

export default function GradeSettingsPage() {
  const [generalGrades, setGeneralGrades] = useState([]);
  const [madrasaGrades, setMadrasaGrades] = useState([]);
  const [failMark, setFailMark] = useState(35);

  const loadAll = async () => {
    const [g, m, f] = await Promise.all([
      cachedGet("/general-grades"),
      cachedGet("/madrasa-grades"),
      cachedGet("/fail-mark"),
    ]);
    setGeneralGrades(g.data);
    setMadrasaGrades(m.data);
    setFailMark(Number(f.data));
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="গ্রেড ব্যবস্থাপনা"
        subtitle={`সর্বনিম্ন সীমা স্বয়ংক্রিয়ভাবে হিসাব হয়। বর্তমান ফেল মার্ক: ${failMark} (পরিবর্তনের জন্য "পরীক্ষা" ট্যাবে যান)`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <p className="min-w-0 flex-1">
          গ্রেড সীমা বদলালে আগে প্রসেস হওয়া ফলাফল নিজে থেকে বদলায় না। সেটিং ঠিক করা হয়ে গেলে ফলাফলে প্রয়োগ করতে পুনঃগণনা
          করুন — কোন ফলাফলে কী বদলাবে আগেই দেখাবে, আপনি নিশ্চিত করলে তবেই প্রয়োগ হবে।
        </p>
        <RecalculateResultsButton />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <GeneralGradeList grades={generalGrades} reload={loadAll} failMark={failMark} />
        <MadrasaGradeList grades={madrasaGrades} reload={loadAll} failMark={failMark} />
      </div>
    </div>
  );
}
