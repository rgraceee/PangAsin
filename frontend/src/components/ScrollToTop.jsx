import { useLocation, useEffect } from 'react';

// WHAT: Scrolls the page to the top on every route change, ignoring hash anchors.
// WHY: Opening Privacy Policy, Help Center, Terms (and any page) must show the
//      page from the top, not scrolled down to where the link was clicked.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
}
