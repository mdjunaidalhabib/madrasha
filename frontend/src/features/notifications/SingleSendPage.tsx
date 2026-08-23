import { useEffect, useMemo, useState } from "react";
import {
  notificationApi,
  type AudienceStudent,
  type AudienceTeacher,
  type NotificationChannel,
} from "../../services/phase4Api";
import { useToastStore } from "../../store/toastStore";
import { logger } from "../../utils/logger";
import NotificationComposeForm from "./NotificationComposeForm";
import MessageCreditNotice from "../billing/MessageCreditNotice";

type AudienceType = "student" | "teacher" | "custom";
type SelectedRecipient = { label: string; to: string } | null;

const SingleSendPage = () => {
  const [audienceType, setAudienceType] = useState<AudienceType>("custom");
  const [students, setStudents] = useState<AudienceStudent[]>([]);
  const [teachers, setTeachers] = useState<AudienceTeacher[]>([]);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedRecipient>(null);
  const [customTo, setCustomTo] = useState("");

  const [channel, setChannel] = useState<NotificationChannel>("SMS");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [creditBlocked, setCreditBlocked] = useState(false);

  useEffect(() => {
    setSelected(null);
    setSearch("");
    setCustomTo("");
    if (audienceType === "custom") return;
    (async () => {
      try {
        setLoadingAudience(true);
        if (audienceType === "student") {
          const res = await notificationApi.audienceStudents();
          setStudents(res.data.data || []);
        } else {
          const res = await notificationApi.audienceTeachers();
          setTeachers(res.data.data || []);
        }
      } catch (err) {
        logger.error("LOAD AUDIENCE ERROR:", err);
      } finally {
        setLoadingAudience(false);
      }
    })();
  }, [audienceType]);

  // Custom-number mode has no "pick from list" step - selection follows
  // the typed value directly instead of a button click.
  useEffect(() => {
    if (audienceType !== "custom") return;
    const trimmed = customTo.trim();
    setSelected(trimmed ? { label: trimmed, to: trimmed } : null);
  }, [audienceType, customTo]);

  const filteredStudents = useMemo(
    () =>
      students.filter(
        (s) => !search.trim() || s.name.includes(search) || String(s.roll).includes(search),
      ),
    [students, search],
  );
  const filteredTeachers = useMemo(
    () => teachers.filter((t) => !search.trim() || t.name.includes(search)),
    [teachers, search],
  );

  const pick = (label: string, to: string | null) => {
    if (!to) {
      useToastStore.getState().show(`এই ${channel === "SMS" ? "নম্বর" : "ইমেইল"} পাওয়া যায়নি`, "error");
      return;
    }
    setSelected({ label, to });
  };

  const handleSend = async () => {
    if (!selected) return;
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
      const res = await notificationApi.send({
        channel,
        recipients: [selected.to],
        subject: channel === "EMAIL" ? subject.trim() : undefined,
        message: message.trim(),
      });
      const data = (res.data as any)?.data;
      useToastStore
        .getState()
        .show(`পাঠানো হয়েছে: ${data?.sent ?? 0} জন, ব্যর্থ: ${data?.failed ?? 0} জন`, "success");
      setMessage("");
      setSubject("");
      setSelected(null);
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
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">একক পাঠান</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            একজন নির্দিষ্ট শিক্ষার্থীর অভিভাবক বা শিক্ষককে SMS/ইমেইল পাঠান
          </p>
        </div>

        <NotificationComposeForm
          channel={channel}
          onChannelChange={setChannel}
          subject={subject}
          onSubjectChange={setSubject}
          message={message}
          onMessageChange={setMessage}
          recipientCount={selected ? 1 : 0}
          sending={sending}
          onSend={handleSend}
          sendDisabled={creditBlocked}
          creditNotice={
            <MessageCreditNotice channel={channel} message={message} onDisabledChange={setCreditBlocked} />
          }
        >
          <div>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setAudienceType("custom")}
                className={`h-8 rounded-md px-3 text-xs font-medium transition ${
                  audienceType === "custom" ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {channel === "SMS" ? "নম্বর লিখুন" : "ইমেইল লিখুন"}
              </button>
              <button
                type="button"
                onClick={() => setAudienceType("student")}
                className={`h-8 rounded-md px-3 text-xs font-medium transition ${
                  audienceType === "student" ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                শিক্ষার্থী
              </button>
              <button
                type="button"
                onClick={() => setAudienceType("teacher")}
                className={`h-8 rounded-md px-3 text-xs font-medium transition ${
                  audienceType === "teacher" ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                শিক্ষক
              </button>
            </div>

            {audienceType === "custom" ? (
              <input
                type="text"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                placeholder={channel === "SMS" ? "যেমন: 01712345678" : "যেমন: example@mail.com"}
                className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            ) : selected ? (
              <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/30">
                <span className="text-blue-800 dark:text-blue-300">{selected.label} — {selected.to}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-blue-600 underline dark:text-blue-400">
                  বদলান
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="নাম বা রোল দিয়ে খুঁজুন..."
                  className="mb-2 h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-slate-700">
                  {loadingAudience ? (
                    <div className="p-3 text-center text-xs text-gray-400">লোড হচ্ছে...</div>
                  ) : audienceType === "student" ? (
                    filteredStudents.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">কেউ পাওয়া যায়নি</div>
                    ) : (
                      filteredStudents.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => pick(`${s.name} (রোল ${s.roll})`, channel === "SMS" ? s.phone : null)}
                          className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                          {s.name} <span className="text-xs text-gray-400">রোল {s.roll} · {s.phone}</span>
                        </button>
                      ))
                    )
                  ) : filteredTeachers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">কেউ পাওয়া যায়নি</div>
                  ) : (
                    filteredTeachers.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => pick(t.name, channel === "SMS" ? t.phone : t.email)}
                        className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        {t.name} <span className="text-xs text-gray-400">{channel === "SMS" ? t.phone : t.email}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </NotificationComposeForm>
      </div>
    </div>
  );
};

export default SingleSendPage;
