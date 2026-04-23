import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches runtime React errors and displays a fallback UI
 * instead of crashing the entire plugin panel.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Graph Intelligence] React error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ogi-root">
          <div className="ogi-error">
            <p className="ogi-error-title">Something went wrong</p>
            <p className="ogi-error-message">
              Check the developer console for details.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
