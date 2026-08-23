import { useEffect, useMemo, useState } from "react";
import { cachedGet } from "../../services/api";
import {
  notificationApi,
  type AudienceResult,
  type AudienceStudent,
  type AudienceTeacher,
  type NotificationChannel,
  type NotificationRecipient,
} from "../../services/phase4Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";
import NotificationComposeForm from "./NotificationComposeForm";
import MessageCreditNotice from "../billing/MessageCreditNotice";

type AudienceMode = "all_students" | "class_students" | "all_teachers" | "results";

type Division = { id: number; nameBn: string };
type ClassRow = { id: number; nameBn: string };
type Exam = { id: number; name: string };

type Recipient = { to: string; vars: Record<string, string | number> };

const AUDIENCE_LABELS: Record<AudienceMode, string> = {
  all_students: "সব শিক্ষার্থী",
  class_students: "নির্দিষ্ট ক্লাস",
  all_teachers: "সব শিক্ষক",
  results: "রেজাল্ট (এক্সাম)",
};

const normalizeArray = (payload: any) => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const BulkSendPage = () => {
  const [mode, setMode] = useState<AudienceMode>("all_students");
  const [channel, setChannel] = useState<NotificationChannel>("SMS");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [creditBlocked, setCreditBlocked] = useState(false);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [divisionId, setDivisionId] = useState("");
  const [classId, setClassId] = useState("");
  const [examId, setExamId] = useState("");

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingAudience, setLoadingAudience] = useState(false);

  useEffect(() => {
    if (mode === "class_students" || mode === "results") {
      cachedGet("/madrasa-divisions")
        .then((res) => setDivisions(normalizeArray(res)))
        .catch((err) => logger.error("LOAD DIVISIONS ERROR:", err));
    }
    if (mode === "results") {
      cachedGet("/exams")
        .then((res) => setExams(normalizeArray(res)))
        .catch((err) => logger.error("LOAD EXAMS ERROR:", err));
    }
  }, [mode]);

  useEffect(() => {
    setClassId("");
    setClasses([]);
    if (!divisionId) return;
    cachedGet(`/madrasa-classes?division_id=${divisionId}`)
      .then((res) => setClasses(normalizeArray(res)))
      .catch((err) => logger.error("LOAD CLASSES ERROR:", err));
  }, [divisionId]);

  // Resolve the recipient list whenever the audience selection is complete.
  useEffect(() => {
    setRecipients([]);

    const load = async () => {
      try {
        setLoadingAudience(true);
        if (mode === "all_students") {
          const res = await notificationApi.audienceStudents();
          setRecipients(toStudentRecipients(res.data.data || [], channel));
        } else if (mode === "class_students") {
          if (!classId) return;
          const res = await notificationApi.audienceStudents({ classId: Number(classId) });
          setRecipients(toStudentRecipients(res.data.data || [], channel));
        } else if (mode === "all_teachers") {
          const res = await notificationApi.audienceTeachers();
          setRecipients(toTeacherRecipients(res.data.data || [], channel));
        } else if (mode === "results") {
          if (!classId || !examId) return;
          const res = await notificationApi.audienceResults({
            examId: Number(examId),
            classId: Number(classId),
          });
          setRecipients(toResultRecipients(res.data.data || [], channel));
        }
      } catch (err) {
        logger.error("LOAD AUDIENCE ERROR:", err);
      } finally {
        setLoadingAudience(false);
      }
    };
    load();
  }, [mode, classId, examId, channel]);

  const messageHint = useMemo(() => {
    if (mode === "results") return "প্লেসহোল্ডার: {name} {roll} {gpa} {grade}";
    if (mode === "all_teachers") return "প্লেসহোল্ডার: {name}";
    return "প্লেসহোল্ডার: {name} {roll}";
  }, [mode]);

  const handleSend = async () => {
    if (recipients.length === 0) return;
    if (!message.trim()) {
      useToastStore.getState().show("মেসেজ লিখুন", "error");
      return;
    }
    if (channel === "EMAIL" && !subject.trim()) {
      useToastStore.getState().show("ইমেইলের জন্য সাবজেক্ট দিন", "error");
      return;
    }

    try {
      setSending(true);
      const payloadRecipients: NotificationRecipient[] = recipients.map((r) => ({
        to: r.to,
        vars: r.vars,
      }));
      const res = await notificationApi.send({
        channel,
        recipients: payloadRecipients,
        subject: channel === "EMAIL" ? subject.trim() : undefined,
        message: message.trim(),
      });
      const data = (res.data as any)?.data;
      useToastStore
        .getState()
        .show(`পাঠানো হয়েছে: ${data?.sent ?? 0} জন, ব্যর্থ: ${data?.failed ?? 0} জন`, "success");
      setMessage("");
      setSubject("");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "পাঠাতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">বাল্ক পাঠান</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            একসাথে অনেকজনকে SMS/ইমেইল পাঠান — প্রতিজনের নাম/রোল/নম্বর মেসেজে বসিয়ে দেওয়া যাবে
          </p>
        </div>

        <NotificationComposeForm
          channel={channel}
          onChannelChange={setChannel}
          subject={subject}
          onSubjectChange={setSubject}
          message={message}
          onMessageChange={setMessage}
          messageHint={messageHint}
          recipientCount={recipients.length}
          sending={sending}
          onSend={handleSend}
          sendLabel="সবাইকে পাঠান"
          sendDisabled={creditBlocked}
          creditNotice={
            <MessageCreditNotice channel={channel} message={message} onDisabledChange={setCreditBlocked} />
          }
        >
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {(Object.keys(AUDIENCE_LABELS) as AudienceMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`h-8 rounded-md px-3 text-xs font-medium transition ${
                    mode === m ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {AUDIENCE_LABELS[m]}
                </button>
              ))}
            </div>

            {(mode === "class_students" || mode === "results") && (
              <div className="mb-2 flex flex-wrap gap-2">
                <select
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-gray-300 px-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">বিভাগ বাছুন</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nameBn}
                    </option>
                  ))}
                </select>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={!divisionId}
                  className="h-9 flex-1 rounded-md border border-gray-300 px-2 text-sm outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">ক্লাস বাছুন</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameBn}
                    </option>
                  ))}
                </select>
                {mode === "results" && (
                  <select
                    value={examId}
                    onChange={(e) => setExamId(e.target.value)}
                    className="h-9 flex-1 rounded-md border border-gray-300 px-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">পরীক্ষা বাছুন</option>
                    {exams.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-slate-400">
              {loadingAudience ? "লোড হচ্ছে..." : `${recipients.length} জন প্রাপক নির্বাচিত`}
            </p>
            {!loadingAudience && recipients.length === 0 && channel === "EMAIL" && mode !== "all_teachers" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                শিক্ষার্থীদের কোনো ইমেইল ঠিকানা নেই — এই তালিকার জন্য শুধু SMS ব্যবহার করুন
              </p>
            )}
          </div>
        </NotificationComposeForm>
      </div>
    </div>
  );
};

function toStudentRecipients(rows: AudienceStudent[], channel: NotificationChannel): Recipient[] {
  if (channel !== "SMS") return [];
  return rows.map((s) => ({ to: s.phone, vars: { name: s.name, roll: s.roll } }));
}

function toTeacherRecipients(rows: AudienceTeacher[], channel: NotificationChannel): Recipient[] {
  return rows
    .filter((t) => (channel === "SMS" ? t.phone : t.email))
    .map((t) => ({ to: (channel === "SMS" ? t.phone : t.email) as string, vars: { name: t.name } }));
}

function toResultRecipients(rows: AudienceResult[], channel: NotificationChannel): Recipient[] {
  if (channel !== "SMS") return [];
  return rows.map((r) => ({
    to: r.phone,
    vars: { name: r.name, roll: r.roll, gpa: r.gpa, grade: r.grade },
  }));
}

export default BulkSendPage;
