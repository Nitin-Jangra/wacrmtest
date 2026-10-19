import React from 'react';
import { Message, DeliveryStatus } from '@gym-helpdesk/shared-types';

interface MessageItemProps {
  message: Message;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isInbound = message.direction === 'inbound';

  const renderStatusIcon = (status: DeliveryStatus) => {
    switch (status) {
      case 'pending':
        return <i className="bi bi-clock status-pending" title="Pending delivery"></i>;
      case 'sent':
        return <i className="bi bi-check status-sent" title="Sent to WhatsApp provider"></i>;
      case 'delivered':
        return <i className="bi bi-check-all status-delivered" title="Delivered to user's phone"></i>;
      case 'read':
        return <i className="bi bi-check-all status-read" title="Read by customer"></i>;
      case 'failed':
        return <i className="bi bi-exclamation-circle-fill status-failed" title="Failed to send/deliver"></i>;
      default:
        return null;
    }
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={`message-bubble ${isInbound ? 'inbound' : 'outbound'}`}>
      <div className="message-content text-break">
        {message.body || (message.messageType !== 'text' ? `[${message.messageType.toUpperCase()}]` : '')}
      </div>

      <div className="message-meta">
        <span>{formatTime(message.createdAt)}</span>
        {!isInbound && renderStatusIcon(message.deliveryStatus)}
      </div>

      {message.deliveryStatus === 'failed' && (
        <div className="text-danger small mt-1" style={{ fontSize: '0.7rem' }}>
          <i className="bi bi-info-circle me-1"></i>
          Message delivery failed.
        </div>
      )}
    </div>
  );
};
