import React from 'react';
import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function ComingSoon({ title, description }) {
  return (
    <Card className="encoder-card admin-card">
      <Card.Body>
        <h4>{title}</h4>
        <p className="text-muted">{description}</p>
        <p className="text-muted small">
          Coming soon — placeholder for an upcoming screen. <Link to="/admin">Back to dashboard</Link>.
        </p>
      </Card.Body>
    </Card>
  );
}