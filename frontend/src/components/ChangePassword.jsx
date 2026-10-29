import React, { useState } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { changePassword, logoutAPI } from '../services/dataService';
import { useToast } from './Toast';

/* WHAT: Forced first-login password change for auto-created encoder accounts.
   WHY: The temporary password is shown once in the admin UI; the account cannot
        use any other API until it is replaced here. */
export default function ChangePassword({ user, setUser }) {
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const homePath = user?.role === 'admin' ? '/admin' : '/encoder';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('The new password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('The new password must be different from the temporary password.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      if (setUser) {
        setUser({ ...(user || {}), must_change_password: false });
      }
      toastSuccess('Your new password is now active.', 'Password updated');
      navigate(homePath, { replace: true });
    } catch (err) {
      const message = err.data?.errors
        ? err.data.errors.join(', ')
        : (err.message || 'Could not update the password.');
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutAPI();
    } catch (err) {
      // The session may already be gone; sign out locally anyway.
    }
    if (setUser) setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <div className="change-password-page">
      <Card className="change-password-card">
        <Card.Body>
          <span className="change-password-icon" aria-hidden="true">
            <ShieldCheck size={26} strokeWidth={2} />
          </span>
          <h1 className="change-password-title">Set a new password</h1>
          <p className="change-password-sub">
            {user?.name ? <><strong>{user.name}</strong>, your</> : 'Your'} account was created with a
            temporary password. Replace it now to continue. This step is required only once.
          </p>

          {error && <Alert variant="danger" role="alert">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="changePasswordCurrent">
              <Form.Label>Temporary password</Form.Label>
              <Form.Control
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="changePasswordNew">
              <Form.Label>New password</Form.Label>
              <Form.Control
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <Form.Text className="text-muted">At least 6 characters.</Form.Text>
            </Form.Group>
            <Form.Group className="mb-4" controlId="changePasswordConfirm">
              <Form.Label>Confirm new password</Form.Label>
              <Form.Control
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Form.Group>

            <Button type="submit" className="change-password-submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={17} className="encoder-login-spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                <>
                  <KeyRound size={17} aria-hidden="true" />
                  Update password
                </>
              )}
            </Button>
          </Form>

          <button type="button" className="change-password-signout" onClick={handleLogout}>
            <LogOut size={15} aria-hidden="true" />
            Sign out instead
          </button>
        </Card.Body>
      </Card>
    </div>
  );
}
