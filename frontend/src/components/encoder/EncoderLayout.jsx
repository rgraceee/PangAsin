import React from 'react';
import { Outlet } from 'react-router-dom';

export default function EncoderLayout({ user }) {
  return (
    <div className="encoder-layout">
      <div className="encoder-content">
        <Outlet context={{ user }} />
      </div>
    </div>
  );
}
