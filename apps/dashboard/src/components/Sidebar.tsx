import React from 'react';
import { useAuth } from '../context/AuthContext';

export type NavView = 'overview' | 'my-conversations' | 'all-conversations' | 'follow-ups' | 'resolved' | 'settings';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  openCount?: number;
  myCount?: number;
  followUpCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  openCount = 0,
  myCount = 0,
  followUpCount = 0,
}) => {
  const { role } = useAuth();
  const canViewAll = role === 'super_admin' || role === 'tenant_admin' || role === 'branch_admin';

  return (
    <aside className="app-sidebar p-2 d-flex flex-column justify-content-between">
      <div>
        <div className="px-3 py-2 text-uppercase text-muted fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.08em' }}>
          M Square Helpdesk
        </div>

        <nav className="nav flex-column gap-1">
          <button
            type="button"
            className={`sidebar-nav-link text-start border-0 ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => onSelectView('overview')}
          >
            <i className="bi bi-speedometer2 text-primary fs-5"></i>
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-link text-start border-0 justify-content-between ${
              activeView === 'my-conversations' ? 'active' : ''
            }`}
            onClick={() => onSelectView('my-conversations')}
          >
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-chat-dots-fill text-warning fs-5"></i>
              <span>My Chats</span>
            </div>
            {myCount > 0 && <span className="badge bg-warning-subtle text-warning-emphasis rounded-pill">{myCount}</span>}
          </button>

          {canViewAll && (
            <button
              type="button"
              className={`sidebar-nav-link text-start border-0 justify-content-between ${
                activeView === 'all-conversations' ? 'active' : ''
              }`}
              onClick={() => onSelectView('all-conversations')}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-inbox-fill text-info fs-5"></i>
                <span>All Inquiries</span>
              </div>
              {openCount > 0 && <span className="badge bg-info-subtle text-info-emphasis rounded-pill">{openCount}</span>}
            </button>
          )}

          <button
            type="button"
            className={`sidebar-nav-link text-start border-0 justify-content-between ${
              activeView === 'follow-ups' ? 'active' : ''
            }`}
            onClick={() => onSelectView('follow-ups')}
          >
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-calendar-event text-danger fs-5"></i>
              <span>Follow-ups</span>
            </div>
            {followUpCount > 0 && <span className="badge bg-danger-subtle text-danger rounded-pill">{followUpCount}</span>}
          </button>

          <button
            type="button"
            className={`sidebar-nav-link text-start border-0 ${activeView === 'resolved' ? 'active' : ''}`}
            onClick={() => onSelectView('resolved')}
          >
            <i className="bi bi-check-circle text-success fs-5"></i>
            <span>Resolved</span>
          </button>
        </nav>
      </div>

      <div className="p-3 border rounded mt-auto bg-body-tertiary">
        <div className="d-flex align-items-center gap-2 mb-2">
          <div
            className="rounded p-1 d-flex align-items-center justify-content-center"
            style={{ width: '22px', height: '22px', background: 'var(--brand-orange)', color: '#fff', fontSize: '0.65rem', fontWeight: 800 }}
          >
            M²
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: '0.78rem' }}>M Square Ecosystem</div>
            <div className="text-muted" style={{ fontSize: '0.68rem' }}>Connected Helpdesk</div>
          </div>
        </div>
        <a
          href="https://msquareprofessionals.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-decoration-none small d-flex align-items-center justify-content-between text-warning fw-semibold"
          style={{ fontSize: '0.72rem' }}
        >
          <span>msquareprofessionals.com</span>
          <i className="bi bi-box-arrow-up-right"></i>
        </a>
      </div>
    </aside>
  );
};
