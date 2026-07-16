import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./index.css";
import Toaster from "./components/ui/Toaster";
import ConfirmDialog from "./components/ui/ConfirmDialog";
import ErrorBoundary from "./components/ui/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
      <ConfirmDialog />
    </ErrorBoundary>
  </React.StrictMode>,
);
