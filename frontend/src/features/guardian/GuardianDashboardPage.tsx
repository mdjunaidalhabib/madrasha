import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  CircleAlert,
  Clock3,
  GraduationCap,
  Megaphone,
  RefreshCw,
  UserRound,
  Wallet,
} from "lucide-react";
import guardianApi from "../../services/guardianApi";
import { useGuardianAuthStore } from "../../store/guardianAuthStore";
import { getTenantGuardianBase } from "../../utils/tenantSlug";
import { useTenantSlug } from "../../utils/useTenantSlug";
import EmptyState from "@madrasha/shared-ui/src/components/ui/EmptyState";
import {
  formatCurrency,
  formatDate,
  localizeDigits,
  useLang,
  useText,
} from "@madrasha/shared-ui/src/i18n";
import { guardianText } from "./guardian.text";

type Attendance = {
  summary?: {
    percentage?: number;
    PRESENT?: number;
    ABSENT?: number;
    LATE?: number;
    LEAVE?: number;
  };
};
type Fees = { summary?: { totalDue?: number; totalPaid?: number; totalBilled?: number } };
type Exam = {
  id: number;
  examName: string;
  subject: string;
  examDate: string;
  startTime?: string;
  endTime?: string;
};
type Notice = { id: number; title: string; content?: string; publishedAt?: string };
type Overview = {
  attendance?: Attendance;
  results?: unknown[];
  fees?: Fees;
  exams?: Exam[];
  notices?: Notice[];
};

export default function GuardianDashboardPage() {
  const t = useText(guardianText);
  const lang = useLang();
  const selectedStudentId = useGuardianAuthStore((s) => s.selectedStudentId);
  const children = useGuardianAuthStore((s) => s.children);
  const base = getTenantGuardianBase(useTenantSlug());
  const [data, setData] = useState<Overview>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const child = children.find((c) => c.id === selectedStudentId);
  const n = (value: number | string) => localizeDigits(value, lang);

  useEffect(() => {
    if (!selectedStudentId) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    setData({});
    const root = `/guardian/students/${selectedStudentId}`;
    void Promise.allSettled([
      guardianApi.get(`${root}/attendance`),
      guardianApi.get(`${root}/results`),
      guardianApi.get(`${root}/fees`),
      guardianApi.get(`${root}/exam-routine`),
      guardianApi.get("/guardian/notices"),
    ]).then(([attendance, results, fees, exams, notices]) => {
      if (!active) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setData({
        attendance: attendance.status === "fulfilled" ? attendance.value.data?.data : undefined,
        results: results.status === "fulfilled" ? results.value.data?.data || [] : undefined,
        fees: fees.status === "fulfilled" ? fees.value.data?.data : undefined,
        exams:
          exams.status === "fulfilled"
            ? ((exams.value.data?.data || []) as Exam[])
                .filter((row) => new Date(row.examDate) >= today)
                .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime())
            : undefined,
        notices:
          notices.status === "fulfilled"
            ? ((notices.value.data?.data || []) as Notice[]).sort(
                (a, b) =>
                  new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime(),
              )
            : undefined,
      });
      setFailed(
        [attendance, results, fees, exams, notices].some((item) => item.status === "rejected"),
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [selectedStudentId, retry]);

  if (!selectedStudentId) return <EmptyState title={t.noChild} hint={t.noChildHint} />;
  const summary = data.attendance?.summary;
  const percentage = Math.min(100, Math.max(0, Number(summary?.percentage) || 0));
  const recorded =
    (summary?.PRESENT || 0) + (summary?.ABSENT || 0) + (summary?.LATE || 0) + (summary?.LEAVE || 0);
  const stats = [
    {
      label: t.attendanceRate,
      value: data.attendance ? `${n(percentage)}%` : "—",
      icon: CalendarCheck,
      tone: "green",
      to: "attendance",
      hint: t.attendanceOverview,
    },
    {
      label: t.publishedResults,
      value: data.results ? n(data.results.length) : "—",
      icon: GraduationCap,
      tone: "purple",
      to: "results",
      hint: t.resultsSubtitle,
    },
    {
      label: t.upcomingExams,
      value: data.exams ? n(data.exams.length) : "—",
      icon: CalendarDays,
      tone: "orange",
      to: "exam-routine",
      hint: t.examRoutine,
    },
    {
      label: t.dueFees,
      value: data.fees ? formatCurrency(data.fees.summary?.totalDue || 0, lang) : "—",
      icon: Wallet,
      tone: "rose",
      to: "fees",
      hint: t.feesSubtitle,
    },
  ];
  const shortcuts = [
    { to: "leave", icon: ClipboardList, title: t.leave, description: t.applyLeave },
    { to: "results", icon: GraduationCap, title: t.results, description: t.viewMarksheet },
    { to: "exam-routine", icon: CalendarDays, title: t.examRoutine, description: t.upcomingExams },
    { to: "profile", icon: UserRound, title: t.childProfile, description: t.viewProfile },
  ];
  const unavailable = <p className="guardian-empty">{t.overviewError}</p>;
  const placeholder = (
    <div className="guardian-loading" role="status">
      <span />
      {t.loadingOverview}
    </div>
  );
  return (
    <div className="guardian-dashboard" aria-busy={loading}>
      <section className="guardian-welcome">
        <div className="guardian-welcome-copy">
          <span className="guardian-welcome-label">
            <BookOpen size={16} />
            {t.studentOverview}
          </span>
          <h2>{child?.nameBn || t.childProfile}</h2>
          <div className="guardian-student-meta">
            <span>{child?.className || t.class}</span>
            <span>
              {t.roll}: {n(child?.roll ?? "—")}
            </span>
            <span>
              {t.regShort} {n(child?.registrationNo ?? "—")}
            </span>
          </div>
          <div className="guardian-summary-statuses">
            {[
              {
                label: t.studentStatus,
                value: child?.isActive === 1 ? t.studentActive : child?.isActive === 0 ? t.studentInactive : "—",
                tone: child?.isActive === 1 ? "positive" : child?.isActive === 0 ? "negative" : "unknown",
              },
              {
                label: t.admissionStatus,
                value: child?.admissionStatus === "APPROVED" ? t.admissionApproved : child?.admissionStatus === "PENDING" ? t.admissionPending : child?.admissionStatus === "REJECTED" ? t.admissionRejected : "—",
                tone: child?.admissionStatus === "APPROVED" ? "positive" : child?.admissionStatus === "PENDING" ? "pending" : child?.admissionStatus === "REJECTED" ? "negative" : "unknown",
              },
            ].map(({ label, value, tone }) => {
              const Icon = tone === "positive" ? CheckCircle2 : tone === "pending" ? Clock3 : CircleAlert;
              return <span key={label} className={`guardian-summary-status is-${tone}`}>
                <span>{label}</span><strong><Icon size={17} aria-hidden="true" />{value}</strong>
              </span>;
            })}
          </div>
          <Link className="guardian-light-button" to={`${base}/profile`}>
            <UserRound size={16} />
            {t.viewProfile}
          </Link>
        </div>
        <div className="guardian-welcome-art" aria-hidden="true">
          <div className="guardian-student-portrait">
            {child?.image ? <img src={child.image} alt="" /> : <UserRound size={64} strokeWidth={1.3} />}
          </div>
        </div>
      </section>
      {failed && (
        <div className="guardian-error" role="alert">
          <span>{t.overviewError}</span>
          <button onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw size={15} />
            {t.tryAgain}
          </button>
        </div>
      )}
      <div className="guardian-stats">
        {stats.map(({ label, value, icon: Icon, tone, to, hint }) => (
          <Link to={`${base}/${to}`} className={`guardian-stat guardian-tone-${tone}`} key={to}>
            <div className="guardian-stat-top">
              <span>{label}</span>
              <span className="guardian-stat-icon">
                <Icon size={22} strokeWidth={1.7} />
              </span>
            </div>
            {loading ? <div className="guardian-stat-skeleton" /> : <strong>{value}</strong>}
            <p>{hint}</p>
          </Link>
        ))}
      </div>
      <div className="guardian-overview-grid">
        <section className="guardian-card">
          <div className="guardian-card-heading">
            <h2>{t.attendanceOverview}</h2>
            <Link to={`${base}/attendance`}>{t.viewAll}</Link>
          </div>
          {loading ? (
            placeholder
          ) : !data.attendance ? (
            unavailable
          ) : recorded === 0 ? (
            <p className="guardian-empty">
              <CalendarCheck size={28} />
              {t.noAttendance}
            </p>
          ) : (
            <div className="guardian-attendance-body">
              <div
                className="guardian-attendance-ring"
                style={{ background: `conic-gradient(#16866a ${percentage}%, #edf2ef 0)` }}
              >
                <div>
                  <strong>
                    {n(percentage)}
                    <small>%</small>
                  </strong>
                  <span>{t.attendanceRate}</span>
                </div>
              </div>
              <div className="guardian-attendance-legend">
                {(["PRESENT", "ABSENT", "LATE", "LEAVE"] as const).map((key) => (
                  <div key={key}>
                    <span>
                      <i className={`guardian-dot-${key.toLowerCase()}`} />
                      {t.attendanceStatus[key]}
                    </span>
                    <strong>{n(summary?.[key] || 0)}</strong>
                  </div>
                ))}
                <p>
                  {t.recordedDays}: {n(recorded)}
                </p>
              </div>
            </div>
          )}
        </section>
        <section className="guardian-card">
          <div className="guardian-card-heading">
            <h2>{t.academicCalendar}</h2>
            <Link to={`${base}/exam-routine`}>{t.viewAll}</Link>
          </div>
          {loading ? (
            placeholder
          ) : !data.exams ? (
            unavailable
          ) : data.exams.length === 0 ? (
            <p className="guardian-empty">
              <CalendarDays size={28} />
              {t.noRoutine}
              <span>{t.noRoutineHint}</span>
            </p>
          ) : (
            <div className="guardian-exams">
              {data.exams.slice(0, 3).map((exam) => (
                <div className="guardian-exam" key={exam.id}>
                  <div className="guardian-exam-date">
                    <strong>{formatDate(exam.examDate, lang, { day: "2-digit" })}</strong>
                    <span>{formatDate(exam.examDate, lang, { month: "short" })}</span>
                  </div>
                  <div>
                    <h3>{exam.subject}</h3>
                    <p>{exam.examName}</p>
                    {exam.startTime && (
                      <span>
                        {n(exam.startTime)}
                        {exam.endTime ? ` – ${n(exam.endTime)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="guardian-card guardian-quick-access">
          <div className="guardian-card-heading">
            <div>
              <h2>{t.quickAccess}</h2>
              <p>{t.quickAccessHint}</p>
            </div>
          </div>
          <div className="guardian-shortcuts">
            {shortcuts.map(({ to, icon: Icon, title, description }) => (
              <Link to={`${base}/${to}`} key={to}>
                <span>
                  <Icon size={22} strokeWidth={1.6} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section className="guardian-card">
          <div className="guardian-card-heading">
            <h2>{t.latestNotices}</h2>
            <Link to={`${base}/notices`}>{t.viewAll}</Link>
          </div>
          {loading ? (
            placeholder
          ) : !data.notices ? (
            unavailable
          ) : data.notices.length === 0 ? (
            <p className="guardian-empty">
              <Megaphone size={28} />
              {t.noNotices}
            </p>
          ) : (
            <div className="guardian-notice-list">
              {data.notices.slice(0, 3).map((notice) => (
                <Link to={`${base}/notices`} key={notice.id}>
                  <span className="guardian-notice-icon">
                    <Megaphone size={17} />
                  </span>
                  <div>
                    <h3>{notice.title}</h3>
                    {notice.content && <p>{notice.content}</p>}
                    {notice.publishedAt && (
                      <time dateTime={notice.publishedAt}>
                        {formatDate(notice.publishedAt, lang)}
                      </time>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
