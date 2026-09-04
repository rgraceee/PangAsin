import React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';

export default function IconButton({ icon: Icon, label, variant = 'outline-secondary', onClick, disabled, placement = 'top' }) {
  return (
    <OverlayTrigger placement={placement} overlay={<Tooltip>{label}</Tooltip>}>
      <Button
        variant={variant}
        size="sm"
        className="admin-icon-btn"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
      >
        {Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" />}
      </Button>
    </OverlayTrigger>
  );
}
