import NetworkStatus from "@madrasha/shared-ui/src/pwa/NetworkStatus";
import InstallPrompt from "@madrasha/shared-ui/src/pwa/InstallPrompt";
import { setupPwa } from "@madrasha/shared-ui/src/pwa/pwa";
import { setupPlatformBrandIcons } from "@madrasha/shared-ui/src/pwa/platformBrand";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "@madrasha/shared-ui/src/index.css";
import Toaster from "@madrasha/shared-ui/src/components/ui/Toaster";
import ConfirmDialog from "@madrasha/shared-ui/src/components/ui/ConfirmDialog";
import ErrorBoundary from "@madrasha/shared-ui/src/components/ui/ErrorBoundary";
import { setupChunkReloadOnPreloadError } from "@madrasha/shared-ui/src/utils/chunkReload";
import { installReportFontFace } from "@madrasha/shared-ui/src/utils/reportFontFace";
import { useLanguageStore } from "@madrasha/shared-ui/src/i18n";

setupPwa();
setupPlatformBrandIcons({
  name: "EMS Super Admin",
  shortName: "EMS Super Admin",
  description: "EMS platform management",
});
setupChunkReloadOnPreloadError();
installReportFontFace();
// Super admin manages every institution type - its own panel is Bangla-only
// (no language switcher).
useLanguageStore
  .getState()
  .setInstitution({
    type: "MADRASA",
    default_language: "bn",
    languages: ["bn"],
  });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <NetworkStatus />
      <Toaster />
      <ConfirmDialog />
      <InstallPrompt
        appName="EMS Super Admin"
        storageKey="ems-super-admin:pwa-dismissed-at"
      />
    </ErrorBoundary>
  </React.StrictMode>,
);
