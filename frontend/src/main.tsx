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
import { setupPwa } from "@madrasha/shared-ui/src/pwa/pwa";
import { setupTenantManifest } from "./utils/pwaManifest";

setupChunkReloadOnPreloadError();
installReportFontFace();
setupTenantManifest();
setupPwa();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
      <ConfirmDialog />
      <InstallPrompt
        appName="মাদ্রাসা"
        storageKey="qms-site:pwa-dismissed-at"
        hideOnPaths={/\/kiosk(\/|$)/}
      />
    </ErrorBoundary>
  </React.StrictMode>,
);
