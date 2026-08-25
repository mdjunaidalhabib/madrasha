import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useToastStore } from "../../store/toastStore";
import { useAccountOptions } from "./useAccountOptions";
import { normalizeBanglaDigits } from "../../utils/reportUtils";
import { AccountRow, partyName, toDateInput, toTimeInput } from "./accountHelpers";

const FieldLabel = ({ children, required = false }: { children: string; required?: boolean }) => (
  <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
    {children} {required && <span className="text-rose-600 dark:text-rose-400">*</span>}
  </label>
);

type EditForm = {
  entry_date: string;
  entry_time: string;
  no: string;
  fund: string;
  group: string;
  category: string;
  name: string;
  address: string;
  mobile: string;
  amount: string;
  payment_method: string;
  note: string;
};

const emptyEditForm: EditForm = {
  entry_date: "",
  entry_time: "",
  no: "",
  fund: "",
  group: "",
  category: "",
  name: "",
  address: "",
  mobile: "",
  amount: "",
  payment_method: "",
  note: "",
};

type Props = {
  row: AccountRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function AccountEditModal({ row, onClose, onSaved }: Props) {
  const toast = useToastStore();
  const { incomeFunds, expenseGroups, paymentMethods } = useAccountOptions();
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [saving, setSaving] = useState(false);

  const findExpenseGroup = useCallback(
    (category: string) =>
      expenseGroups.find((group) => group.categories.includes(category)) ||
      expenseGroups[0] || { name: "", categories: [] },
    [expenseGroups],
  );

  useEffect(() => {
    if (!row) return;
    setEditForm({
      entry_date: toDateInput(row.entryDate),
      entry_time: toTimeInput(row.entryTime),
      no: (row.type === "income" ? row.receiptNo : row.voucherNo) || "",
      fund: row.fund || "",
      group: row.type === "expense" ? findExpenseGroup(row.category || "").name : "",
      category: row.category || "",
      name: partyName(row) === "-" ? "" : partyName(row),
      address: row.address || "",
      mobile: row.mobile || "",
      amount: String(row.amount ?? ""),
      payment_method: row.paymentMethod || paymentMethods[0] || "",
      note: row.note || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const categoryOptions = useMemo(() => {
    if (!row) return [];
    if (row.type === "income") {
      return incomeFunds.find((f) => f.name === editForm.fund)?.categories || [];
    }
    return expenseGroups.find((g) => g.name === editForm.group)?.categories || [];
  }, [row, editForm.fund, editForm.group, incomeFunds, expenseGroups]);

  const setField = (key: keyof EditForm, value: string) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const handleFundChange = (fundName: string) => {
    const fund = incomeFunds.find((f) => f.name === fundName);
    setEditForm((prev) => ({ ...prev, fund: fundName, category: fund?.categories[0] || "" }));
  };

  const handleGroupChange = (groupName: string) => {
    const group = expenseGroups.find((g) => g.name === groupName) || expenseGroups[0] || { name: "", categories: [] };
    setEditForm((prev) => ({ ...prev, group: group.name, category: group.categories[0] || "" }));
  };

  const handleSave = async () => {
    if (!row) return;
    if (!editForm.name.trim()) return toast.push("error", "নাম দিন");
    if (!editForm.amount || !Number(editForm.amount) || Number(editForm.amount) <= 0)
      return toast.push("error", "পরিমাণ দিন");

    const payload: Record<string, string> = {
      entry_date: editForm.entry_date,
      entry_time: editForm.entry_time,
      fund: row.type === "income" ? editForm.fund : editForm.group,
      category: editForm.category,
      amount: editForm.amount,
      payment_method: editForm.payment_method,
      note: editForm.note,
      mobile: editForm.mobile,
    };
    if (row.type === "income") {
      payload.receipt_no = editForm.no;
      payload.donor_name = editForm.name;
      payload.address = editForm.address;
    } else {
      payload.voucher_no = editForm.no;
      payload.receiver_name = editForm.name;
    }

    try {
      setSaving(true);
      await api.patch(`/accounts/${row.id}`, payload);
      toast.push("success", "এন্ট্রি আপডেট হয়েছে");
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "আপডেট করতে সমস্যা হয়েছে";
      toast.push("error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!row}
      title={row?.type === "income" ? "আয় এন্ট্রি এডিট করুন" : "ব্যয় এন্ট্রি এডিট করুন"}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
    >
      {row && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>তারিখ</FieldLabel>
            <Input type="date" value={editForm.entry_date} onChange={(e) => setField("entry_date", e.target.value)} />
          </div>
          <div>
            <FieldLabel>সময়</FieldLabel>
            <Input type="time" value={editForm.entry_time} onChange={(e) => setField("entry_time", e.target.value)} />
          </div>
          <div>
            <FieldLabel>{row.type === "income" ? "রশিদ নম্বর" : "ভাউচার নম্বর"}</FieldLabel>
            <Input value={editForm.no} onChange={(e) => setField("no", e.target.value)} />
          </div>
          <div>
            <FieldLabel>{row.type === "income" ? "ফান্ড" : "ব্যয় বিভাগ"}</FieldLabel>
            {row.type === "income" ? (
              <select
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={editForm.fund}
                onChange={(e) => handleFundChange(e.target.value)}
              >
                {incomeFunds.map((fund) => (
                  <option key={fund.name}>{fund.name}</option>
                ))}
              </select>
            ) : (
              <select
                className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={editForm.group}
                onChange={(e) => handleGroupChange(e.target.value)}
              >
                {expenseGroups.map((group) => (
                  <option key={group.name}>{group.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <FieldLabel>খাত</FieldLabel>
            <select
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={editForm.category}
              onChange={(e) => setField("category", e.target.value)}
            >
              {categoryOptions.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel required>নাম</FieldLabel>
            <Input required value={editForm.name} onChange={(e) => setField("name", e.target.value)} />
          </div>
          {row.type === "income" && (
            <div>
              <FieldLabel>ঠিকানা</FieldLabel>
              <Input value={editForm.address} onChange={(e) => setField("address", e.target.value)} />
            </div>
          )}
          <div>
            <FieldLabel>মোবাইল নম্বর</FieldLabel>
            <Input value={editForm.mobile} onChange={(e) => setField("mobile", e.target.value)} />
          </div>
          <div>
            <FieldLabel required>পরিমাণ</FieldLabel>
            <Input
              required
              type="text"
              inputMode="decimal"
              value={editForm.amount}
              onChange={(e) => setField("amount", normalizeBanglaDigits(e.target.value))}
            />
          </div>
          <div>
            <FieldLabel>পেমেন্ট মাধ্যম</FieldLabel>
            <select
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={editForm.payment_method}
              onChange={(e) => setField("payment_method", e.target.value)}
            >
              {paymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <FieldLabel>নোট / বিবরণ</FieldLabel>
            <textarea
              rows={2}
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={editForm.note}
              onChange={(e) => setField("note", e.target.value)}
            />
          </div>
          <div className="md:col-span-2 mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              বাতিল
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
