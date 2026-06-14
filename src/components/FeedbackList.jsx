import React from 'react';

export default function FeedbackList({ items, limit, accentColor }) {
  if (!items || items.length === 0) return null;
  const displayed = limit ? items.slice(0, limit) : items;
  const borderColor = accentColor || 'var(--color-blue-light)';

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {displayed.map((item, i) => (
        <li
          key={i}
          style={{
            padding: '9px 13px',
            marginBottom: 'var(--space-xs)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.7)',
            borderLeft: `3px solid ${borderColor}`,
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
