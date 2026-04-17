"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Custom fallback UI. If omitted, renders the default error card. */
  fallback?: ReactNode;
  /** Called after an error is caught — use for Sentry reporting etc. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Forward to external error reporter (Sentry, etc.) if provided
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback) return fallback;

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              An unexpected error occurred. Try refreshing the page, or contact support if the
              problem persists.
            </p>
            {process.env.NODE_ENV === "development" && (
              <pre className="mt-4 max-h-48 overflow-auto rounded-md bg-muted p-4 text-left text-xs">
                {error.message}
                {"\n"}
                {error.stack}
              </pre>
            )}
          </div>
          <Button variant="outline" onClick={this.handleReset}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      );
    }

    return children;
  }
}

/**
 * Lightweight wrapper for page-level boundaries inside the dashboard.
 * Usage: <PageErrorBoundary><YourPage /></PageErrorBoundary>
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
