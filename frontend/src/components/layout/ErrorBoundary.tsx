import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              {this.props.fallbackTitle || "Something went wrong"}
            </h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {this.state.error?.message || "An unexpected rendering error occurred."}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reload Page
              </Button>
              <Button size="sm" onClick={this.handleReset}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
