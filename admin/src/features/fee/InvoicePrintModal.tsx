import { Printer } from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { ReportBackground, ReportBrandHeader, ReportWatermark } from "../../components/Report/ReportBranding";
import { money, toDateInput } from "../accounts/accountHelpers";
import { commonText, usePrintLang, usePrintText, useText } from "@madrasha/shared-ui/src/i18n";
import { invoicePreviewText, invoicePrintText, invoiceStatusText } from "./fee.text";

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


type Props = {
  invoice: PrintableInvoice | null;
  studentLabel: string;
  onClose: () => void;
};

export default function InvoicePrintModal({ invoice, studentLabel, onClose }: Props) {
  const c = useText(commonText);
  const v = useText(invoicePreviewText);
  const p = usePrintText(invoicePrintText);
  const STATUS_LABELS = usePrintText(invoiceStatusText);
  const { lang: printLang, dir: printDir } = usePrintLang();
  if (!invoice) return null;

  const waived = Number(invoice.waivedAmount || 0);
  const due = Number(invoice.amount) - Number(invoice.paidAmount) - waived;

  return (
    <Modal open={!!invoice} title={v.title} onClose={onClose} maxWidthClassName="max-w-lg">
      <div lang={printLang} dir={printDir} className="print-area relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
        <ReportBackground />
        <ReportWatermark />
        <ReportBrandHeader />

        <div className="report-content-body relative">
          <h2 className="mt-2 text-center text-xl font-bold tracking-wide text-slate-900">{p.invoice}</h2>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-700">
            <span>
              <span className="font-semibold">{p.invoiceNo}</span>: {invoice.id}
            </span>
            <span>
              <span className="font-semibold">{p.dueDate}</span>: {toDateInput(invoice.dueDate)}
            </span>
          </div>

          <div className="mt-5 space-y-2 border-y border-dashed border-slate-300 py-4 text-sm text-slate-800">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{p.student}</span>
              <span className="font-semibold">{studentLabel || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{p.description}</span>
              <span className="font-semibold">
                {invoice.title}
                {invoice.month ? ` (${invoice.month})` : ""}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{p.totalAmount}</span>
              <span className="font-semibold">{money(invoice.amount, printLang)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{p.paid}</span>
              <span className="font-semibold text-emerald-700">{money(invoice.paidAmount, printLang)}</span>
            </div>
            {waived > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{p.waived}</span>
                <span className="font-semibold text-purple-700">{money(waived, printLang)}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{p.status}</span>
              <span className="font-semibold">{STATUS_LABELS[invoice.status] || invoice.status}</span>
            </div>
          </div>

          <div
            className={`mt-4 rounded-lg p-4 text-center text-2xl font-bold ${
              due > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {due > 0 ? p.remaining(money(due, printLang)) : p.fullyPaid}
          </div>

          <div className="mt-14 flex justify-between text-sm text-slate-700">
            <div className="text-center">
              <div className="w-32 border-t border-slate-400 pt-1">{p.guardianSignature}</div>
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
        <Button onClick={() => window.print()}>
          <Printer size={16} className="me-1 inline" /> {v.printNow}
        </Button>
      </div>
    </Modal>
  );
}
