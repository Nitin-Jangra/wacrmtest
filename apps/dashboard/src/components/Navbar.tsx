import React, { useState, useEffect } from 'react';
import { useAuth, MOCK_IDENTITIES } from '../context/AuthContext';

interface NavbarProps {
  onRefresh?: () => void;
  isPolling?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onRefresh, isPolling = true }) => {
  const { identityKey, switchIdentity, role, name, tenantId, branchId } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <nav className="navbar navbar-expand-lg msquare-navbar px-3">
      <div className="container-fluid d-flex align-items-center justify-content-between">
        {/* M Square Professionals Brand */}
        <div className="d-flex align-items-center gap-2">
          <div className="msquare-logo-badge" title="M Square Professionals">
            <span>M²</span>
          </div>
          <div className="msquare-brand-stacked">
            <span className="brand-word-top">M SQUARE</span>
            <span className="brand-word-bottom">PROFESSIONALS</span>
          </div>
          <span className="msquare-helpdesk-badge ms-2 d-none d-md-inline-flex align-items-center gap-1">
            <i className="bi bi-whatsapp text-success fs-6"></i>
            <span>WhatsApp Helpdesk</span>
          </span>
        </div>

        {/* Tenant, Branch, Theme Switcher & Identity Menu */}
        <div className="d-flex align-items-center gap-2 gap-sm-3">
          {/* Tenant & Branch Indicator */}
          <div className="d-none d-lg-flex align-items-center gap-2 small">
            <span className="badge bg-body-tertiary border text-body py-2 px-2.5">
              <i className="bi bi-building me-1 text-warning"></i>
              {tenantId === '11111111-1111-4000-8000-000000000001'
                ? 'M Square Professionals'
                : tenantId === '22222222-2222-4000-8000-000000000002'
                  ? 'M Square Enterprise'
                  : 'All Ecosystems'}
            </span>
            {branchId && (
              <span className="badge bg-body-tertiary border text-body py-2 px-2.5">
                <i className="bi bi-geo-alt me-1 text-danger"></i>
                {branchId === 'aaaaaaaa-0001-4000-8000-000000000001'
                  ? 'Greater Noida Hub'
                  : branchId === 'aaaaaaaa-0002-4000-8000-000000000002'
                    ? 'Noida HQ'
                    : 'Branch Scoped'}
              </span>
            )}
          </div>

          {/* Sync Button */}
          <button
            type="button"
            className="btn btn-sm btn-msquare-outline d-flex align-items-center gap-1"
            onClick={onRefresh}
            title="Sync conversations with backend"
          >
            <i className={`bi bi-arrow-repeat ${isPolling ? 'text-success' : ''}`}></i>
            <span className="d-none d-sm-inline small">Sync</span>
          </button>

          {/* Theme Switcher Toggle (Dark / Light) */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
          >
            {theme === 'dark' ? (
              <i className="bi bi-sun-fill text-warning fs-5"></i>
            ) : (
              <i className="bi bi-moon-stars-fill text-primary fs-5"></i>
            )}
          </button>

          {/* Identity Switcher Dropdown */}
          <div className="dropdown">
            <button
              className="btn btn-sm btn-msquare-outline dropdown-toggle d-flex align-items-center gap-2 text-start"
              type="button"
              id="identityDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <div
                className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold"
                style={{
                  width: '28px',
                  height: '28px',
                  fontSize: '0.8rem',
                  background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-hover))',
                }}
              >
                {name?.charAt(0) || 'M'}
              </div>
              <div className="d-none d-sm-block text-truncate" style={{ maxWidth: '170px' }}>
                <div className="fw-semibold lh-1 small text-body">{name}</div>
                <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                  {role?.replace('_', ' ').toUpperCase()}
                </div>
              </div>
            </button>
            <ul className="dropdown-menu dropdown-menu-end shadow border" aria-labelledby="identityDropdown">
              <li className="dropdown-header text-uppercase fw-bold text-muted small">Switch M Square Identity</li>
              {MOCK_IDENTITIES.map((id) => (
                <li key={id.key}>
                  <button
                    className={`dropdown-item d-flex align-items-center justify-content-between py-2 ${
                      id.key === identityKey ? 'active' : ''
                    }`}
                    onClick={() => switchIdentity(id.key)}
                  >
                    <div>
                      <div className="fw-semibold small">{id.name}</div>
                      <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                        {id.tenantName} &bull; {id.badge}
                      </div>
                    </div>
                    {id.key === identityKey && <i className="bi bi-check2 fs-5 ms-2 text-warning"></i>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};
