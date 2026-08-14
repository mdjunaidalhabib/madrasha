import { useCallback, useEffect, useState } from "react";
import { Pencil, Star, Trash2 } from "lucide-react";
import { sessionApi, type Session } from "../../services/sessionApi";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";
import { logger } from "../../utils/logger";

const normalizeArray = (payload: any): Session[] => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const emptyForm = { name: "", start_date: "", end_date: "" };

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" });
};

const SessionPage = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await sessionApi.list();
      setSessions(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD SESSIONS ERROR:", err);
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.start_date || !form.end_date) {
      useToastStore.getState().show("নাম, শুরুর তারিখ ও শেষের তারিখ দিন", "error");
      return;
    }
    if (form.start_date >= form.end_date) {
      useToastStore.getState().show("শুরুর তারিখ শেষের তারিখের আগে হতে হবে", "error");
      return;
    }
    try {
      setSaving(true);
      await sessionApi.create({
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
      });
      useToastStore.getState().show("সেশন তৈরি হয়েছে", "success");
      setForm(emptyForm);
      loadSessions();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সেশন তৈরি করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (session: Session) => {
    setEditTarget(session);
    setEditForm({
      name: session.name,
      start_date: session.startDate.slice(0, 10),
      end_date: session.endDate.slice(0, 10),
    });
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim() || !editForm.start_date || !editForm.end_date) {
      useToastStore.getState().show("নাম, শুরুর তারিখ ও শেষের তারিখ দিন", "error");
      return;
    }
    if (editForm.start_date >= editForm.end_date) {
      useToastStore.getState().show("শুরুর তারিখ শেষের তারিখের আগে হতে হবে", "error");
      return;
    }
    try {
      setEditSaving(true);
      await sessionApi.update(editTarget.id, {
        name: editForm.name.trim(),
        start_date: editForm.start_date,
        end_date: editForm.end_date,
      });
      useToastStore.getState().show("সেশন আপডেট হয়েছে", "success");
      setEditTarget(null);
      loadSessions();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সেশন আপডেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleSetCurrent = async (session: Session) => {
    try {
      await sessionApi.setCurrent(session.id);
      useToastStore.getState().show(`"${session.name}" এখন চলমান সেশন`, "success");
      loadSessions();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "চলমান সেশন সেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  const handleDelete = async (session: Session) => {
    if (!window.confirm(`"${session.name}" সেশনটি মুছে ফেলতে চান?`)) return;
    try {
      await sessionApi.remove(session.id);
      useToastStore.getState().show("সেশন মুছে ফেলা হয়েছে", "success");
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err: any) {
      const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 dark:bg-slate-950 sm:p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 sm:text-2xl">সেশন সেটাপ</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            শিক্ষাবর্ষ/সেশন তৈরি করুন — প্রতিটি সেশনের শুরু ও শেষের তারিখ অনুযায়ী মাসিক ফি
            স্বয়ংক্রিয়ভাবে হিসাব হবে
          </p>
        </div>

        <div className="mb-4 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">নতুন সেশন তৈরি করুন</h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              type="text"
              placeholder="সেশনের নাম (যেমন: ২০২৬)"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[180px]"
            />
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            />
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[160px]"
            />
            <button
              type="button"
              disabled={saving}
              onClick={handleCreate}
              className="h-9 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              তৈরি করুন
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
          {sessions.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-slate-400">কোনো সেশন নেই</div>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2.5 text-sm transition hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-gray-800 dark:text-slate-200">{session.name}</span>
                      {session.isCurrent && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          চলমান
                        </span>
                      )}
                      {!session.isActive && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          নিষ্ক্রিয়
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                      {formatDate(session.startDate)} – {formatDate(session.endDate)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    {!session.isCurrent && (
                      <button
                        type="button"
                        title="চলমান সেশন হিসেবে সেট করুন"
                        onClick={() => handleSetCurrent(session)}
                        className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="এডিট"
                      onClick={() => openEditModal(session)}
                      className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title="মুছুন"
                      onClick={() => handleDelete(session)}
                      className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={!!editTarget} title={`সেশন এডিট করুন — ${editTarget?.name || ""}`} onClose={() => setEditTarget(null)}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">নাম</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">শুরুর তারিখ</label>
            <input
              type="date"
              value={editForm.start_date}
              onChange={(e) => setEditForm((p) => ({ ...p, start_date: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">শেষের তারিখ</label>
            <input
              type="date"
              value={editForm.end_date}
              onChange={(e) => setEditForm((p) => ({ ...p, end_date: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditTarget(null)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={editSaving}
            onClick={handleUpdate}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {editSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default SessionPage;
