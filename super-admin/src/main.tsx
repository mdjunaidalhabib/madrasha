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

setupChunkReloadOnPreloadError();
installReportFontFace();
// Super admin manages every institution type - its own panel is Bangla-only
// (no language switcher).
useLanguageStore.getState().setInstitution({ type: "MADRASA", default_language: "bn", languages: ["bn"] });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
      <ConfirmDialog />
    </ErrorBoundary>
  </React.StrictMode>,
);
