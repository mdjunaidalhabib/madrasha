import { Printer } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { ReportBackground, ReportBrandHeader, ReportWatermark } from "../../components/Report/ReportBranding";
import { money, toDateInput } from "../accounts/accountHelpers";

type PrintableInvoice = {
  id: number;
  title: string;
  amount: string | number;
  paidAmount: string | number;
  waivedAmount?: string | number;
  dueDate: string;
  status: string;
  month?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  UNPAID: "অপরিশোধিত",
  PARTIALLY_PAID: "আংশিক পরিশোধিত",
  PAID: "পরিশোধিত",
  OVERDUE: "মেয়াদোত্তীর্ণ",
  WAIVED: "মওকুফকৃত",
};

type Props = {
  invoice: PrintableInvoice | null;
  studentLabel: string;
  onClose: () => void;
};

export default function InvoicePrintModal({ invoice, studentLabel, onClose }: Props) {
  if (!invoice) return null;

  const waived = Number(invoice.waivedAmount || 0);
  const due = Number(invoice.amount) - Number(invoice.paidAmount) - waived;

  return (
    <Modal open={!!invoice} title="ইনভয়েস প্রিন্ট প্রিভিউ" onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="print-area relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
        <ReportBackground />
        <ReportWatermark />
        <ReportBrandHeader />

        <div className="report-content-body relative">
          <h2 className="mt-2 text-center text-xl font-bold tracking-wide text-slate-900">ইনভয়েস</h2>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-700">
            <span>
              <span className="font-semibold">ইনভয়েস নং</span>: {invoice.id}
            </span>
            <span>
              <span className="font-semibold">ডিউ তারিখ</span>: {toDateInput(invoice.dueDate)}
            </span>
          </div>

          <div className="mt-5 space-y-2 border-y border-dashed border-slate-300 py-4 text-sm text-slate-800">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">ছাত্র</span>
              <span className="font-semibold">{studentLabel || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">বিবরণ</span>
              <span className="font-semibold">
                {invoice.title}
                {invoice.month ? ` (${invoice.month})` : ""}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">মোট পরিমাণ</span>
              <span className="font-semibold">{money(invoice.amount)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">পরিশোধিত</span>
              <span className="font-semibold text-emerald-700">{money(invoice.paidAmount)}</span>
            </div>
            {waived > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">মওকুফকৃত</span>
                <span className="font-semibold text-purple-700">{money(waived)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">স্ট্যাটাস</span>
              <span className="font-semibold">{STATUS_LABELS[invoice.status] || invoice.status}</span>
            </div>
          </div>

          <div
            className={`mt-4 rounded-lg p-4 text-center text-2xl font-bold ${
              due > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {due > 0 ? `বাকি ${money(due)}` : "সম্পূর্ণ পরিশোধ"}
          </div>

          <div className="mt-14 flex justify-between text-sm text-slate-700">
            <div className="text-center">
              <div className="w-32 border-t border-slate-400 pt-1">অভিভাবকের স্বাক্ষর</div>
            </div>
            <div className="text-center">
              <div className="w-32 border-t border-slate-400 pt-1">কর্তৃপক্ষের স্বাক্ষর</div>
            </div>
          </div>
        </div>
      </div>

      <div className="no-print mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          বন্ধ করুন
        </Button>
        <Button onClick={() => window.print()}>
          <Printer size={16} className="mr-1 inline" /> প্রিন্ট করুন
        </Button>
      </div>
    </Modal>
  );
}
