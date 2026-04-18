import { useState, useEffect, Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Submit from './pages/Submit.jsx';
import Analytics from './pages/Analytics.jsx';

// Shows the actual error instead of a blank white page
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#ef4444', fontFamily: 'monospace', background: '#0d0f14', minHeight: '100vh' }}>
          <h2 style={{ marginBottom: 16 }}>⚠ Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#64748b', marginTop: 12 }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [sseConnected, setSseConnected] = useState(false);

  // Lightweight health-check poll — avoids double-SSE with Dashboard
useEffect(() => {
  fetch('/api/workers/status')
    .then(() => setSseConnected(true))
    .catch(() => setSseConnected(false));
}, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Navbar sseConnected={sseConnected} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
