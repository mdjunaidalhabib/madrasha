import { useState } from "react";
import { AlertTriangle, ChevronDown, Copy, Download } from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useAuthStore } from "../../store/authStore";
import { getText, useText } from "@madrasha/shared-ui/src/i18n";
import { attendanceDeviceText } from "./attendanceDevice.text";
import { CONNECTOR_DOWNLOAD_URL, connectorApiBaseUrl, encodePairingCode } from "./pairing";

export type RevealedKey = {
  deviceCode: string;
  deviceName: string;
  rawKey: string;
  rotated: boolean;
};

const copyText = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    useToastStore.getState().show(getText(attendanceDeviceText).key.copied(label), "success");
  } catch {
    useToastStore.getState().show(getText(attendanceDeviceText).key.copyFailed, "error");
  }
};

const copyButtonClass =
  "flex h-9 shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

const codeClass =
  "flex-1 select-all break-all rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const preClass =
  "select-all overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-gray-300 bg-gray-50 p-3 text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const labelClass = "text-xs font-medium text-gray-600 dark:text-slate-400";

/** One-time reveal of the connector pairing code (which embeds the key).
 * Deliberately can't be dismissed by Escape / backdrop click - the key is
 * never shown again. */
export default function DeviceKeyModal({
  revealed,
  onClose,
}: {
  revealed: RevealedKey | null;
  onClose: () => void;
}) {
  const t = useText(attendanceDeviceText).key;
  const slug = useAuthStore((s) => s.madrasaSlug) || "";
  const institutionId = useAuthStore((s) => s.user?.madrasa_id);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const apiBaseUrl = connectorApiBaseUrl();
  const inst = Number(institutionId);
  const canPair = !!slug && Number.isInteger(inst) && inst > 0;

  const pairingCode =
    revealed && canPair
      ? encodePairingCode({
          url: apiBaseUrl,
          slug,
          inst,
          dev: revealed.deviceCode,
          key: revealed.rawKey,
        })
      : "";

  const setupCommand = pairingCode ? `connector.exe setup --token ${pairingCode}` : "";

  // Valid config.json for manual setup - the key is deliberately NOT in it;
  // `connector setup` asks for it and stores it in deviceKeyFile.
  const configJson = revealed
    ? JSON.stringify(
        {
          apiBaseUrl,
          madrasaSlug: slug,
          institutionId: canPair ? inst : 0,
          deviceId: revealed.deviceCode,
          deviceKeyFile: "./secrets/device.key",
        },
        null,
        2,
      )
    : "";

  return (
    <Modal
      open={!!revealed}
      title={revealed?.rotated ? t.newTitle : t.title}
      onClose={() => {}}
      hideCloseButton
      maxWidthClassName="max-w-2xl"
    >
      {revealed && (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
            {t.warning}
            {revealed.rotated && t.oldInvalid}
          </p>

          {canPair ? (
            <div>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <label className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                  {t.pairingLabel}
                </label>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {t.pairingFor(revealed.deviceName)}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <code className="flex-1 select-all break-all rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-3 font-mono text-sm leading-relaxed text-gray-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-slate-100">
                  {pairingCode}
                </code>
                <Button
                  type="button"
                  onClick={() => copyText(pairingCode, t.pairingWord)}
                  className="shrink-0 justify-center gap-1.5"
                >
                  <Copy size={15} />
                  {t.copy}
                </Button>
              </div>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{t.missingInfo}</span>
            </p>
          )}

          <div className="rounded-lg border border-gray-200 p-3 dark:border-slate-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              {t.stepsTitle}
            </p>
            <ol className="space-y-1 text-sm text-gray-700 dark:text-slate-200">
              <li>{t.step1}</li>
              <li>{t.step2}</li>
              <li>{t.step3}</li>
            </ol>
            <a
              href={CONNECTOR_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download size={15} />
              {t.download}
            </a>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              aria-expanded={advancedOpen}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.advanced}
              <ChevronDown size={16} className={`transition ${advancedOpen ? "rotate-180" : ""}`} />
            </button>

            {advancedOpen && (
              <div className="flex flex-col gap-3 border-t border-gray-200 p-3 dark:border-slate-700">
                <div>
                  <label className={`mb-1 block ${labelClass}`}>{t.keyLabel(revealed.deviceName)}</label>
                  <div className="flex items-center gap-2">
                    <code className={codeClass}>{revealed.rawKey}</code>
                    <button
                      type="button"
                      onClick={() => copyText(revealed.rawKey, t.keyWord)}
                      className={copyButtonClass}
                    >
                      <Copy size={13} />
                      {t.copy}
                    </button>
                  </div>
                </div>

                {setupCommand && (
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className={labelClass}>{t.commandLabel}</label>
                      <button
                        type="button"
                        onClick={() => copyText(setupCommand, t.commandWord)}
                        className={copyButtonClass}
                      >
                        <Copy size={13} />
                        {t.copy}
                      </button>
                    </div>
                    <pre className={preClass}>{setupCommand}</pre>
                  </div>
                )}

                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className={labelClass}>{t.configLabel}</label>
                    <button
                      type="button"
                      onClick={() => copyText(configJson, t.configWord)}
                      className={copyButtonClass}
                    >
                      <Copy size={13} />
                      {t.copy}
                    </button>
                  </div>
                  <pre className={preClass}>{configJson}</pre>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t.configHint}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-1 flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setAdvancedOpen(false);
                onClose();
              }}
            >
              {t.done}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
