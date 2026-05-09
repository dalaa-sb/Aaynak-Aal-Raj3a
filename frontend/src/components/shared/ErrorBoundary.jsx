import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { FONT, MONO } from "../../services/config";

/**
 * Catches JavaScript errors in any descendant component and shows a
 * recoverable error UI instead of a blank/black screen.
 *
 * Class component because React's error boundary API is class-only.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surfaces the actual stack in the browser console for debugging
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 40, fontFamily: FONT, color: "#e2e8f0",
        background: "radial-gradient(ellipse at top, #0e2a52 0%, #050a18 100%)",
      }}>
        <div style={{
          maxWidth: 520, padding: "32px 30px", borderRadius: 16,
          background: "rgba(11,20,38,0.9)",
          border: "1px solid rgba(239,68,68,0.25)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <AlertTriangle size={22} color="#f87171" />
            <h2 style={{ margin: 0, fontSize: 18, color: "#f0f9ff" }}>Something went wrong</h2>
          </div>
          <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
            The page hit an unexpected error. Try reloading. If it keeps happening,
            check the browser console (F12) — the full stack trace is there.
          </p>
          {this.state.error?.message && (
            <pre style={{
              background: "rgba(0,0,0,0.4)", padding: "10px 14px", borderRadius: 8,
              color: "#fca5a5", fontSize: 11, fontFamily: MONO, overflow: "auto",
              margin: "0 0 16px", maxHeight: 140,
            }}>
              {String(this.state.error.message)}
            </pre>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={this.handleReload} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "linear-gradient(90deg, #5b9cd0 0%, #2d5cd6 100%)",
              color: "#fff", fontSize: 13, fontFamily: FONT, fontWeight: 600,
            }}>
              <RefreshCw size={13} /> Reload
            </button>
            <button onClick={this.handleReset} style={{
              padding: "9px 16px", borderRadius: 8, cursor: "pointer",
              background: "transparent", color: "#94a3b8",
              border: "1px solid rgba(56,189,248,0.15)",
              fontSize: 13, fontFamily: FONT,
            }}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }
}
