import React, { useState } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { loginAPI } from '../services/dataService';
import loginBg from '../assets/login-bg.svg';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await loginAPI(email, password);
      if (user.role !== 'admin' && user.role !== 'encoder') {
        throw Object.assign(new Error('This account cannot sign in to PangAsin.'), { status: 403 });
      }
      onLogin(user);
      navigate(user.role === 'admin' ? '/admin' : '/encoder');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="encoder-login-wrap">
      <aside className="encoder-login-image-panel" aria-hidden="true">
        <div className="encoder-login-image-bg" style={{ backgroundImage: `url(${loginBg})` }} />
        <div className="encoder-login-image-overlay" />
        <div className="encoder-login-image-content">
          <img src="/static/brand/PangAsin_Logo.png" alt="PangAsin" className="login-logo" />
          <h1 className="encoder-login-image-title">PangAsin</h1>
          <p className="encoder-login-image-tagline">
            The Accelerating Salt Research and Innovation (ASIN) Center at Pangasinan State University
            supports the Philippine salt industry through research, innovation, and data-driven
            planning under RA 11985.
          </p>
        </div>
      </aside>

      <main className="encoder-login-form-panel">
        <div className="encoder-login-card">
          <div className="encoder-login-eyebrow">Secure sign in</div>
          <h2 className="encoder-login-title">Welcome back</h2>
          <p className="encoder-login-sub">
            Sign in with your encoder or admin account to continue.
          </p>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="loginEmail">
              <Form.Label className="encoder-login-field-label">Email</Form.Label>
              <Form.Control
                type="email"
                className="encoder-login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@pangasin.gov.ph"
                required
              />
            </Form.Group>
            <Form.Group className="mb-4" controlId="loginPassword">
              <Form.Label className="encoder-login-field-label">Password</Form.Label>
              <Form.Control
                type="password"
                className="encoder-login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Form.Group>
            <Button type="submit" className="w-100 encoder-login-btn" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </Form>

          <div className="encoder-login-footer">
            <Link to="/">← Back to public dashboard</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
