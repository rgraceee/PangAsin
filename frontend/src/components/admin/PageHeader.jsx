import React from 'react';

export default function PageHeader({
  id, title, subtitle, children, action, actions, chips, variant = 'main', eyebrow,
}) {
  /* WHAT: Bagong "clean" na header gamit lang ang ui tokens.
     WHY: para sa encoder pages habang byte-identical pa rin ang admin/guest na hero. */
  if (variant === 'clean') {
    return (
      <header className="ui-pageheader" id={id}>
        <div className="ui-pageheader-main">
          <div className="ui-pageheader-left">
            {eyebrow ? <div className="ui-pageheader-eyebrow">{eyebrow}</div> : null}
            <h1 className="ui-pageheader-title">{title}</h1>
            {subtitle ? <p className="ui-pageheader-sub">{subtitle}</p> : null}
            {chips && chips.length ? (
              <div className="ui-pageheader-chips">
                {chips.map((chip, i) => <span className="ui-pageheader-chip" key={i}>{chip}</span>)}
              </div>
            ) : null}
          </div>
          {(actions || action) ? <div className="ui-pageheader-actions">{actions || action}</div> : null}
        </div>
        {children ? <div className="ui-pageheader-controls">{children}</div> : null}
      </header>
    );
  }

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
