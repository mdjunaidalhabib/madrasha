import { useEffect, useState } from "react";
import { cachedGet } from "../../../services/api";
import PageHeader from "../../../components/ui/PageHeader";
import ExamList from "../../../components/ExamPanel/ExamList";
import FailMarkSetting from "../../../components/ExamPanel/FailMarkSetting";

export default function ExamSettingsPage() {
  const [exams, setExams] = useState([]);
  const [failMark, setFailMark] = useState(35);

  const loadAll = async () => {
    const [e, f] = await Promise.all([cachedGet("/exams"), cachedGet("/fail-mark")]);
    setExams(e.data);
    setFailMark(Number(f.data));
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="পরীক্ষা ব্যবস্থাপনা" subtitle="পরীক্ষার তালিকা ও ফেল মার্ক নির্ধারণ করুন" />
      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2">
          <ExamList exams={exams} reload={loadAll} />
        </div>
        <FailMarkSetting value={failMark} reload={loadAll} />
      </div>
    </div>
  );
}
