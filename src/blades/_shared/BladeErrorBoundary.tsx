import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../../components/ui/button";

interface BladeErrorBoundaryProps {
  children: ReactNode;
  bladeTitle: string;
  onBack: () => void;
}

interface BladeErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class BladeErrorBoundary extends Component<
  BladeErrorBoundaryProps,
  BladeErrorBoundaryState
> {
  constructor(props: BladeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): BladeErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[BladeError] ${this.props.bladeTitle}:`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
          <AlertTriangle className="w-10 h-10 text-ctp-peach" />
          <div className="text-center">
            <p className="text-sm font-medium text-ctp-text">
              Something went wrong in "{this.props.bladeTitle}"
            </p>
            <p className="text-xs text-ctp-subtext0 mt-1 max-w-sm">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={this.props.onBack}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Go back
            </Button>
            <Button variant="ghost" size="sm" onClick={this.handleRetry}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
