import { useState } from 'react';

const STORAGE_KEY = 'stk_cutover_notice_v1';

export default function CutoverNotice() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage unavailable — dismiss for this session only
    }
    setDismissed(true);
  };

  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6"
      style={{ paddingTop: '12px' }}
    >
      <div
        className="flex items-center justify-between gap-3"
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderLeft: '3px solid var(--color-orange)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          fontSize: '13px',
          lineHeight: 1.5,
          color: 'var(--color-text-light)',
        }}
      >
        <span>
          ⚡ Engine upgraded — now built on all five BBM seasons. Grades are
          tougher and more honest than before. If a roster you graded earlier
          comes back lower now, it didn't get worse — the bar got higher.
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notice"
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-light)',
            fontSize: '16px',
            lineHeight: 1,
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          &times;
        </button>
      </div>
    </div>
  );
}
