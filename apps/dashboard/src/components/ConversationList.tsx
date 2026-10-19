import React, { useState } from 'react';
import { Conversation, ConversationStatus, Lead } from '@gym-helpdesk/shared-types';

interface ConversationListProps {
  conversations: Conversation[];
  leadsMap: Record<string, Lead>;
  employeesMap: Record<string, string>;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  statusFilter: ConversationStatus | 'all';
  onStatusFilterChange: (status: ConversationStatus | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  leadsMap,
  employeesMap,
  selectedConversationId,
  onSelectConversation,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  loading,
  page,
  totalPages,
  onPageChange,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  const getStatusBadgeClass = (status: ConversationStatus) => {
    switch (status) {
      case 'open':
        return 'badge-open';
      case 'on_hold':
        return 'badge-on_hold';
      case 'resolved':
        return 'badge-resolved';
      case 'closed':
        return 'badge-closed';
      default:
        return 'bg-secondary text-white';
    }
  };

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="conversation-list-pane d-flex flex-column h-100">
      {/* Search Header */}
      <div className="p-3 border-bottom">
        <form onSubmit={handleSearchSubmit} className="mb-2">
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-body-tertiary border-end-0">
              <i className="bi bi-search text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control bg-body-tertiary border-start-0"
              placeholder="Search phone, name, ID..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                if (e.target.value === '') onSearchChange('');
              }}
            />
            {localSearch && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setLocalSearch('');
                  onSearchChange('');
                }}
              >
                &times;
              </button>
            )}
          </div>
        </form>

        {/* Filter Pills */}
        <div className="d-flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {(['all', 'open', 'on_hold', 'resolved'] as const).map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm text-capitalize px-2.5 py-0 rounded-pill ${
                statusFilter === st ? 'btn-msquare-primary' : 'btn-msquare-outline'
              }`}
              style={{ fontSize: '0.76rem' }}
              onClick={() => onStatusFilterChange(st)}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* List Container */}
      <div className="flex-grow-1 overflow-y-auto">
        {loading ? (
          <div className="d-flex flex-column align-items-center justify-content-center p-5 text-muted">
            <div className="spinner-border spinner-border-sm text-warning mb-2" role="status"></div>
            <div className="small">Loading conversations...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-muted">
            <i className="bi bi-chat-square-dots fs-1 d-block mb-2 opacity-50"></i>
            <div className="fw-semibold">No conversations found</div>
            <div className="small mt-1">Try clearing filters or search criteria.</div>
          </div>
        ) : (
          conversations.map((conv) => {
            const lead = leadsMap[conv.leadId];
            const customerName = lead?.name || lead?.phoneNumber || `Lead ${conv.leadId.substring(0, 8)}`;
            const customerPhone = lead?.phoneNumber || 'No phone recorded';
            const assignedName = conv.assignedEmployeeId
              ? employeesMap[conv.assignedEmployeeId] || 'Assigned Agent'
              : 'Unassigned';
            const isSelected = conv.id === selectedConversationId;

            return (
              <div
                key={conv.id}
                className={`conversation-item ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className="d-flex justify-content-between align-items-start mb-1">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold"
                      style={{
                        width: '36px',
                        height: '36px',
                        fontSize: '0.85rem',
                        background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-hover))',
                      }}
                    >
                      {customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="fw-semibold text-truncate" style={{ maxWidth: '170px' }}>
                        {customerName}
                      </div>
                      <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                        <i className="bi bi-whatsapp text-success me-1"></i>
                        {customerPhone}
                      </div>
                    </div>
                  </div>

                  <div className="text-end">
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {formatTimestamp(conv.lastMessageAt || conv.createdAt)}
                    </span>
                    <div className="mt-1">
                      <span className={`badge rounded-pill text-uppercase ${getStatusBadgeClass(conv.status)}`} style={{ fontSize: '0.62rem' }}>
                        {conv.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between text-muted mt-2" style={{ fontSize: '0.74rem' }}>
                  <span className="text-truncate" style={{ maxWidth: '200px' }}>
                    <i className="bi bi-person me-1"></i>
                    {assignedName}
                  </span>
                  <span className="badge bg-body-tertiary border text-secondary" style={{ fontSize: '0.65rem' }}>
                    {conv.id.substring(0, 8)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-2 border-top d-flex align-items-center justify-content-between small text-muted">
          <button
            type="button"
            className="btn btn-sm btn-msquare-outline py-0 px-2"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-msquare-outline py-0 px-2"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
