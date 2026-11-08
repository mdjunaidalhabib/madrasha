import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "@madrasha/shared-ui/src/index.css";
import Toaster from "@madrasha/shared-ui/src/components/ui/Toaster";
import ConfirmDialog from "@madrasha/shared-ui/src/components/ui/ConfirmDialog";
import ErrorBoundary from "@madrasha/shared-ui/src/components/ui/ErrorBoundary";
import { setupChunkReloadOnPreloadError } from "@madrasha/shared-ui/src/utils/chunkReload";
import { installReportFontFace } from "@madrasha/shared-ui/src/utils/reportFontFace";
import InstallPrompt from "@madrasha/shared-ui/src/pwa/InstallPrompt";
import { setupPwa, usePwaInstall } from "@madrasha/shared-ui/src/pwa/pwa";
import { setupTenantManifest } from "./utils/pwaManifest";
import { router } from "./app/router";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { appText } from "./app/app.text";

// Institution-neutral, translated fallback name for the install prompt
// (the manifest name, once known, takes precedence inside InstallPrompt).
function SiteInstallPrompt() {
  const t = useText(appText);
  const { installEnabled, appId } = usePwaInstall();
  if (!installEnabled || !appId) return null;
  return (
    <InstallPrompt
      appName={t.appName}
      key={appId}
      storageKey={`ems-site:pwa-dismissed-at:${appId}`}
    />
  );
}

setupChunkReloadOnPreloadError();
installReportFontFace({ uiDisplay: "swap" });
void setupTenantManifest();
router.subscribe(({ location }) => { void setupTenantManifest(location.pathname); });
setupPwa();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
      <ConfirmDialog />
      <SiteInstallPrompt />
    </ErrorBoundary>
  </React.StrictMode>,
);
