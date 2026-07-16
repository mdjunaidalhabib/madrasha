import { useEffect, useState } from "react";
import api from "../../services/api";

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
      api.get("/exams"),
      api.get("/general-grades"),
      api.get("/madrasa-grades"),
      api.get("/fail-mark"),
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
    <div className="p-8 bg-gray-50 min-h-screen space-y-8">
      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-800">
        🎓 Exam Management Dashboard
      </h1>

      {/* Top Section (Exam + Fail Mark) */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Exam List */}
        <div className="lg:col-span-2">
          <ExamList exams={exams} reload={loadAll} />
        </div>

        {/* Fail Mark */}
        <FailMarkSetting value={failMark} reload={loadAll} />
      </div>

      {/* Grades Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <GeneralGradeList grades={generalGrades} reload={loadAll} />
        <MadrasaGradeList grades={madrasaGrades} reload={loadAll} />
      </div>
    </div>
  );
}
