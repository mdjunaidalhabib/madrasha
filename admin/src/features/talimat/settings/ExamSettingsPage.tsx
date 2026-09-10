import { useEffect, useState } from "react";
import { cachedGet } from "../../../services/api";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import ExamList from "../../../components/ExamPanel/ExamList";
import FailMarkSetting from "../../../components/ExamPanel/FailMarkSetting";

export default function ExamSettingsPage() {
  const [exams, setExams] = useState([]);
  const [failMark, setFailMark] = useState(35);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [e, f] = await Promise.all([cachedGet("/exams"), cachedGet("/fail-mark")]);
      setExams(e.data);
      setFailMark(Number(f.data));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="পরীক্ষা ব্যবস্থাপনা" subtitle="পরীক্ষার তালিকা ও ফেল মার্ক নির্ধারণ করুন" />
      {loadError && exams.length === 0 ? (
        <ErrorState
          title="তথ্য লোড করা যায়নি"
          message="পরীক্ষার তালিকা আনতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
          onRetry={loadAll}
          retryText="আবার চেষ্টা করুন"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 items-start">
          <div className="lg:col-span-2">
            <ExamList exams={exams} reload={loadAll} loading={loading} />
          </div>
          <FailMarkSetting value={failMark} reload={loadAll} />
        </div>
      )}
    </div>
  );
}
