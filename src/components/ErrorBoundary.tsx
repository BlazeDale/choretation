import { Component, type ReactNode } from 'react';

/** Shows a way back instead of a blank screen if something in the app throws. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="card-panel">
          <h2>Something went wrong on this screen</h2>
          <p className="hint">Your chores are saved. Reload to pick up where you left off.</p>
          <p className="error">{this.state.error.message}</p>
          <button className="primary" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
