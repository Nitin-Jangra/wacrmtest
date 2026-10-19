import React from 'react';
import { useAuth } from '../context/AuthContext';
import { NavView } from './Sidebar';

interface DashboardOverviewProps {
  openCount: number;
  myCount: number;
  onHoldCount: number;
  resolvedCount: number;
  followUpCount: number;
  onNavigate: (view: NavView) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  openCount,
  myCount,
  onHoldCount,
  resolvedCount,
  followUpCount,
  onNavigate,
}) => {
  const { name, role, tenantId } = useAuth();

  return (
    <div className="p-4 flex-grow-1 overflow-y-auto">
      {/* Welcome Banner */}
      <div className="card border mb-4 shadow-sm">
        <div className="card-body p-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="badge msquare-helpdesk-badge">
                M Square Growth & Automation
              </span>
              <span className="badge bg-secondary-subtle text-secondary small">
                WhatsApp Helpdesk v1.0
              </span>
            </div>
            <h3 className="fw-bold mb-1">
              Welcome back, {name}!
            </h3>
            <p className="text-muted small mb-0">
              Role:{' '}
              <span className="badge bg-warning-subtle text-warning-emphasis text-uppercase fw-bold">
                {role?.replace('_', ' ')}
              </span>{' '}
              &bull; Tenant:{' '}
              <span className="text-body fw-semibold">
                {tenantId === '11111111-1111-4000-8000-000000000001'
                  ? 'M Square Professionals (Hub)'
                  : tenantId === '22222222-2222-4000-8000-000000000002'
                    ? 'M Square Enterprise'
                    : 'System Wide'}
              </span>
            </p>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-msquare-primary"
              onClick={() => onNavigate('my-conversations')}
            >
              <i className="bi bi-chat-dots-fill"></i>
              Open My Chats
            </button>
            <button
              type="button"
              className="btn btn-msquare-outline"
              onClick={() => onNavigate('follow-ups')}
            >
              <i className="bi bi-calendar-event"></i>
              View Follow-ups
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border h-100 shadow-sm"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigate('my-conversations')}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold">My Active Chats</span>
                <div
                  className="rounded p-2 text-white"
                  style={{ background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-hover))' }}
                >
                  <i className="bi bi-person-check-fill fs-5"></i>
                </div>
              </div>
              <h2 className="fw-bold mb-0">{myCount}</h2>
              <small className="text-muted">Assigned directly to you</small>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border h-100 shadow-sm"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigate('all-conversations')}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold">Open Inquiries</span>
                <div
                  className="rounded p-2 text-white"
                  style={{ background: 'linear-gradient(135deg, var(--brand-blue), var(--brand-blue-hover))' }}
                >
                  <i className="bi bi-inbox-fill fs-5"></i>
                </div>
              </div>
              <h2 className="fw-bold mb-0">{openCount}</h2>
              <small className="text-muted">
                {openCount} active &bull; {onHoldCount} on hold
              </small>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border h-100 shadow-sm"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigate('follow-ups')}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold">Pending Follow-ups</span>
                <div className="rounded p-2 bg-danger-subtle text-danger">
                  <i className="bi bi-calendar-check-fill fs-5"></i>
                </div>
              </div>
              <h2 className="fw-bold mb-0">{followUpCount}</h2>
              <small className="text-muted">Scheduled client reminders</small>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div
            className="card border h-100 shadow-sm"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigate('resolved')}
          >
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-semibold">Resolved Queries</span>
                <div className="rounded p-2 bg-success-subtle text-success">
                  <i className="bi bi-check-all fs-5"></i>
                </div>
              </div>
              <h2 className="fw-bold mb-0">{resolvedCount}</h2>
              <small className="text-muted">Successfully handled tickets</small>
            </div>
          </div>
        </div>
      </div>

      {/* Ecosystem Status & Brand Section */}
      <div className="row g-3">
        <div className="col-12 col-lg-8">
          <div className="card border shadow-sm h-100">
            <div className="card-header bg-transparent border-bottom d-flex align-items-center justify-content-between py-3">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-cpu-fill text-warning"></i>
                M Square Helpdesk Integration Status
              </h6>
              <span className="badge bg-success-subtle text-success">
                <i className="bi bi-dot"></i> Live Services
              </span>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-sm-6">
                  <div className="p-3 border rounded bg-body-tertiary">
                    <div className="text-muted small mb-1">WhatsApp Cloud Engine</div>
                    <div className="fw-bold text-success d-flex align-items-center gap-1">
                      <i className="bi bi-check-circle-fill"></i> Operational
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Official Meta Cloud API webhook listener verified
                    </div>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="p-3 border rounded bg-body-tertiary">
                    <div className="text-muted small mb-1">Smooth Lead Distribution</div>
                    <div className="fw-bold text-warning d-flex align-items-center gap-1">
                      <i className="bi bi-arrow-repeat"></i> Active (Weighted RR)
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Agent eligibility & capacity auto-balanced
                    </div>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="p-3 border rounded bg-body-tertiary">
                    <div className="text-muted small mb-1">Tenant & Branch Boundary</div>
                    <div className="fw-bold text-primary d-flex align-items-center gap-1">
                      <i className="bi bi-shield-check"></i> Strict Isolation
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Fail-closed server-side data partitioning
                    </div>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="p-3 border rounded bg-body-tertiary">
                    <div className="text-muted small mb-1">Enterprise Ecosystem</div>
                    <div className="fw-bold text-info d-flex align-items-center gap-1">
                      <i className="bi bi-link-45deg"></i> M Square Core
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      CRM adapter abstraction layer connected
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card border shadow-sm h-100">
            <div className="card-header bg-transparent border-bottom py-3">
              <h6 className="fw-bold mb-0">M Square Professionals</h6>
            </div>
            <div className="card-body d-flex flex-column justify-content-between">
              <div>
                <p className="text-muted small mb-3">
                  Growth Marketing, Business Automation & Custom Software under one connected ecosystem.
                </p>
                <div className="d-flex flex-column gap-2 small">
                  <div className="d-flex align-items-center justify-content-between py-1 border-bottom">
                    <span className="text-muted">Headquarters</span>
                    <span className="fw-semibold">Greater Noida / Noida HQ</span>
                  </div>
                  <div className="d-flex align-items-center justify-content-between py-1 border-bottom">
                    <span className="text-muted">Official Portal</span>
                    <a
                      href="https://msquareprofessionals.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-warning fw-semibold text-decoration-none"
                    >
                      msquareprofessionals.com
                    </a>
                  </div>
                  <div className="d-flex align-items-center justify-content-between py-1">
                    <span className="text-muted">WhatsApp Support</span>
                    <span className="text-success fw-semibold">+91 98765 00001</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <a
                  href="https://msquareprofessionals.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-msquare-primary w-100"
                >
                  <span>Visit Website</span>
                  <i className="bi bi-arrow-up-right"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
