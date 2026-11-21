import NetworkStatus from "@madrasha/shared-ui/src/pwa/NetworkStatus";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "@madrasha/shared-ui/src/index.css";
import "./styles/admin-panel.css";
import Toaster from "@madrasha/shared-ui/src/components/ui/Toaster";
import ConfirmDialog from "@madrasha/shared-ui/src/components/ui/ConfirmDialog";
import ErrorBoundary from "@madrasha/shared-ui/src/components/ui/ErrorBoundary";
import { setupChunkReloadOnPreloadError } from "@madrasha/shared-ui/src/utils/chunkReload";
import { installReportFontFace } from "@madrasha/shared-ui/src/utils/reportFontFace";
import InstallPrompt from "@madrasha/shared-ui/src/pwa/InstallPrompt";
import { setupPwa } from "@madrasha/shared-ui/src/pwa/pwa";
import AdminDomainGate from "./app/AdminDomainGate";

setupChunkReloadOnPreloadError();
installReportFontFace();
setupPwa();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AdminDomainGate>
        <App />
        <NetworkStatus />
        <Toaster />
        <ConfirmDialog />
        <InstallPrompt
          appName="EMS Admin"
          storageKey="ems-admin:pwa-dismissed-at"
          hideOnPaths={/\/print\//}
        />
      </AdminDomainGate>
    </ErrorBoundary>
  </React.StrictMode>,
);
