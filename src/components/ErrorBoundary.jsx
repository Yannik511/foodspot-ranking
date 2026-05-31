import { Component } from 'react'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.href = '/dashboard'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        background: '#0f0f13',
        gap: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 18,
          fontWeight: 600,
          color: '#fff',
          margin: 0,
        }}>
          Etwas ist schiefgelaufen
        </p>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 14,
          color: 'rgba(255,255,255,0.45)',
          margin: 0,
          maxWidth: 280,
          lineHeight: 1.5,
        }}>
          Die App hat einen unerwarteten Fehler. Bitte lade die Seite neu.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: 8,
            padding: '14px 32px',
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #FF9357, #B85C2C)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Poppins', sans-serif",
            boxShadow: '0 6px 20px rgba(255,147,87,0.4)',
          }}
        >
          Neu laden
        </button>
      </div>
    )
  }
}

export default ErrorBoundary
