import React, { useState } from 'react';

// tabs: [{ id, label, content }]
export default function TabLayout({ tabs }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: '2px',
        marginBottom: 'var(--space-lg)',
        borderBottom: '2px solid rgba(255,255,255,0.08)',
      }}>
        {tabs.map(tab => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              style={{
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'var(--font-body)',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--color-orange)' : 'rgba(255,255,255,0.45)',
                borderBottom: isActive
                  ? '2px solid var(--color-orange)'
                  : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'color 0.2s, border-color 0.2s',
                letterSpacing: '0.01em',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {tabs.find(t => t.id === active)?.content}
    </div>
  );
}
