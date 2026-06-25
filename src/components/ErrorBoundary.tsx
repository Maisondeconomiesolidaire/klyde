import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <div>
          <p className="text-lg font-semibold">Une erreur est survenue</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Recharge la page pour recuperer l'interface.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]"
        >
          <RefreshCw className="h-4 w-4" />
          Recharger
        </button>
      </div>
    );
  }
}
