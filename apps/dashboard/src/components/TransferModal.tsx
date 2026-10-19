import React, { useState, useEffect } from 'react';
import { Conversation, EligibleChatAgent } from '@gym-helpdesk/shared-types';
import { apiClient } from '../api/client';

interface TransferModalProps {
  show: boolean;
  conversation: Conversation;
  currentAgentName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  show,
  conversation,
  currentAgentName,
  onClose,
  onSuccess,
}) => {
  const [agents, setAgents] = useState<EligibleChatAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show && conversation.branchId) {
      setLoading(true);
      setError(null);
      apiClient
        .listBranchChatAgents(conversation.branchId)
        .then((data) => {
          // Filter out current agent
          const eligibleOtherAgents = data.filter(
            (a) => a.employeeId !== conversation.assignedEmployeeId,
          );
          setAgents(eligibleOtherAgents);
          if (eligibleOtherAgents.length > 0) {
            setSelectedAgentId(eligibleOtherAgents[0].employeeId);
          }
        })
        .catch((err) => {
          setError((err as Error)?.message || 'Failed to load eligible agents');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [show, conversation.branchId, conversation.assignedEmployeeId]);

  if (!show) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) return;

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.transferConversation(conversation.id, selectedAgentId);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to transfer conversation');
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
              <i className="bi bi-arrow-left-right text-warning"></i>
              Transfer Conversation
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={submitting}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger py-2 small mb-3">
                  <i className="bi bi-exclamation-circle-fill me-2"></i>
                  {error}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label small text-muted">Current Assignee</label>
                <div className="form-control form-control-sm bg-body-tertiary fw-medium">
                  {currentAgentName || conversation.assignedEmployeeId || 'Unassigned'}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">
                  Transfer to Eligible Agent <span className="text-danger">*</span>
                </label>
                {loading ? (
                  <div className="d-flex align-items-center gap-2 text-muted py-2">
                    <span className="spinner-border spinner-border-sm text-warning"></span>
                    <span className="small">Checking eligible branch agents...</span>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="alert alert-warning py-2 small">
                    No other eligible chat agents currently active in this branch.
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    required
                  >
                    {agents.map((agent) => (
                      <option key={agent.employeeId} value={agent.employeeId}>
                        {agent.fullName} ({agent.designationName || 'Support Agent'})
                      </option>
                    ))}
                  </select>
                )}
                <div className="form-text small text-muted" style={{ fontSize: '0.75rem' }}>
                  Only active, chat-eligible employees in this branch are displayed.
                </div>
              </div>
            </div>

            <div className="modal-footer py-2">
              <button type="button" className="btn btn-sm btn-msquare-outline" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-msquare-primary d-flex align-items-center gap-1"
                disabled={submitting || !selectedAgentId || loading}
              >
                {submitting && <span className="spinner-border spinner-border-sm" role="status"></span>}
                Confirm Transfer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
