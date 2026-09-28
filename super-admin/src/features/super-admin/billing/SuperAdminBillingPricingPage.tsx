import { useEffect, useState } from "react";
import { SkeletonCard } from "@madrasha/shared-ui/src/components/ui/Skeleton";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import {
  listPricing,
  updatePricing,
  type BillingChannel,
  type ChannelPricing,
} from "../../../services/superAdminBillingApi";
import { fmtMoney, sanitizeDecimalText } from "./billingHelpers";
import { commonText, getText, useText } from "@madrasha/shared-ui/src/i18n";
import { billingText } from "./billing.text";

type PricingForm = {
  sellingPriceText: string;
  providerCostText: string;
  lowCreditThreshold: number;
};

const emptyForm: PricingForm = {
  sellingPriceText: "0.5",
  providerCostText: "0",
  lowCreditThreshold: 100,
};

function PricingCard({
  channel,
  form,
  saving,
  onChange,
  onSave,
}: {
  channel: BillingChannel;
  form: PricingForm;
  saving: boolean;
  onChange: (form: PricingForm) => void;
  onSave: () => void;
}) {
  const t = useText(billingText);
  const c = useText(commonText);
  const channelMeta: Record<BillingChannel, { title: string; unit: string }> = {
    SMS: { title: t.smsPricing, unit: t.perSegment },
    EMAIL: { title: t.emailPricing, unit: t.perEmail },
  };
  const meta = channelMeta[channel];

  return (
    <div className="rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{meta.title}</h2>
      <p className="text-xs text-gray-500 dark:text-slate-400">{t.unitPricing(meta.unit)}</p>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-2">
          <label className="text-xs text-gray-600 dark:text-slate-400">
            {t.sellingPrice} <span className="text-[11px] text-gray-400">(৳ {fmtMoney(form.sellingPriceText)})</span>
          </label>
          <input
            inputMode="decimal"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={form.sellingPriceText}
            onChange={(e) => onChange({ ...form, sellingPriceText: sanitizeDecimalText(e.target.value) })}
            onBlur={() => {
              const n = Number(form.sellingPriceText || 0);
              onChange({ ...form, sellingPriceText: String(Number.isNaN(n) ? 0 : n) });
            }}
          />
          <p className="text-[11px] text-gray-400">{t.sellingPriceHint(meta.unit)}</p>
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-gray-600 dark:text-slate-400">
            {t.providerCost} <span className="text-[11px] text-gray-400">(৳ {fmtMoney(form.providerCostText)})</span>
          </label>
          <input
            inputMode="decimal"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={form.providerCostText}
            onChange={(e) => onChange({ ...form, providerCostText: sanitizeDecimalText(e.target.value) })}
            onBlur={() => {
              const n = Number(form.providerCostText || 0);
              onChange({ ...form, providerCostText: String(Number.isNaN(n) ? 0 : n) });
            }}
          />
          <p className="text-[11px] text-gray-400">{t.providerCostHint}</p>
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-gray-600 dark:text-slate-400">{t.lowCreditThreshold}</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={form.lowCreditThreshold}
            onChange={(e) => onChange({ ...form, lowCreditThreshold: Number(e.target.value) })}
          />
          <p className="text-[11px] text-gray-400">{t.lowCreditHint}</p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
          >
            {saving ? c.saving : c.save}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminBillingPricingPage() {
  const { show } = useToastStore();
  const t = useText(billingText);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<BillingChannel | null>(null);
  const [forms, setForms] = useState<Record<BillingChannel, PricingForm>>({
    SMS: emptyForm,
    EMAIL: emptyForm,
  });

  async function load() {
    setLoading(true);
    try {
      const res = await listPricing();
      const rows = (res?.data || []) as ChannelPricing[];
      const next: Record<BillingChannel, PricingForm> = { SMS: emptyForm, EMAIL: emptyForm };
      for (const row of rows) {
        next[row.channel] = {
          sellingPriceText: String(Number(row.sellingPrice ?? 0)),
          providerCostText: String(Number(row.providerCost ?? 0)),
          lowCreditThreshold: Number(row.lowCreditThreshold ?? 0),
        };
      }
      setForms(next);
    } catch (e: any) {
      show(e?.response?.data?.message || getText(billingText).loadFailed, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave(channel: BillingChannel) {
    const tx = getText(billingText);
    const form = forms[channel];
    const sellingPrice = Number(form.sellingPriceText || 0);
    const providerCost = Number(form.providerCostText || 0);

    if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
      show(tx.errSellingPrice, "error");
      return;
    }
    if (Number.isNaN(providerCost) || providerCost < 0) {
      show(tx.errProviderCost, "error");
      return;
    }
    if (!Number.isFinite(form.lowCreditThreshold) || form.lowCreditThreshold < 0) {
      show(tx.errThreshold, "error");
      return;
    }

    setSaving(channel);
    try {
      await updatePricing(channel, {
        sellingPrice,
        providerCost,
        lowCreditThreshold: Math.round(form.lowCreditThreshold),
      });
      show(tx.pricingUpdated, "success");
      await load();
    } catch (e: any) {
      show(e?.response?.data?.message || tx.saveFailed, "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold dark:text-slate-100">{t.pricingTitle}</h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          {t.pricingSubtitle}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {loading ? (
          <>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </>
        ) : (
          <>
            <PricingCard
              channel="SMS"
              form={forms.SMS}
              saving={saving === "SMS"}
              onChange={(f) => setForms((p) => ({ ...p, SMS: f }))}
              onSave={() => onSave("SMS")}
            />
            <PricingCard
              channel="EMAIL"
              form={forms.EMAIL}
              saving={saving === "EMAIL"}
              onChange={(f) => setForms((p) => ({ ...p, EMAIL: f }))}
              onSave={() => onSave("EMAIL")}
            />
          </>
        )}
      </div>
    </div>
  );
}
