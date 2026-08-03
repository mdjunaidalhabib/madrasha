import { useEffect, useState } from "react";
import Button from "../ui/Button";
import {
  deleteMadrasaCloudinaryConfig,
  getMadrasaCloudinaryConfig,
  saveMadrasaCloudinaryConfig,
} from "../../services/superAdminApi";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";
import { logger } from "../../utils/logger";
import { Madrasa } from "../../features/super-admin/madrasa-management/SuperAdminMadrasasPage";

export default function MadrasaCloudinaryModal({
  madrasa,
  onClose,
}: {
  madrasa: Madrasa;
  onClose: () => void;
}) {
  const toast = useToastStore((s) => s.show);

  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [cloudName, setCloudName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMadrasaCloudinaryConfig(madrasa.id)
      .then((data) => {
        if (cancelled) return;
        setConfigured(data.configured);
        setCloudName(data.cloud_name || "");
        // API key/secret are write-only fields — never prefilled with the
        // real saved value, only the cloud name (not sensitive) is shown.
      })
      .catch((err) => {
        logger.error("LOAD MADRASA CLOUDINARY CONFIG ERROR:", err);
        toast("Failed to load Cloudinary config.", "error");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [madrasa.id]);

  const save = async () => {
    if (!cloudName.trim() || !apiKey.trim() || !apiSecret.trim()) {
      toast("Cloud Name, API Key and API Secret are all required.", "error");
      return;
    }
    setSaving(true);
    try {
      await saveMadrasaCloudinaryConfig(madrasa.id, {
        cloud_name: cloudName.trim(),
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
      });
      setConfigured(true);
      setApiSecret("");
      toast("Cloudinary config saved.", "success");
    } catch (err) {
      logger.error("SAVE MADRASA CLOUDINARY CONFIG ERROR:", err);
      toast("Failed to save Cloudinary config.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    useConfirmStore.getState().show({
      title: "Remove Cloudinary config",
      message: `Remove "${madrasa.name}"'s Cloudinary account? Image uploads for this madrasa will stop working until it's reconfigured.`,
      confirmText: "Remove",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteMadrasaCloudinaryConfig(madrasa.id);
          setConfigured(false);
          setCloudName("");
          setApiKey("");
          setApiSecret("");
          toast("Cloudinary config removed.", "success");
        } catch (err) {
          logger.error("DELETE MADRASA CLOUDINARY CONFIG ERROR:", err);
          toast("Failed to remove Cloudinary config.", "error");
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Cloudinary Settings</h2>
            <p className="text-sm text-slate-500">
              {madrasa.name}'s own image storage account — configured here only, tenant staff can't
              see or edit it.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
              configured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {loading ? "..." : configured ? "Configured" : "Not configured"}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Cloud Name</label>
              <input
                className="w-full rounded border px-3 py-2"
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                placeholder="e.g. my-cloud-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">API Key</label>
              <input
                className="w-full rounded border px-3 py-2"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={configured ? "•••••••••• (enter to replace)" : ""}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">API Secret</label>
              <input
                type="password"
                className="w-full rounded border px-3 py-2"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={configured ? "•••••••••• (enter to replace)" : ""}
              />
              <p className="mt-1 text-xs text-gray-500">
                Never shown again after saving — re-enter it here any time you need to change it.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          {configured ? (
            <Button variant="danger" onClick={remove} disabled={loading || saving}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Close
            </Button>
            <Button onClick={save} disabled={loading || saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
