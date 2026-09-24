import { useEffect, useState } from "react";
import { cachedGet } from "../../../services/api";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import ExamList from "../../../components/ExamPanel/ExamList";

export default function ExamSettingsPage() {
  const [exams, setExams] = useState([]);
  const [divisions, setDivisions] = useState<{ division_id: number; division_name_bn: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [e, d] = await Promise.all([cachedGet("/exams"), cachedGet("/madrasa-divisions")]);
      setExams(e.data);
      setDivisions(Array.isArray(d.data) ? d.data : []);
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
      <PageHeader title="পরীক্ষা ব্যবস্থাপনা" subtitle="বিভাগভিত্তিক পরীক্ষার তালিকা তৈরি ও ব্যবস্থাপনা করুন" />
      {loadError && exams.length === 0 ? (
        <ErrorState
          title="তথ্য লোড করা যায়নি"
          message="পরীক্ষার তালিকা আনতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
          onRetry={loadAll}
          retryText="আবার চেষ্টা করুন"
        />
      ) : (
        <ExamList exams={exams} divisions={divisions} reload={loadAll} loading={loading} />
      )}
    </div>
  );
}
