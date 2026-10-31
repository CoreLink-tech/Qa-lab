"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui";

type Props = { children: ReactNode; fallbackTitle?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI error boundary", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center"
        >
          <h2 className="text-lg font-semibold text-red-900">
            {this.props.fallbackTitle || "Something went wrong"}
          </h2>
          <p className="mt-2 text-sm text-red-800">
            {this.state.error.message || "Unexpected client error"}
          </p>
          <Button
            className="mt-4"
            type="button"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
