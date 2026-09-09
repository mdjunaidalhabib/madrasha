import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Star, Trash2 } from "lucide-react";
import { sessionApi, type Session } from "../../services/sessionApi";
import { cachedGet } from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { logger } from "@madrasha/shared-ui/src/utils/logger";

type Division = { division_id: number; division_name_bn: string };

const normalizeArray = (payload: any): Session[] => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const normalizeDivisions = (payload: any): Division[] => {
  const data = payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
};

const GENERIC_DIVISION_KEY = "generic";

const emptyForm = { name: "", division_id: "", start_date: "", end_date: "" };

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" });
};

const SessionPage = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  // useConfirmStore-এর onConfirm শেষে finally ব্লকে hide() কল হয়, তাই এখান
  // থেকে দ্বিতীয় useConfirmStore.show() ডাকলে সেটা সাথে সাথে বন্ধ হয়ে যাবে —
  // তাই "ছাত্র আছে" কেসের জন্য আলাদা লোকাল স্টেট + Modal ব্যবহার করা হচ্ছে।
  const [blockedDelete, setBlockedDelete] = useState<{
    session: Session;
    message: string;
    action: "students" | "trash" | "rejected" | "fee_structures" | "fee_locked";
  } | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await sessionApi.list();
      setSessions(normalizeArray(res));
    } catch (err) {
      logger.error("LOAD SESSIONS ERROR:", err);
      setSessions([]);
    }
  }, []);

  const loadDivisions = useCallback(async () => {
    try {
      const res = await cachedGet("/madrasa-divisions");
      setDivisions(normalizeDivisions(res));
    } catch (err) {
      logger.error("LOAD DIVISIONS ERROR:", err);
      setDivisions([]);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadDivisions();
  }, [loadSessions, loadDivisions]);

  // বিভাগ অনুযায়ী গ্রুপ করা সেশন তালিকা — "সাধারণ (সকল বিভাগ)" সবসময় প্রথমে
  // (divisionId null), তারপর যেসব বিভাগে অন্তত একটি সেশন আছে সেগুলো নাম
  // অনুযায়ী ক্রমানুসারে। খালি বিভাগ সেকশন দেখানো হয় না।
  const groupedSessions = useMemo(() => {
    type Group = { key: string; label: string; items: Session[] };

    const generic = sessions.filter((s) => s.divisionId === null || s.divisionId === undefined);
    const byDivision = new Map<number, Session[]>();
    sessions.forEach((s) => {
      if (s.divisionId === null || s.divisionId === undefined) return;
      if (!byDivision.has(s.divisionId)) byDivision.set(s.divisionId, []);
      byDivision.get(s.divisionId)!.push(s);
    });

    const divisionGroups: Group[] = Array.from(byDivision.entries())
      .map(([divisionId, items]) => {
        const label =
          items[0]?.division?.nameBn ||
          items[0]?.division?.name ||
          divisions.find((d) => d.division_id === divisionId)?.division_name_bn ||
          `বিভাগ #${divisionId}`;
        return { key: String(divisionId), label, items };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "bn"));

    const groups: Group[] = [];
    if (generic.length > 0) {
      groups.push({ key: GENERIC_DIVISION_KEY, label: "সাধারণ (সকল বিভাগ)", items: generic });
    }
    return [...groups, ...divisionGroups];
  }, [sessions, divisions]);

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
        division_id: form.division_id ? Number(form.division_id) : null,
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
      division_id: session.divisionId != null ? String(session.divisionId) : "",
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
        division_id: editForm.division_id ? Number(editForm.division_id) : null,
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
      useToastStore.getState().show(`"${session.name}" এখন সক্রিয় সেশন`, "success");
      loadSessions();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "সক্রিয় সেশন সেট করতে সমস্যা হয়েছে";
      useToastStore.getState().show(msg, "error");
    }
  };

  const handleDelete = (session: Session) => {
    useConfirmStore.getState().show({
      title: "সেশন মুছে ফেলবেন?",
      message: `"${session.name}" সেশনটি স্থায়ীভাবে মুছে যাবে। এটি আর ফিরিয়ে আনা যাবে না।`,
      confirmText: "মুছে ফেলুন",
      danger: true,
      onConfirm: async () => {
        try {
          await sessionApi.remove(session.id);
          useToastStore.getState().show("সেশন মুছে ফেলা হয়েছে", "success");
          setSessions((prev) => prev.filter((s) => s.id !== session.id));
        } catch (err: any) {
          const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
          // ট্র্যাশে থাকা ছাত্র এবং বাতিল হওয়া আবেদন কোনোটাই ছাত্র-তালিকায়
          // দেখা যায় না, তাই প্রতিটার জন্য আলাদা "কোথায় গিয়ে ঠিক করবে" পথ -
          // ট্র্যাশ পেজ, সরাসরি এক-ক্লিক মুছে ফেলা, বা ছাত্র তালিকা। ইনভয়েস
          // থাকা ফি কাঠামোর কেসে কোনো অ্যাকশন বাটন নেই - হিসাবের তথ্য সুরক্ষার
          // জন্য এটা কখনও bulk-delete করা হয় না, শুধু কারণটা স্পষ্ট করে জানানো হয়।
          if (typeof msg !== "string") {
            useToastStore.getState().show(msg, "error");
          } else if (msg.includes("ট্র্যাশ")) {
            setBlockedDelete({ session, message: msg, action: "trash" });
          } else if (msg.includes("বাতিল হওয়া")) {
            setBlockedDelete({ session, message: msg, action: "rejected" });
          } else if (msg.includes("ইনভয়েস/পেমেন্ট")) {
            setBlockedDelete({ session, message: msg, action: "fee_locked" });
          } else if (msg.includes("ফি কাঠামো")) {
            setBlockedDelete({ session, message: msg, action: "fee_structures" });
          } else if (msg.includes("ছাত্র")) {
            setBlockedDelete({ session, message: msg, action: "students" });
          } else {
            useToastStore.getState().show(msg, "error");
          }
        }
      },
    });
  };

  const handleCleanupFeeStructures = (session: Session) => {
    useConfirmStore.getState().show({
      title: "ফি কাঠামো মুছে ফেলবেন?",
      message: `"${session.name}" সেশনের ফি কাঠামোগুলো (কোনো ইনভয়েস তৈরি হয়নি এমনগুলো) স্থায়ীভাবে মুছে যাবে। এটি আর ফিরিয়ে আনা যাবে না।`,
      confirmText: "মুছে ফেলুন",
      danger: true,
      onConfirm: async () => {
        try {
          await sessionApi.removeUnusedFeeStructures(session.id);
          useToastStore
            .getState()
            .show("ফি কাঠামোগুলো মুছে ফেলা হয়েছে — এখন সেশনটি আবার মুছে ফেলার চেষ্টা করুন", "success");
        } catch (err: any) {
          const msg = err?.response?.data?.message || "মুছতে সমস্যা হয়েছে";
          useToastStore.getState().show(msg, "error");
        }
      },
    });
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
            <select
              value={form.division_id}
              onChange={(e) => setForm((p) => ({ ...p, division_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-[170px]"
            >
              <option value="">সাধারণ (সকল বিভাগ)</option>
              {divisions.map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>
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
            <div className="flex flex-col gap-5">
              {groupedSessions.map((group) => (
                <div key={group.key}>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-300">{group.label}</h3>
                  <div className="flex flex-col gap-2">
                    {group.items.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2.5 text-sm transition hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-800"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-gray-800 dark:text-slate-200">{session.name}</span>
                            {session.isActive && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                সক্রিয়
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                            {formatDate(session.startDate)} – {formatDate(session.endDate)}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          {!session.isActive && (
                            <button
                              type="button"
                              title="সক্রিয় সেশন হিসেবে সেট করুন"
                              onClick={() => handleSetCurrent(session)}
                              className="flex shrink-0 items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40"
                            >
                              <Star size={12} />
                              সক্রিয় করুন
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
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">বিভাগ</label>
            <select
              value={editForm.division_id}
              onChange={(e) => setEditForm((p) => ({ ...p, division_id: e.target.value }))}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">সাধারণ (সকল বিভাগ)</option>
              {divisions.map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_name_bn}
                </option>
              ))}
            </select>
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

      <Modal open={!!blockedDelete} title="মুছে ফেলা যাচ্ছে না" onClose={() => setBlockedDelete(null)}>
        <p className="text-sm text-gray-700 dark:text-slate-300">{blockedDelete?.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          {blockedDelete?.action === "fee_locked" ? (
            <button
              type="button"
              onClick={() => setBlockedDelete(null)}
              className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              বুঝেছি
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setBlockedDelete(null)}
                className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!blockedDelete) return;
                  const { session: blockedSession, action } = blockedDelete;
                  setBlockedDelete(null);
                  if (action === "trash") {
                    navigate("/settings/trash");
                  } else if (action === "rejected") {
                    navigate(`/students/admissions/rejected?session=${blockedSession.id}`);
                  } else if (action === "fee_structures") {
                    handleCleanupFeeStructures(blockedSession);
                  } else {
                    navigate(`/students/list?session=${blockedSession.id}`);
                  }
                }}
                className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
              >
                {blockedDelete?.action === "trash"
                  ? "ট্র্যাশে যান"
                  : blockedDelete?.action === "rejected"
                    ? "বাতিল আবেদন দেখুন"
                    : blockedDelete?.action === "fee_structures"
                      ? "ফি কাঠামো মুছে ফেলুন"
                      : "ছাত্র তালিকায় যান"}
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SessionPage;
