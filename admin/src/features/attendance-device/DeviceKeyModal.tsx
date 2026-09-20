import { Copy } from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import { API_BASE_URL } from "@madrasha/shared-ui/src/services/apiConfig";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useAuthStore } from "../../store/authStore";

export type RevealedKey = {
  deviceCode: string;
  deviceName: string;
  rawKey: string;
  rotated: boolean;
};

const copyText = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    useToastStore.getState().show(`${label} কপি হয়েছে`, "success");
  } catch {
    useToastStore.getState().show("কপি করা যায়নি, হাতে নির্বাচন করে কপি করুন", "error");
  }
};

const copyButtonClass =
  "flex h-9 shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

const codeClass =
  "flex-1 select-all break-all rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

/** One-time reveal of the connector key. Deliberately can't be dismissed by
 * Escape / backdrop click - the key is never shown again. */
export default function DeviceKeyModal({
  revealed,
  onClose,
}: {
  revealed: RevealedKey | null;
  onClose: () => void;
}) {
  const slug = useAuthStore((s) => s.madrasaSlug) || "";
  const institutionId = useAuthStore((s) => s.user?.madrasa_id);

  const snippet = revealed
    ? [
        "# connector config.json",
        `"apiBaseUrl": "${API_BASE_URL.replace(/\/api\/?$/, "")}",`,
        `"madrasaSlug": "${slug}",`,
        `"institutionId": ${institutionId ?? 0},`,
        `"deviceId": "${revealed.deviceCode}",`,
        "",
        "# connector setup চালালে এই কী বসাতে বলবে",
        revealed.rawKey,
      ].join("\n")
    : "";

  return (
    <Modal
      open={!!revealed}
      title={revealed?.rotated ? "নতুন কানেক্টর কী" : "কানেক্টর কী"}
      onClose={() => {}}
      hideCloseButton
      maxWidthClassName="max-w-2xl"
    >
      {revealed && (
        <div className="flex flex-col gap-3">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
            এই কী আর কখনো দেখানো হবে না। এখনই কপি করে কানেক্টরের কনফিগে বসিয়ে নিন।
            {revealed.rotated && " আগের কী এখন থেকে আর কাজ করবে না।"}
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {revealed.deviceName} - কানেক্টর কী
            </label>
            <div className="flex items-center gap-2">
              <code className={codeClass}>{revealed.rawKey}</code>
              <button
                type="button"
                onClick={() => copyText(revealed.rawKey, "কী")}
                className={copyButtonClass}
              >
                <Copy size={13} />
                কপি
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400">
                কানেক্টর সেটআপ (কনফিগ ফাইলে বসান)
              </label>
              <button
                type="button"
                onClick={() => copyText(snippet, "কনফিগ")}
                className={copyButtonClass}
              >
                <Copy size={13} />
                সব কপি
              </button>
            </div>
            <pre className="select-all overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-gray-300 bg-gray-50 p-3 text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              {snippet}
            </pre>
          </div>

          <div className="mt-1 flex justify-end">
            <Button type="button" onClick={onClose}>
              বুঝেছি, কপি করেছি
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
