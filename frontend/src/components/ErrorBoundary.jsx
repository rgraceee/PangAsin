import React, { Component } from 'react';

// WHAT: React error boundary na nagpapakita ng mensahe kapag may render error
//       isang component sa loob niya. Hindi natitinag ang screen nang puti.
// WHY: Kung may error sa Settings page (halimbawa, missing context, bad prop),
//      makikita ng user ang mensahe hindi blank page. Madaling i-debug ang root
//      cause dahil nakalalaman ang error message.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="settings-error-boundary" role="alert">
          <h2>Something went wrong</h2>
          <p>
            We encountered an error while loading the Settings page:{' '}
            {this.state.error?.message || this.state.error}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
            }}
            className="btn btn-primary"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
