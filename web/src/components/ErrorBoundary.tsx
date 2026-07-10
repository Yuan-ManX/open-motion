import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("OpenMotion render error:", err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-bg p-8">
          <div className="max-w-md text-center">
            <div className="text-3xl mb-4">⚠</div>
            <h1 className="text-lg font-semibold text-gray-200 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-4 font-mono break-all">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent2 text-black text-sm font-medium transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
