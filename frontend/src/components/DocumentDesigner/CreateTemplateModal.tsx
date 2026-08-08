import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function CreateTemplateModal({
  open,
  defaultName,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  defaultName: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const trimmed = name.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  };

  return (
    <Modal open={open} title="নতুন টেমপ্লেট তৈরি করুন" onClose={onClose} maxWidthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-xs font-medium text-slate-600">টেমপ্লেটের নাম</label>
          <input
            autoFocus
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="যেমন: হিফজ বিভাগের আইডি কার্ড"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-[11px] text-slate-400">
            নাম দিয়ে "তৈরি করুন" চাপলে খালি ডিজাইনার খুলবে — সেখানে ব্যাকগ্রাউন্ড, ফিল্ড ও লেআউট সাজানো যাবে।
          </p>
        </div>

        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            বাতিল
          </button>
          <Button type="submit" disabled={!trimmed || busy}>
            {busy ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
