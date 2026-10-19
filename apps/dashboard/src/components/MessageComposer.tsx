import React, { useState } from 'react';

interface MessageComposerProps {
  onSendMessage: (text: string) => Promise<void>;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({ onSendMessage, disabled = false }) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting || disabled) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSendMessage(trimmed);
      setText('');
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to send WhatsApp message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="message-composer-wrapper">
      {error && (
        <div className="alert alert-danger py-1 px-3 small d-flex align-items-center justify-content-between mb-2">
          <span>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </span>
          <button
            type="button"
            className="btn-close btn-close-sm"
            onClick={() => setError(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      <div className="d-flex align-items-end gap-2">
        <textarea
          className="form-control message-input"
          rows={2}
          placeholder="Type a WhatsApp reply... (Press Enter to send, Shift+Enter for new line)"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSubmitting}
          style={{ resize: 'none' }}
        />

        <button
          type="button"
          className="btn btn-msquare-primary d-flex align-items-center justify-content-center px-3"
          style={{ height: '58px', minWidth: '58px' }}
          onClick={handleSend}
          disabled={!text.trim() || isSubmitting || disabled}
          title="Send WhatsApp message"
        >
          {isSubmitting ? (
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          ) : (
            <i className="bi bi-send-fill fs-5"></i>
          )}
        </button>
      </div>
    </div>
  );
};
