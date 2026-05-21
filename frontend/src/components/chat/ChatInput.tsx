'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onSend: (text: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onCancel, isStreaming, disabled, placeholder }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <div
      className="w-full border-t border-sand"
      style={{ background: 'var(--color-canvas-white)' }}
    >
      <div className="max-w-[920px] mx-auto px-6 py-4">
        <div className="flex items-end gap-2 input-bordered" style={{ padding: '8px 10px' }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            disabled={disabled}
            className="input-bare resize-none py-1.5"
            placeholder={placeholder ?? 'Send a message…'}
            style={{ maxHeight: 160 }}
          />
          {isStreaming ? (
            <button type="button" className="btn btn-outline" onClick={onCancel}>
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-icon"
              onClick={submit}
              disabled={disabled || !value.trim()}
              aria-label="Send message"
            >
              ↑
            </button>
          )}
        </div>
        <div className="mt-2 mono-sm">Enter to send · Shift+Enter for newline</div>
      </div>
    </div>
  );
}
