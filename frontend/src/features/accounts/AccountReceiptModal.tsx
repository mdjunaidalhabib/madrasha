import { Printer } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { ReportBackground, ReportBrandHeader, ReportWatermark } from "../../components/Report/ReportBranding";
import { AccountRow, money, partyName, toDateInput, toTimeInput } from "./accountHelpers";

type Props = {
  row: AccountRow | null;
  onClose: () => void;
};

const A5_PRINT_STYLE_ID = "account-receipt-a5-print-style";

const printAsA5 = () => {
  const style = document.createElement("style");
  style.id = A5_PRINT_STYLE_ID;
  style.textContent = "@media print { @page { size: A5; margin: 0.5in; } }";
  document.head.appendChild(style);

  const cleanup = () => {
    document.getElementById(A5_PRINT_STYLE_ID)?.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
};

export default function AccountReceiptModal({ row, onClose }: Props) {
  if (!row) return null;

  const isIncome = row.type === "income";
  const docTitle = isIncome ? "রশিদ" : "ভাউচার";
  const docNo = (isIncome ? row.receiptNo : row.voucherNo) || "-";

  return (
    <Modal open={!!row} title={`${docTitle} প্রিন্ট প্রিভিউ`} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="print-area relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
        <ReportBackground />
        <ReportWatermark />
        <ReportBrandHeader />

        <div className="report-content-body relative">
          <h2 className="mt-2 text-center text-xl font-bold tracking-wide text-slate-900">{docTitle}</h2>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-700">
            <span>
              <span className="font-semibold">{isIncome ? "রশিদ নং" : "ভাউচার নং"}:</span> {docNo}
            </span>
            <span>
              <span className="font-semibold">তারিখ:</span> {toDateInput(row.entryDate)}{" "}
              {toTimeInput(row.entryTime)}
            </span>
          </div>

          <div className="mt-5 space-y-2 border-y border-dashed border-slate-300 py-4 text-sm text-slate-800">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{isIncome ? "দাতার নাম" : "গ্রহীতার নাম"}</span>
              <span className="font-semibold">{partyName(row)}</span>
            </div>
            {isIncome && row.address && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">ঠিকানা</span>
                <span className="font-semibold">{row.address}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">ফান্ড</span>
              <span className="font-semibold">{row.fund || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">খাত</span>
              <span className="font-semibold">{row.category || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">পেমেন্ট মাধ্যম</span>
              <span className="font-semibold">{row.paymentMethod || "-"}</span>
            </div>
            {row.note && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">নোট</span>
                <span className="font-semibold">{row.note}</span>
              </div>
            )}
          </div>

          <div
            className={`mt-4 rounded-lg p-4 text-center text-2xl font-bold ${
              isIncome ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {money(row.amount)}
          </div>

          <div className="mt-14 flex justify-between text-sm text-slate-700">
            <div className="text-center">
              <div className="w-32 border-t border-slate-400 pt-1">
                {isIncome ? "দাতার স্বাক্ষর" : "গ্রহীতার স্বাক্ষর"}
              </div>
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
        <Button onClick={printAsA5}>
          <Printer size={16} className="mr-1 inline" /> প্রিন্ট করুন
        </Button>
      </div>
    </Modal>
  );
}
