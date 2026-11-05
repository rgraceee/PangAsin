import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuestDashboard from './GuestDashboard';

vi.mock('../hooks/useMunicipalityDirectory', () => ({
  default: () => ({ activeNames: [] }),
}));

describe('public dashboard footer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the login footer with ASIN Center, privacy, and sign-in links', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(
      <MemoryRouter>
        <GuestDashboard />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Salt production monitoring, forecasting, and decision support.')).not.toBeInTheDocument();
    expect(screen.getByText('Supported by the DOST NICER Program')).toBeInTheDocument();
    expect(screen.getByText('PangAsin Development Team')).toBeInTheDocument();

    const centerLink = screen.getByRole('link', { name: 'ASIN Center' });
    expect(centerLink).toHaveAttribute('href', 'https://asincenter.psu.edu.ph/');
    expect(centerLink).toHaveAttribute('target', '_blank');
    expect(centerLink).toHaveAttribute('rel', 'noopener noreferrer');
    const contactCenterLink = screen.getByRole('link', { name: 'ASIN Center website' });
    expect(contactCenterLink).toHaveAttribute('href', 'https://asincenter.psu.edu.ph/');
    expect(contactCenterLink).toHaveAttribute('target', '_blank');
    expect(contactCenterLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    const signInLink = screen.getByRole('link', { name: 'Sign in' });
    expect(signInLink).toHaveAttribute('href', '/login');
    expect(signInLink).toHaveClass('login-footer-signin');
    expect(screen.getByRole('link', { name: 'pang.asin26@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:pang.asin26@gmail.com',
    );
  });
});
