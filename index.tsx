// Author: Gemini
// OS support: Web/Node
// Description: Mount React app with ErrorBoundary and global styles

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', margin: '20px' }}>
          <h2 style={{ color: '#dc2626', marginTop: 0 }}>Đã xảy ra lỗi hệ thống</h2>
          <p style={{ color: '#7f1d1d', fontWeight: 'bold' }}>Chi tiết lỗi:</p>
          <pre style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '4px', border: '1px solid #fee2e2', overflowX: 'auto', fontSize: '14px', color: '#dc2626' }}>
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '15px', backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Tải lại trang
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// --- End of index.tsx ---