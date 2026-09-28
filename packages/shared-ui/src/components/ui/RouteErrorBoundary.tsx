import { Component, ErrorInfo, ReactNode } from "react";
import ErrorState from "./ErrorState";
import { logger } from "../../utils/logger";
import { useText } from "../../i18n";
import { uiText } from "./ui.text";

// Function wrapper so the fallback re-renders in the current UI language.
function RouteErrorFallback({ onRetry }: { onRetry: () => void }) {
  const t = useText(uiText);
  return <ErrorState title={t.routeErrorTitle} message={t.routeErrorMessage} onRetry={onRetry} />;
}

type Props = { children: ReactNode };
type State = { hasError: boolean };

// Wraps just the routed page content (not the sidebar/topbar around it).
// Render it with `key={location.pathname}` from the layout so it remounts
// (clearing any crash) whenever the route changes — a broken page can then
// never take the surrounding nav down with it, and clicking another sidebar
// link recovers automatically instead of being stuck on the crashed page.
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("Route ErrorBoundary caught an error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <RouteErrorFallback onRetry={() => this.setState({ hasError: false })} />
      );
    }

    return this.props.children;
  }
}
