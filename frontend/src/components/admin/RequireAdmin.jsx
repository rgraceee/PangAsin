import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAdminMe } from '../../services/dataService';

export default function RequireAdmin({ user, isLoading, setUser, children }) {
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    let mounted = true;
    if (user && user.role === 'admin') {
      setState({ loading: false, ok: true });
      return () => { mounted = false; };
    }
    if (isLoading) {
      return () => { mounted = false; };
    }
    getAdminMe()
      .then((u) => {
        if (!mounted) return;
        if (u && u.role === 'admin') {
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

  if (state.loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }
  if (!state.ok) {
    return <Navigate to="/login" replace />;
  }
  return children;
}