// WHAT: Route guard wrapper that restricts access to SuperAdmin-only routes.
// WHY: SuperAdmin pages must only be accessible to users with role 'superadmin'.
//      Admins and encoders are redirected to /admin with an error toast.
//      Logged-out users are redirected to /login.
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAdminMe } from '../../services/dataService';
import { SkeletonPage } from '../Skeleton';

export default function RequireSuperAdmin({ user, isLoading, setUser, children }) {
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    let mounted = true;
    // If user is already provided and is superadmin, allow access immediately.
    if (user && user.role === 'superadmin') {
      setState({ loading: false, ok: true });
      return () => { mounted = false; };
    }
    // If still loading user data, show skeleton.
    if (isLoading) {
      return () => { mounted = false; };
    }
    // Otherwise fetch current user to verify superadmin role.
    getAdminMe()
      .then((u) => {
        if (!mounted) return;
        if (u && u.role === 'superadmin') {
          if (setUser) setUser(u);
          setState({ loading: false, ok: true });
        } else {
          setState({ loading: false, ok: false });
        }
      })
      .catch(() => {
        if (mounted) setState({ loading: false, ok: false });
      });
    return () => { mounted = false; };
  }, [user, isLoading, setUser]);

  // WHAT: Forced password change guard - superadmin must change password first too.
  // WHY: Same security rule as admin/encoder: temp passwords must be changed.
  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }
  if (state.loading) {
    return <div className="auth-skeleton-wrap"><SkeletonPage /></div>;
  }
  if (!state.ok) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
