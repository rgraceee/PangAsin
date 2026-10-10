import React, { useId } from 'react';

export default function PageHeader({
  id, title, subtitle, children, action, actions, variant = 'main', eyebrow,
  art, compact = false, status, stat, className = '',
}) {
  const rawId = useId();
  const dotId = `ph-dots-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  /* WHAT: Bagong "clean" na header gamit lang ang ui tokens.
     WHY: para sa encoder pages habang byte-identical pa rin ang admin/guest na hero.
      ADDITIVE: ang art/compact/status/className ay hindi ginagamit ng admin/guest (variant main/sub).
      Ang `status` ay ang compact chip strip sa ilalim ng subtitle (hal. admin dashboard).
      Ang `stat` ay ang equal-width stat strip sa ilalim ng top row (hal. admin dashboard hero). */
  if (variant === 'clean') {
    const hasArt = Boolean(art);
    const headerClass = [
      'ui-pageheader',
      hasArt ? 'ui-pageheader--art' : '',
      compact ? 'ui-pageheader--compact' : '',
      className,
    ].filter(Boolean).join(' ');
    return (
      <header className={headerClass} id={id}>
        {hasArt ? (
          <>
            {/* WHAT: Walang aria-hidden sa container para mabasa ang legend.
               WHY: ang SVG mismo ng mapa ang naka-aria-hidden (decorative) sa component. */}
            <div className="ui-pageheader-art">{art}</div>
            <div className="ui-pageheader-art-glow" aria-hidden="true" />
            <div className="ui-pageheader-art-grid" aria-hidden="true">
              <svg width="100%" height="100%" role="presentation" focusable="false">
                <defs>
                  <pattern id={dotId} width="18" height="18" patternUnits="userSpaceOnUse">
                    <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#${dotId})`} />
              </svg>
            </div>
          </>
        ) : null}
        <div className="ui-pageheader-main">
          <div className="ui-pageheader-left">
            <h1 className="ui-pageheader-title">{title}</h1>
            {subtitle ? <p className="ui-pageheader-sub">{subtitle}</p> : null}
            {status ? <div className="ui-pageheader-status">{status}</div> : null}
          </div>
          {(actions || action) ? <div className="ui-pageheader-actions">{actions || action}</div> : null}
        </div>
        {stat ? <div className="ui-pageheader-statstrip">{stat}</div> : null}
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
