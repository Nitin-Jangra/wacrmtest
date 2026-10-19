import React, { useState, useEffect, useCallback } from 'react';
import { FollowUp } from '@gym-helpdesk/shared-types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface FollowUpsViewProps {
  onSelectConversation: (conversationId: string) => void;
}

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({ onSelectConversation }) => {
  const { tenantId, branchId } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('scheduled');
  const [error, setError] = useState<string | null>(null);

  const loadFollowUps = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listFollowUps({
        tenantId,
        branchId: branchId || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setFollowUps(data);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  }, [tenantId, branchId, statusFilter]);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await apiClient.updateFollowUp(id, { status: newStatus });
      loadFollowUps();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to update follow-up');
    }
  };

  return (
    <div className="p-4 flex-grow-1 overflow-y-auto">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-calendar-check text-warning"></i>
            Scheduled Follow-ups
          </h4>
          <p className="text-muted small mb-0">
            Track scheduled customer consultations, trial follow-ups, and engagement milestones.
          </p>
        </div>

        <div className="d-flex gap-1">
          {['all', 'scheduled', 'completed', 'cancelled'].map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm text-capitalize px-3 rounded-pill ${
                statusFilter === st ? 'btn-msquare-primary' : 'btn-msquare-outline'
              }`}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger py-2 small mb-3">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border text-warning mb-2" role="status"></div>
          <div>Loading follow-ups...</div>
        </div>
      ) : followUps.length === 0 ? (
        <div className="card border shadow-sm text-center p-5 text-muted">
          <i className="bi bi-calendar-x fs-1 opacity-50 mb-2"></i>
          <h6 className="fw-semibold">No follow-ups found for this filter</h6>
          <small>Select an active enquiry in the inbox to schedule a follow-up.</small>
        </div>
      ) : (
        <div className="row g-3">
          {followUps.map((fu) => {
            const isScheduled = fu.status === 'scheduled';
            const scheduledDate = new Date(fu.scheduledAt);
            const isPast = scheduledDate < new Date() && isScheduled;

            return (
              <div key={fu.id} className="col-12 col-md-6 col-xl-4">
                <div className="card h-100 border shadow-sm">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span
                        className={`badge ${
                          fu.status === 'completed'
                            ? 'bg-success'
                            : fu.status === 'cancelled'
                              ? 'bg-secondary'
                              : isPast
                                ? 'bg-danger'
                                : 'bg-warning text-dark'
                        }`}
                      >
                        {isPast ? 'OVERDUE' : fu.status.toUpperCase()}
                      </span>
                      <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {scheduledDate.toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </div>

                    <p className="card-text small my-2">
                      {fu.note || <span className="text-muted fst-italic">No note provided</span>}
                    </p>

                    <div className="border-top pt-2 mt-3 d-flex justify-content-between align-items-center">
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-decoration-none text-warning fw-semibold"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => onSelectConversation(fu.conversationId)}
                      >
                        <i className="bi bi-chat-dots me-1"></i>
                        Open Conversation
                      </button>

                      {isScheduled && (
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-outline-success"
                            title="Mark completed"
                            onClick={() => handleUpdateStatus(fu.id, 'completed')}
                          >
                            <i className="bi bi-check2"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            title="Cancel follow-up"
                            onClick={() => handleUpdateStatus(fu.id, 'cancelled')}
                          >
                            <i className="bi bi-x"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
