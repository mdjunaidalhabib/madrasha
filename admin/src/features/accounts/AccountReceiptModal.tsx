import { Printer } from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { ReportBackground, ReportBrandHeader, ReportWatermark } from "../../components/Report/ReportBranding";
import { AccountRow, money, partyName, toDateInput, toTimeInput } from "./accountHelpers";
import { commonText, usePrintLang, usePrintText, useText } from "@madrasha/shared-ui/src/i18n";
import { accountsPrintText, accountsText } from "./accounts.text";

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
  const t = useText(accountsText);
  const c = useText(commonText);
  const p = usePrintText(accountsPrintText);
  const { lang: printLang, dir: printDir } = usePrintLang();
  if (!row) return null;

  const isIncome = row.type === "income";
  const docTitle = isIncome ? p.receipt : p.voucher;
  const docNo = (isIncome ? row.receiptNo : row.voucherNo) || "-";

  return (
    <Modal open={!!row} title={t.printPreview(docTitle)} onClose={onClose} maxWidthClassName="max-w-lg">
      <div lang={printLang} dir={printDir} className="print-area relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
        <ReportBackground />
        <ReportWatermark />
        <ReportBrandHeader />

        <div className="report-content-body relative">
          <h2 className="mt-2 text-center text-xl font-bold tracking-wide text-slate-900">{docTitle}</h2>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-700">
            <span>
              <span className="font-semibold">{isIncome ? p.receiptNo : p.voucherNo}:</span> {docNo}
            </span>
            <span>
              <span className="font-semibold">{p.date}:</span> {toDateInput(row.entryDate)}{" "}
              {toTimeInput(row.entryTime)}
            </span>
          </div>

          <div className="mt-5 space-y-2 border-y border-dashed border-slate-300 py-4 text-sm text-slate-800">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{isIncome ? p.donorName : p.receiverName}</span>
              <span className="font-semibold">{partyName(row)}</span>
            </div>
            {isIncome && row.address && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{p.address}</span>
                <span className="font-semibold">{row.address}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{p.fund}</span>
              <span className="font-semibold">{row.fund || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{p.category}</span>
              <span className="font-semibold">{row.category || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{p.paymentMethod}</span>
              <span className="font-semibold">{row.paymentMethod || "-"}</span>
            </div>
            {row.note && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{p.note}</span>
                <span className="font-semibold">{row.note}</span>
              </div>
            )}
          </div>

          <div
            className={`mt-4 rounded-lg p-4 text-center text-2xl font-bold ${
              isIncome ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {money(row.amount, printLang)}
          </div>

          <div className="mt-14 flex justify-between text-sm text-slate-700">
            <div className="text-center">
              <div className="w-32 border-t border-slate-400 pt-1">
                {isIncome ? p.donorSignature : p.receiverSignature}
              </div>
            </div>
            <div className="text-center">
              <div className="w-32 border-t border-slate-400 pt-1">{p.authoritySignature}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="no-print mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {c.close}
        </Button>
        <Button onClick={printAsA5}>
          <Printer size={16} className="me-1 inline" /> {t.printNow}
        </Button>
      </div>
    </Modal>
  );
}
