import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import GuestDashboard from './components/GuestDashboard';
import Login from './components/Login';
import EncoderLayout from './components/encoder/EncoderLayout';
import EncoderDashboard from './components/encoder/EncoderDashboard';
import RequireAdmin from './components/admin/RequireAdmin';
import AdminLayout from './components/admin/AdminLayout';
import { getMe } from './services/dataService';

function RequireAuth({ user, isLoading, children }) {
  if (isLoading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GuestDashboard />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="/encoder/login" element={<Navigate to="/login" replace />} />
        <Route
          path="/encoder"
          element={
            <RequireAuth user={user} isLoading={loading}>
              <EncoderLayout user={user} />
            </RequireAuth>
          }
        >
          <Route index element={<EncoderDashboard />} />
        </Route>
        <Route
          path="/admin"
          element={
            <RequireAdmin user={user} isLoading={loading} setUser={setUser}>
              <AdminLayout user={user} setUser={setUser} />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
