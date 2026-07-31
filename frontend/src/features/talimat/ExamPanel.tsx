import { useEffect, useState } from "react";
import { cachedGet } from "../../services/api";

import PageHeader from "../../components/ui/PageHeader";
import ExamList from "../../components/ExamPanel/ExamList";
import GeneralGradeList from "../../components/ExamPanel/GeneralGradeList";
import MadrasaGradeList from "../../components/ExamPanel/MadrasaGradeList";
import FailMarkSetting from "../../components/ExamPanel/FailMarkSetting";

export default function ExamPanel() {
  const [exams, setExams] = useState([]);
  const [generalGrades, setGeneralGrades] = useState([]);
  const [madrasaGrades, setMadrasaGrades] = useState([]);
  const [failMark, setFailMark] = useState(35);

  const loadAll = async () => {
    const [e, g, m, f] = await Promise.all([
      cachedGet("/exams"),
      cachedGet("/general-grades"),
      cachedGet("/madrasa-grades"),
      cachedGet("/fail-mark"),
    ]);

    setExams(e.data);
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
        title="পরীক্ষা ব্যবস্থাপনা"
        subtitle="পরীক্ষার তালিকা, গ্রেড ও ফেল মার্ক নির্ধারণ করুন"
      />

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2">
          <ExamList exams={exams} reload={loadAll} />
        </div>

        <FailMarkSetting value={failMark} reload={loadAll} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GeneralGradeList grades={generalGrades} reload={loadAll} />
        <MadrasaGradeList grades={madrasaGrades} reload={loadAll} />
      </div>
    </div>
  );
}
