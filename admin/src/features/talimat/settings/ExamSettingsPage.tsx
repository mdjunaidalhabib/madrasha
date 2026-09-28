import { useEffect, useState } from "react";
import { cachedGet } from "../../../services/api";
import PageHeader from "@madrasha/shared-ui/src/components/ui/PageHeader";
import ErrorState from "@madrasha/shared-ui/src/components/ui/ErrorState";
import ExamList from "../../../components/ExamPanel/ExamList";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { talimatSettingsText } from "./talimatSettings.text";

export default function ExamSettingsPage() {
  const t = useText(talimatSettingsText);
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
      <PageHeader title={t.examTitle} subtitle={t.examSubtitle} />
      {loadError && exams.length === 0 ? (
        <ErrorState
          title={t.loadErrorTitle}
          message={t.examLoadError}
          onRetry={loadAll}
          retryText={t.retry}
        />
      ) : (
        <ExamList exams={exams} divisions={divisions} reload={loadAll} loading={loading} />
      )}
    </div>
  );
}
