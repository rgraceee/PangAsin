import React, { useState } from 'react';
import { Alert, Card, Form } from 'react-bootstrap';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { requestPasswordReset } from '../services/dataService';

const GENERIC_RESET_MESSAGE =
  'If that email is registered, a reset link has been sent.';

export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send the reset link. Please try again.');
    } finally {
      setLoading(false);
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

          {sent ? (
            <div className="auth-recovery-state">
              <span className="auth-recovery-icon is-success" aria-hidden="true">
                <CheckCircle2 size={26} strokeWidth={2} />
              </span>
              <h1 className="auth-recovery-title">Check your email</h1>
              <p className="auth-recovery-sub">{GENERIC_RESET_MESSAGE}</p>
              <p className="auth-recovery-sub">
                Check your inbox and spam folder. The link expires in 30 minutes
                and can only be used once.
              </p>
              <div className="auth-recovery-links">
                <Link to="/login" className="ui-btn-primary auth-recovery-submit">
                  Back to sign in
                </Link>
                <button
                  type="button"
                  className="auth-recovery-text-link"
                  onClick={() => setSent(false)}
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="auth-recovery-icon" aria-hidden="true">
                <KeyRound size={26} strokeWidth={2} />
              </span>
              <h1 className="auth-recovery-title">Forgot your password?</h1>
              <p className="auth-recovery-sub">
                Enter the email registered to your PangAsin account. We will send
                a secure reset link that expires in 30 minutes.
              </p>

              {error && (
                <Alert variant="danger" role="alert" className="auth-recovery-alert">
                  {error}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="forgotEmail">
                  <Form.Label>
                    Email address <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@pangasin.gov.ph"
                    autoComplete="email"
                    required
                  />
                </Form.Group>
                <button
                  type="submit"
                  className="ui-btn-primary auth-recovery-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={17}
                        className="encoder-login-spinner"
                        aria-hidden="true"
                      />
                      Sending reset link...
                    </>
                  ) : (
                    <>
                      <Mail size={17} aria-hidden="true" />
                      Send reset link
                    </>
                  )}
                </button>
              </Form>

              <p className="auth-recovery-note">
                <ShieldCheck size={15} aria-hidden="true" />
                Encoder account? You can also ask your administrator to reset it.
              </p>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
