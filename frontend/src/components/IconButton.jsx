import React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';

function colorFromVariant(variant) {
  return String(variant || 'outline-secondary').replace(/^outline-/, '');
}

export default function IconButton({ icon: Icon, label, variant = 'outline-secondary', onClick, disabled, placement = 'top' }) {
  return (
    <OverlayTrigger placement={placement} overlay={<Tooltip>{label}</Tooltip>}>
      <Button
        variant="link"
        size="sm"
        className={`admin-icon-link text-${colorFromVariant(variant)} p-1`}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
      >
        {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" />}
      </Button>
    </OverlayTrigger>
  );
}