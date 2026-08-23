import { Component, ErrorInfo, ReactNode } from "react";
import ErrorState from "./ErrorState";
import { logger } from "../../utils/logger";

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
        <ErrorState
          title="পেজ লোড করা যায়নি"
          message="এই পেজে একটি সমস্যা হয়েছে। মেনু থেকে অন্য পেজে যান অথবা আবার চেষ্টা করুন।"
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}
