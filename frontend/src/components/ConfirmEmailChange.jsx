import React, { useEffect, useState } from 'react';
import { Alert, Card } from 'react-bootstrap';
import { ArrowLeft, CheckCircle2, Loader2, MailCheck, XCircle } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmEmailChange } from '../services/dataService';

export default function ConfirmEmailChange({ setUser }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState(token ? 'ready' : 'error');
  const [error, setError] = useState(
    token ? '' : 'This verification link is missing its token. Request a new one.',
  );

  useEffect(() => {
    if (state !== 'success') return undefined;
    const timer = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 3500);
    return () => {
      clearTimeout(timer);
    };
  }, [state, navigate, setUser]);

  const handleConfirm = async () => {
    setState('loading');
    setError('');
    try {
      const result = await confirmEmailChange(token);
      if (setUser) {
        setUser((user) => (user ? { ...user, email: result.email } : user));
      }
      setState('success');
    } catch (err) {
      setError(err.message || 'Could not verify this email address.');
      setState('error');
    }
  };

  return (
    <div className="auth-recovery-page">
      <Card className="auth-recovery-card">
        <Card.Body>
          <Link to="/login" className="auth-recovery-back">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to sign in
          </Link>

          {state === 'success' ? (
            <div className="auth-recovery-state">
              <span className="auth-recovery-icon is-success" aria-hidden="true">
                <CheckCircle2 size={26} strokeWidth={2} />
              </span>
              <h1 className="auth-recovery-title">Email updated</h1>
              <p className="auth-recovery-sub">
                Your email address is verified. Password reset links will be sent
                to this inbox.
              </p>
              <Link to="/login" className="ui-btn-primary auth-recovery-submit">
                Continue to sign in
              </Link>
            </div>
          ) : state === 'error' ? (
            <div className="auth-recovery-state">
              <span className="auth-recovery-icon is-error" aria-hidden="true">
                <XCircle size={26} strokeWidth={2} />
              </span>
              <h1 className="auth-recovery-title">Email verification unavailable</h1>
              <Alert variant="danger" role="alert" className="auth-recovery-alert">
                {error}
              </Alert>
              <Link to="/login" className="ui-btn-primary auth-recovery-submit">
                Back to sign in
              </Link>
            </div>
          ) : state === 'loading' ? (
            <div className="auth-recovery-state" role="status">
              <span className="auth-recovery-icon" aria-hidden="true">
                <Loader2 size={26} className="encoder-login-spinner" />
              </span>
              <h1 className="auth-recovery-title">Verifying your email</h1>
              <p className="auth-recovery-sub">Please wait a moment.</p>
            </div>
          ) : (
            <div className="auth-recovery-state">
              <span className="auth-recovery-icon" aria-hidden="true">
                <MailCheck size={26} strokeWidth={2} />
              </span>
              <h1 className="auth-recovery-title">Confirm your email address</h1>
              <p className="auth-recovery-sub">
                Confirm that you can receive mail at this address. It will be used
                for password recovery.
              </p>
              {error && (
                <Alert variant="danger" role="alert" className="auth-recovery-alert">
                  {error}
                </Alert>
              )}
              <button
                type="button"
                className="ui-btn-primary auth-recovery-submit"
                onClick={handleConfirm}
              >
                Verify email address
              </button>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
