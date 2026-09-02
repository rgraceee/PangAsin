import React, { useState } from 'react';
import { Form, Button, Alert, Container, Row, Col } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { loginAPI } from '../services/dataService';

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
      <Container>
        <Row className="justify-content-center">
          <Col md={5} lg={4}>
            <div className="encoder-login-card">
              <h1 className="encoder-login-title">PangAsin</h1>
              <p className="encoder-login-sub">Sign in</p>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="loginEmail">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@pangasin.gov.ph"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="loginPassword">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
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
          </Col>
        </Row>
      </Container>
    </div>
  );
}