import { useEffect, useState } from "react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { billingApi, type MessagePackage } from "../../services/billingApi";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import { getText, useLang, useText, formatNumber } from "@madrasha/shared-ui/src/i18n";
import { billingText } from "./billing.text";

interface PurchaseRequestModalProps {
  pkg: MessagePackage | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PurchaseRequestModal = ({ pkg, onClose, onSuccess }: PurchaseRequestModalProps) => {
  const tx = useText(billingText);
  const lang = useLang();
  const [paymentMethodLabel, setPaymentMethodLabel] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPaymentMethodLabel("");
    setTransactionRef("");
    setNote("");
  }, [pkg]);

  const handleSubmit = async () => {
    if (!pkg) return;
    if (!paymentMethodLabel.trim()) {
      useToastStore.getState().show(getText(billingText).enterPaymentMethod, "error");
      return;
    }

    try {
      setSubmitting(true);
      await billingApi.createPurchaseRequest({
        channel: pkg.channel,
        packageId: pkg.id,
        paymentMethodLabel: paymentMethodLabel.trim(),
        transactionRef: transactionRef.trim() || undefined,
        note: note.trim() || undefined,
      });
      useToastStore
        .getState()
        .show(
          getText(billingText).requestSent(pkg.channel === "SMS" ? "SMS" : getText(billingText).email),
          "success",
        );
      onSuccess();
      onClose();
    } catch (err: any) {
      logger.error("CREATE PURCHASE REQUEST ERROR:", err);
      const msg = err?.response?.data?.message || getText(billingText).requestFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!pkg} title={tx.requestTitle} onClose={onClose} maxWidthClassName="max-w-md">
      {pkg && (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="font-semibold text-gray-800 dark:text-slate-100">{pkg.name}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
              {tx.creditCount(formatNumber(pkg.credit, lang), pkg.channel === "SMS" ? "SMS" : tx.email)} ·{" "}
              {tx.validity(formatNumber(pkg.validityDays, lang))} · ৳{formatNumber(Number(pkg.price), lang)}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {tx.paymentMethod} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={paymentMethodLabel}
              onChange={(e) => setPaymentMethodLabel(e.target.value)}
              placeholder={tx.paymentMethodPlaceholder}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {tx.transactionIdOptional}
            </label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {tx.noteOptional}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? tx.sending : tx.sendRequest}
          </button>
        </div>
      )}
    </Modal>
  );
};

export default PurchaseRequestModal;
