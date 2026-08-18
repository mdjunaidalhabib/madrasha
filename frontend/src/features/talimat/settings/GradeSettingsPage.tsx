import { useEffect, useState } from "react";
import { cachedGet } from "../../../services/api";
import PageHeader from "../../../components/ui/PageHeader";
import GeneralGradeList from "../../../components/ExamPanel/GeneralGradeList";
import MadrasaGradeList from "../../../components/ExamPanel/MadrasaGradeList";

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
      <div className="grid gap-4 md:grid-cols-2">
        <GeneralGradeList grades={generalGrades} reload={loadAll} failMark={failMark} />
        <MadrasaGradeList grades={madrasaGrades} reload={loadAll} failMark={failMark} />
      </div>
    </div>
  );
}
