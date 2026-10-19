import React, { useState } from 'react';
import { Conversation, ConversationStatus } from '@gym-helpdesk/shared-types';
import { apiClient } from '../api/client';

interface StatusModalProps {
  show: boolean;
  conversation: Conversation;
  onClose: () => void;
  onSuccess: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  show,
  conversation,
  onClose,
  onSuccess,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ConversationStatus>(conversation.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!show) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatus === conversation.status) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.updateConversationStatus(conversation.id, selectedStatus);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to update conversation status');
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions: Array<{ value: ConversationStatus; label: string; desc: string; icon: string }> = [
    {
      value: 'open',
      label: 'Open',
      desc: 'Active enquiry needing responses',
      icon: 'bi-chat-left-dots text-success',
    },
    {
      value: 'on_hold',
      label: 'On Hold',
      desc: 'Waiting on customer response or internal action',
      icon: 'bi-pause-circle text-warning',
    },
    {
      value: 'resolved',
      label: 'Resolved',
      desc: 'Customer question resolved; marks resolution time',
      icon: 'bi-check2-circle text-primary',
    },
    {
      value: 'closed',
      label: 'Closed',
      desc: 'Formally closed archive',
      icon: 'bi-archive text-secondary',
    },
  ];

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border">
          <div className="modal-header">
            <h5 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
              <i className="bi bi-tag text-warning"></i>
              Manage Conversation Status
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

              <div className="list-group">
                {statusOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`list-group-item list-group-item-action d-flex align-items-center gap-3 p-3 border ${
                      selectedStatus === opt.value ? 'border-warning bg-body-tertiary' : ''
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      className="form-check-input flex-shrink-0"
                      type="radio"
                      name="statusOptions"
                      value={opt.value}
                      checked={selectedStatus === opt.value}
                      onChange={() => setSelectedStatus(opt.value)}
                    />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2">
                        <i className={`bi ${opt.icon} fs-5`}></i>
                        <span className="fw-semibold">{opt.label}</span>
                      </div>
                      <small className="text-muted d-block mt-1">{opt.desc}</small>
                    </div>
                  </label>
                ))}
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
                Update Status
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
