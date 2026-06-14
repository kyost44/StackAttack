import React from 'react';

const ARCHETYPE_COLORS = {
  'The Blueprint':       'var(--archetype-blueprint)',
  'The Apex Predator':   'var(--archetype-apex)',
  'Value Merchant':      'var(--archetype-value-merchant)',
  'The Juggernaut':      'var(--archetype-juggernaut)',
  'Glass Cannon':        'var(--archetype-glass-cannon)',
  'The Sentinel':        'var(--archetype-sentinel)',
  'The Tactician':       'var(--archetype-tactician)',
  'The Sprinter':        'var(--archetype-sprinter)',
  'Lightning in a Bottle': 'var(--archetype-lightning)',
  'The Long Shot':       'var(--archetype-long-shot)',
};

export default function ArchetypeCard({ archetype, tagline, description, showFull = false }) {
  const accentColor = ARCHETYPE_COLORS[archetype] || 'var(--color-blue-light)';

  return (
    <div style={{
      backgroundColor: '#1e2d47',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
      boxShadow: 'var(--shadow-card)',
      borderLeft: `5px solid ${accentColor}`,
      marginBottom: 'var(--space-md)',
    }}>
      {/* Label */}
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)',
        marginBottom: 'var(--space-xs)',
        fontFamily: 'var(--font-mono)',
      }}>
        ARCHETYPE
      </div>

      {/* Archetype name */}
      <div style={{
        fontSize: '26px',
        fontWeight: 800,
        fontFamily: 'var(--font-display)',
        color: accentColor,
        marginBottom: 'var(--space-xs)',
        lineHeight: 1.1,
      }}>
        {archetype}
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: '14px',
        color: 'rgba(255,255,255,0.6)',
        fontStyle: 'italic',
        marginBottom: showFull && description ? 'var(--space-md)' : 0,
      }}>
        {tagline}
      </div>

      {/* Full description — Nerd Report only */}
      {showFull && description && (
        <div style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.55)',
          lineHeight: 1.65,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 'var(--space-md)',
        }}>
          {description}
        </div>
      )}
    </div>
  );
}
