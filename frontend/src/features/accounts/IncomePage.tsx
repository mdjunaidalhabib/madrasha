import { useMemo, useState } from "react";
import api from "../../services/api";
import PageHeader from "../../components/ui/PageHeader";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useToastStore } from "../../store/toastStore";
import { incomeFunds, paymentMethods } from "./accountingData";

const nowDate = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

const FieldLabel = ({ children, required = false }: { children: string; required?: boolean }) => (
  <label className="mb-1 block text-sm font-semibold text-slate-700">
    {children} {required && <span className="text-rose-600">*</span>}
  </label>
);

export default function IncomePage() {
  const toast = useToastStore();
  const [form, setForm] = useState({
    entry_date: nowDate(),
    entry_time: nowTime(),
    receipt_no: "",
    fund: incomeFunds[0].name,
    category: incomeFunds[0].categories[0],
    donor_name: "",
    address: "",
    mobile: "",
    amount: "",
    payment_method: paymentMethods[0],
  });

  const selectedFund = useMemo(
    () => incomeFunds.find((fund) => fund.name === form.fund) || incomeFunds[0],
    [form.fund],
  );
  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const handleFundChange = (fundName: string) => {
    const fund = incomeFunds.find((item) => item.name === fundName) || incomeFunds[0];
    setForm((prev) => ({ ...prev, fund: fund.name, category: fund.categories[0] }));
  };

  const handleSubmit = async () => {
    if (!form.donor_name.trim()) return toast.push("error", "নাম দিন");
    if (!form.amount || Number(form.amount) <= 0) return toast.push("error", "পরিমাণ দিন");
    await api.post("/accounts/income", form);
    toast.push("success", "আয়/রশিদ জমা সংরক্ষণ হয়েছে");
    setForm((prev) => ({
      ...prev,
      entry_date: nowDate(),
      entry_time: nowTime(),
      receipt_no: "",
      donor_name: "",
      address: "",
      mobile: "",
      amount: "",
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="রশিদ জমা / আয় এন্ট্রি"
        subtitle="কওমি মাদরাসার ফান্ডভিত্তিক আয় ও রশিদ জমা"
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
            <FieldLabel>রশিদ নম্বর</FieldLabel>
            <Input
              placeholder="রশিদ নম্বর"
              value={form.receipt_no}
              onChange={(e) => setField("receipt_no", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>ফান্ড</FieldLabel>
            <select
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
              value={form.fund}
              onChange={(e) => handleFundChange(e.target.value)}
            >
              {incomeFunds.map((fund) => (
                <option key={fund.name}>{fund.name}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>খাত</FieldLabel>
            <select
              className="w-full rounded border px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
            >
              {selectedFund.categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel required>নাম</FieldLabel>
            <Input
              required
              placeholder="দাতার নাম"
              value={form.donor_name}
              onChange={(e) => setField("donor_name", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>ঠিকানা</FieldLabel>
            <Input
              placeholder="ঠিকানা"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>মোবাইল নম্বর</FieldLabel>
            <Input
              placeholder="মোবাইল নম্বর"
              value={form.mobile}
              onChange={(e) => setField("mobile", e.target.value)}
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
