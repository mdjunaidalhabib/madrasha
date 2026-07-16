import { useMemo, useState } from "react";
import api from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useToastStore } from "../../store/toastStore";
import { expenseGroups, fundNames, paymentMethods } from "./accountingData";

const nowDate = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const FieldLabel = ({ children, required = false }: { children: string; required?: boolean }) => (
  <label className="mb-1 block text-sm font-semibold text-slate-700">
    {children} {required && <span className="text-rose-600">*</span>}
  </label>
);

export default function ExpensePage() {
  const toast = useToastStore();
  const [groupName, setGroupName] = useState(expenseGroups[0].name);
  const [form, setForm] = useState({
    entry_date: nowDate(),
    entry_time: nowTime(),
    voucher_no: "",
    fund: fundNames[0],
    category: expenseGroups[0].categories[0],
    amount: "",
    payment_method: paymentMethods[0],
    receiver_name: "",
    mobile: "",
  });
  const selectedGroup = useMemo(
    () => expenseGroups.find((group) => group.name === groupName) || expenseGroups[0],
    [groupName],
  );
  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const handleGroupChange = (name: string) => {
    const group = expenseGroups.find((item) => item.name === name) || expenseGroups[0];
    setGroupName(group.name);
    setForm((prev) => ({ ...prev, category: group.categories[0] }));
  };
  const handleSubmit = async () => {
    if (!form.receiver_name.trim()) return toast.push("error", "নাম দিন");
    if (!form.amount || Number(form.amount) <= 0) return toast.push("error", "পরিমাণ দিন");
    await api.post("/accounts/expense", form);
    toast.push("success", "ব্যয়/ভাউচার সংরক্ষণ হয়েছে");
    setForm((prev) => ({
      ...prev,
      entry_date: nowDate(),
      entry_time: nowTime(),
      voucher_no: "",
      amount: "",
      receiver_name: "",
      mobile: "",
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ভাউচার তৈরি / ব্যয় এন্ট্রি"
        subtitle="ফান্ডভিত্তিক ভাউচার ও ব্যয় সংরক্ষণ"
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <FieldLabel>তারিখ</FieldLabel>
            <Input
              type="date"
              value={form.entry_date}
              onChange={(e) => setField("entry_date", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>সময়</FieldLabel>
            <Input
              type="time"
              value={form.entry_time}
              onChange={(e) => setField("entry_time", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>ভাউচার নম্বর</FieldLabel>
            <Input
              placeholder="ভাউচার নম্বর"
              value={form.voucher_no}
              onChange={(e) => setField("voucher_no", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>ব্যয় বিভাগ</FieldLabel>
            <select
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
              value={groupName}
              onChange={(e) => handleGroupChange(e.target.value)}
            >
              {expenseGroups.map((group) => (
                <option key={group.name}>{group.name}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>ব্যয়ের খাত</FieldLabel>
            <select
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
            >
              {selectedGroup.categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>ফান্ড</FieldLabel>
            <select
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
              value={form.fund}
              onChange={(e) => setField("fund", e.target.value)}
            >
              {fundNames.map((fund) => (
                <option key={fund}>{fund}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel required>নাম</FieldLabel>
            <Input
              required
              placeholder="গ্রহণকারীর নাম"
              value={form.receiver_name}
              onChange={(e) => setField("receiver_name", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel required>পরিমাণ</FieldLabel>
            <Input
              required
              type="number"
              min="1"
              placeholder="পরিমাণ"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>পেমেন্ট মাধ্যম</FieldLabel>
            <select
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
              value={form.payment_method}
              onChange={(e) => setField("payment_method", e.target.value)}
            >
              {paymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>মোবাইল নম্বর</FieldLabel>
            <Input
              placeholder="মোবাইল নম্বর"
              value={form.mobile}
              onChange={(e) => setField("mobile", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit} className="rounded-xl px-8">
            সংরক্ষণ করুন
          </Button>
        </div>
      </div>
    </div>
  );
}
