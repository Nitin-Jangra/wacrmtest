import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message, Lead } from '@gym-helpdesk/shared-types';
import { apiClient } from '../api/client';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { TransferModal } from './TransferModal';
import { StatusModal } from './StatusModal';
import { FollowUpModal } from './FollowUpModal';

interface ConversationDetailProps {
  conversation: Conversation | null;
  lead: Lead | null;
  assignedAgentName?: string;
  onBackToList?: () => void;
  onConversationUpdated: () => void;
}

export const ConversationDetail: React.FC<ConversationDetailProps> = ({
  conversation,
  lead,
  assignedAgentName,
  onBackToList,
  onConversationUpdated,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (convId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.listMessages(convId, 1, 100);
      // Backend returns newest first or oldest first; sort ascending chronologically
      const sorted = [...res.data].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(sorted);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load conversation messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (conversation?.id) {
      loadMessages(conversation.id);
    } else {
      setMessages([]);
    }
  }, [conversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!conversation) return;
    const sent = await apiClient.sendTextMessage(conversation.id, text);
    setMessages((prev) => [...prev, sent]);
    onConversationUpdated();
  };

  if (!conversation) {
    return (
      <div className="chat-detail-pane d-flex flex-column align-items-center justify-content-center text-muted p-5">
        <i className="bi bi-chat-left-quote display-3 text-secondary-subtle mb-3"></i>
        <h5 className="fw-semibold">No Conversation Selected</h5>
        <p className="small text-center" style={{ maxWidth: '320px' }}>
          Select a customer enquiry from the inbox to read WhatsApp messages and reply.
        </p>
      </div>
    );
  }

  const customerName = lead?.name || lead?.phoneNumber || `Lead ${conversation.leadId.substring(0, 8)}`;
  const customerPhone = lead?.phoneNumber || 'No phone recorded';

  return (
    <div className="chat-detail-pane d-flex flex-column h-100">
      {/* Top Header */}
      <div
        className="p-3 border-bottom shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <div className="d-flex align-items-center gap-3">
          {/* Mobile Back Button */}
          {onBackToList && (
            <button
              type="button"
              className="btn btn-sm btn-msquare-outline d-md-none"
              onClick={onBackToList}
              title="Back to inbox"
            >
              <i className="bi bi-arrow-left"></i>
            </button>
          )}

          <div
            className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-sm"
            style={{
              width: '42px',
              height: '42px',
              fontSize: '1rem',
              background: 'linear-gradient(135deg, var(--brand-orange), var(--brand-orange-hover))',
            }}
          >
            {customerName.charAt(0).toUpperCase()}
          </div>

          <div>
            <div className="d-flex align-items-center gap-2">
              <h6 className="mb-0 fw-bold">{customerName}</h6>
              <span
                className={`badge rounded-pill text-uppercase ${
                  conversation.status === 'open'
                    ? 'badge-open'
                    : conversation.status === 'on_hold'
                      ? 'badge-on_hold'
                      : 'badge-resolved'
                }`}
                style={{ fontSize: '0.65rem' }}
              >
                {conversation.status.replace('_', ' ')}
              </span>
            </div>
            <div className="text-muted small mt-1 d-flex align-items-center gap-3" style={{ fontSize: '0.78rem' }}>
              <span>
                <i className="bi bi-whatsapp text-success me-1"></i>
                {customerPhone}
              </span>
              <span>
                <i className="bi bi-person-badge text-secondary me-1"></i>
                {assignedAgentName || 'Unassigned'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-msquare-outline d-flex align-items-center gap-1"
            onClick={() => setShowFollowUpModal(true)}
            title="Schedule Follow-up"
          >
            <i className="bi bi-calendar-plus text-warning"></i>
            <span className="d-none d-sm-inline">Follow-up</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-msquare-outline d-flex align-items-center gap-1"
            onClick={() => setShowTransferModal(true)}
            title="Transfer to agent"
          >
            <i className="bi bi-arrow-left-right text-primary"></i>
            <span className="d-none d-sm-inline">Transfer</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-msquare-primary d-flex align-items-center gap-1"
            onClick={() => setShowStatusModal(true)}
            title="Change conversation status"
          >
            <i className="bi bi-sliders"></i>
            <span>Status</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="messages-container">
        {loading ? (
          <div className="d-flex flex-column align-items-center justify-content-center p-5 text-muted">
            <div className="spinner-border text-success mb-2" role="status"></div>
            <span className="small">Loading WhatsApp message history...</span>
          </div>
        ) : error ? (
          <div className="alert alert-danger mx-auto mt-4 p-3 small" style={{ maxWidth: '400px' }}>
            <i className="bi bi-exclamation-octagon-fill me-2"></i>
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted my-auto p-4">
            <i className="bi bi-chat-text fs-2 d-block mb-2 text-black-50"></i>
            <div className="fw-semibold">No messages yet in this conversation</div>
            <div className="small text-secondary mt-1">
              Send a WhatsApp message below to initiate dialogue.
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        disabled={conversation.status === 'closed'}
      />

      {/* Modals */}
      <TransferModal
        show={showTransferModal}
        conversation={conversation}
        currentAgentName={assignedAgentName}
        onClose={() => setShowTransferModal(false)}
        onSuccess={() => {
          onConversationUpdated();
          if (conversation) loadMessages(conversation.id);
        }}
      />

      <StatusModal
        show={showStatusModal}
        conversation={conversation}
        onClose={() => setShowStatusModal(false)}
        onSuccess={() => {
          onConversationUpdated();
          if (conversation) loadMessages(conversation.id);
        }}
      />

      <FollowUpModal
        show={showFollowUpModal}
        conversation={conversation}
        onClose={() => setShowFollowUpModal(false)}
        onSuccess={() => {
          onConversationUpdated();
        }}
      />
    </div>
  );
};
