import { Component, ErrorInfo, ReactNode } from "react";
import ErrorState from "./ErrorState";
import { logger } from "../../utils/logger";
import { useText } from "../../i18n";
import { uiText } from "./ui.text";

// Function wrapper so the fallback re-renders in the current UI language.
function CrashFallback({ onRetry }: { onRetry: () => void }) {
  const t = useText(uiText);
  return <ErrorState title={t.pageCrashedTitle} message={t.pageCrashedMessage} onRetry={onRetry} />;
}

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("UI ErrorBoundary caught an error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 p-6 dark:bg-slate-950">
          <CrashFallback onRetry={() => this.setState({ hasError: false })} />
        </div>
      );
    }

    return this.props.children;
  }
}
