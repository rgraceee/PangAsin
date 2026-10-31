import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'pangasin.lastNonSettingsPath';

/* WHAT: Track the last non-settings URL (path + query) in sessionStorage so the
   Settings back button can return the user to where they came from.
   WHY: Moving between settings tabs must not overwrite the saved page; only
   navigation away from settings updates it. Shells (AdminLayout, EncoderLayout)
   call this hook; Settings reads the saved value for its back button. */
export function useLastNonSettingsLocation() {
  const location = useLocation();

  useEffect(() => {
    const isSettings =
      location.pathname === '/settings' || location.pathname.startsWith('/settings/');
    if (!isSettings) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, location.pathname + location.search);
      } catch (e) {
        // sessionStorage may be unavailable; silently skip.
      }
    }
  }, [location.pathname, location.search]);

  const getLastPath = () => {
    try {
      return window.sessionStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  };

  return getLastPath();
}
