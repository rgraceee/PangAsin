import React from 'react';

export default function PageHeader({ id, title, subtitle, children, action, variant = 'main', eyebrow }) {
  return (
    <div className={`admin-page-hero ${variant === 'sub' ? 'admin-page-hero--sub' : 'admin-page-hero--main'}`} id={id}>
      <div className="admin-page-hero-grid" aria-hidden="true" />
      <div className="admin-page-hero-accent" aria-hidden="true" />
      <div className="admin-page-hero-top">
        <div>
          {eyebrow ? <div className="admin-page-hero-eyebrow">{eyebrow}</div> : null}
          <h1 className="admin-page-hero-title">{title}</h1>
          {subtitle ? <p className="admin-page-hero-sub">{subtitle}</p> : null}
        </div>
        {action ? <div className="admin-page-hero-action">{action}</div> : null}
      </div>
      {children ? <div className="admin-page-hero-controls">{children}</div> : null}
    </div>
  );
}
