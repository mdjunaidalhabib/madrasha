import { useId, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { isIos, isStandalone, promptInstall, usePwaInstall } from "@madrasha/shared-ui/src/pwa/pwa";
import { guardianPwaText } from "./guardianPwa.text";

/** A permanent entry point, independent of the dismissible site banner. */
export default function GuardianAppInstall({ slug, variant = "card" }: { slug: string | null; variant?: "card" | "sidebar" }) {
  const { appId, installEnabled, installed, deferredPrompt } = usePwaInstall();
  const t = useText(guardianPwaText);
  const instructionsId = useId();
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!slug || isStandalone()) return null;
  // Keep the entry point visible while branding loads or is unavailable, but
  // never invoke a prompt belonging to another tenant or the public website.
  const ready = installEnabled && !!appId
    && new URL(appId).pathname === `/${encodeURIComponent(slug)}/guardian`;
  const alreadyInstalled = ready && installed;

  const install = async () => {
    if (busy) return;
    setFailed(false);
    if (!ready || alreadyInstalled || !deferredPrompt) {
      setShowSteps((value) => !value);
      return;
    }
    setBusy(true);
    try {
      await promptInstall();
    } catch {
      setFailed(true);
      setShowSteps(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={variant === "sidebar" ? "guardian-sidebar-install" : "guardian-app-install"} aria-label={t.installTitle}>
      {variant === "sidebar" ? (
        <button
          type="button"
          className="guardian-nav-item"
          disabled={busy}
          onClick={() => { void install(); }}
          aria-expanded={showSteps}
          aria-controls={instructionsId}
        >
          <Download size={20} strokeWidth={1.7} aria-hidden="true" />
          <span>{busy ? t.installing : alreadyInstalled ? t.installed : t.install}</span>
        </button>
      ) : <div className="guardian-app-install-summary">
        <Smartphone size={24} aria-hidden="true" />
        <div className="guardian-app-install-copy">
          <strong>{t.installTitle}</strong>
          <p>{t.installDescription}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => { void install(); }}
          aria-expanded={showSteps}
          aria-controls={instructionsId}
        >
          <Download size={17} aria-hidden="true" />
          {busy ? t.installing : alreadyInstalled ? t.installed : t.install}
        </button>
      </div>}
      <div id={instructionsId} hidden={!showSteps} className="guardian-app-install-steps">
        {failed && <p role="alert">{t.installError}</p>}
        {alreadyInstalled ? <p>{t.alreadyInstalledHelp}</p> : !ready ? (
          <p role="status">{t.notReady}</p>
        ) : (
          <>
            <p>{isIos() ? t.iosInstructions : t.browserInstructions}</p>
            <p>{t.installHelp}</p>
          </>
        )}
      </div>
    </section>
  );
}
