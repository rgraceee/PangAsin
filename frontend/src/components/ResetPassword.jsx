import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Form } from 'react-bootstrap';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  resetPassword,
  validatePasswordResetToken,
} from '../services/dataService';

function getPasswordStrength(password) {
  if (!password) {
    return { label: 'Use at least 6 characters.', tone: 'empty', percent: 0 };
  }
  if (password.length < 6) {
    return { label: 'Too short - use at least 6 characters.', tone: 'weak', percent: 25 };
  }

  let score = 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { label: 'Fair - add more characters or variety.', tone: 'fair', percent: 55 };
  }
  if (score === 3) {
    return { label: 'Good password.', tone: 'good', percent: 78 };
  }
  return { label: 'Strong password.', tone: 'strong', percent: 100 };
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [linkState, setLinkState] = useState(token ? 'checking' : 'invalid');
  const [linkError, setLinkError] = useState(
    token ? '' : 'This reset link is missing its token. Please request a new one.',
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  useEffect(() => {
    if (!token) return undefined;

    let active = true;
    validatePasswordResetToken(token)
      .then(() => {
        if (active) setLinkState('valid');
      })
      .catch((err) => {
        if (!active) return;
        setLinkState('invalid');
        setLinkError(
          err.message || 'This reset link is invalid. Please request a new one.',
        );
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => {
      navigate('/login', {
        replace: true,
        state: { resetSuccess: true },
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      await resetPassword(token, newPassword, confirmPassword);
      setSuccess(true);
    } catch (err) {
      const code = err.data?.code;
      const message = err.message || 'Could not reset the password. Please try again.';
      if (
        [
          'expired_token',
          'used_token',
          'invalid_token',
          'missing_token',
          'inactive_account',
        ].includes(code)
      ) {
        setLinkState('invalid');
        setLinkError(message);
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
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

          {linkState === 'checking' && (
            <div className="auth-recovery-state">
              <span className="auth-recovery-icon" aria-hidden="true">
                <Loader2 size={26} className="encoder-login-spinner" />
              </span>
              <h1 className="auth-recovery-title">Checking your link</h1>
              <p className="auth-recovery-sub">
                Please wait while we verify this password reset link.
              </p>
            </div>
          )}

          {linkState === 'invalid' && (
            <div className="auth-recovery-state">
              <span className="auth-recovery-icon is-error" aria-hidden="true">
                <XCircle size={26} strokeWidth={2} />
              </span>
              <h1 className="auth-recovery-title">Reset link unavailable</h1>
              <p className="auth-recovery-sub">{linkError}</p>
              <div className="auth-recovery-links">
                <Link to="/forgot-password" className="ui-btn-primary auth-recovery-submit">
                  Request a new link
                </Link>
                <Link to="/login" className="auth-recovery-text-link">
                  Back to sign in
                </Link>
              </div>
              <p className="auth-recovery-note">
                <ShieldCheck size={15} aria-hidden="true" />
                Encoder account? You can also ask your administrator to reset it.
              </p>
            </div>
          )}

          {linkState === 'valid' && success && (
            <div className="auth-recovery-state">
              <span className="auth-recovery-icon is-success" aria-hidden="true">
                <CheckCircle2 size={26} strokeWidth={2} />
              </span>
              <h1 className="auth-recovery-title">Password updated</h1>
              <p className="auth-recovery-sub">
                Your password has been reset and all existing sessions were signed
                out. Redirecting you to sign in...
              </p>
              <Link to="/login" className="ui-btn-primary auth-recovery-submit">
                Go to sign in
              </Link>
            </div>
          )}

          {linkState === 'valid' && !success && (
            <>
              <span className="auth-recovery-icon" aria-hidden="true">
                <KeyRound size={26} strokeWidth={2} />
              </span>
              <h1 className="auth-recovery-title">Set a new password</h1>
              <p className="auth-recovery-sub">
                Choose a new password for your PangAsin account. The link can only
                be used once.
              </p>

              {error && (
                <Alert variant="danger" role="alert" className="auth-recovery-alert">
                  {error}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="resetNewPassword">
                  <Form.Label>
                    New password <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="auth-recovery-password-wrap">
                    <Form.Control
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="auth-recovery-password-toggle"
                      onClick={() => setShowNewPassword((visible) => !visible)}
                      aria-pressed={showNewPassword}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? (
                        <EyeOff size={17} aria-hidden="true" />
                      ) : (
                        <Eye size={17} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <div className={`auth-recovery-strength is-${strength.tone}`}>
                    <div className="auth-recovery-strength-bar" aria-hidden="true">
                      <span style={{ width: `${strength.percent}%` }} />
                    </div>
                    <p>{strength.label}</p>
                  </div>
                </Form.Group>

                <Form.Group className="mb-4" controlId="resetConfirmPassword">
                  <Form.Label>
                    Confirm password <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="auth-recovery-password-wrap">
                    <Form.Control
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="auth-recovery-password-toggle"
                      onClick={() => setShowConfirmPassword((visible) => !visible)}
                      aria-pressed={showConfirmPassword}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={17} aria-hidden="true" />
                      ) : (
                        <Eye size={17} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <Form.Text className="text-danger">
                      Passwords do not match yet.
                    </Form.Text>
                  )}
                </Form.Group>

                <button
                  type="submit"
                  className="ui-btn-primary auth-recovery-submit"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={17}
                        className="encoder-login-spinner"
                        aria-hidden="true"
                      />
                      Updating password...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={17} aria-hidden="true" />
                      Reset password
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
