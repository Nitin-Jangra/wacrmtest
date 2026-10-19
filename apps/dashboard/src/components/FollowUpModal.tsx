import React, { useState } from 'react';
import { Conversation } from '@gym-helpdesk/shared-types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface FollowUpModalProps {
  show: boolean;
  conversation: Conversation;
  onClose: () => void;
  onSuccess: () => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  show,
  conversation,
  onClose,
  onSuccess,
}) => {
  const { employeeId } = useAuth();
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    // Default to tomorrow 10:00 AM
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!show) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const targetDate = new Date(scheduledAt);
      if (isNaN(targetDate.getTime())) {
        throw new Error('Please select a valid date and time.');
      }

      const assignedEmpId = conversation.assignedEmployeeId || employeeId;
      if (!assignedEmpId) {
        throw new Error('Conversation has no assigned employee to own this follow-up.');
      }

      await apiClient.scheduleFollowUp({
        tenantId: conversation.tenantId,
        branchId: conversation.branchId,
        conversationId: conversation.id,
        assignedEmployeeId: assignedEmpId,
        scheduledAt: targetDate.toISOString(),
        status: 'scheduled',
        note: note.trim() || null,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to schedule follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border">
          <div className="modal-header">
            <h5 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
              <i className="bi bi-clock-history text-warning"></i>
              Schedule Customer Follow-up
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={submitting}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger py-2 small mb-3">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label small fw-semibold">
                  Scheduled Date & Time <span className="text-danger">*</span>
                </label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Notes / Purpose</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. Call regarding M Square custom automation and onboarding..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer py-2">
              <button type="button" className="btn btn-sm btn-msquare-outline" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-msquare-primary d-flex align-items-center gap-1"
                disabled={submitting}
              >
                {submitting && <span className="spinner-border spinner-border-sm" role="status"></span>}
                Save Follow-up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
