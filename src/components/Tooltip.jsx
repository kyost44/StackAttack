/**
 * Tooltip.jsx
 * Hover (desktop) / tap-toggle (mobile) tooltip wrapper.
 * Usage: <Tooltip content="Tooltip text"><YourElement /></Tooltip>
 */

import { useState, useRef, useCallback } from 'react';

export default function Tooltip({ content, children, position = 'top' }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const show = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), 180);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const toggleTouch = useCallback((e) => {
    e.stopPropagation();
    setVisible(v => !v);
  }, []);

  if (!content) return children;

  // Position classes
  const posClasses = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position] ?? 'bottom-full left-1/2 -translate-x-1/2 mb-2';

  const arrowClasses = {
    top:    'top-full left-1/2 -translate-x-1/2 border-t-slate-700 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-700 border-l-transparent border-r-transparent border-t-transparent',
    left:   'left-full top-1/2 -translate-y-1/2 border-l-slate-700 border-t-transparent border-b-transparent border-r-transparent',
    right:  'right-full top-1/2 -translate-y-1/2 border-r-slate-700 border-t-transparent border-b-transparent border-l-transparent',
  }[position] ?? 'top-full left-1/2 -translate-x-1/2 border-t-slate-700 border-l-transparent border-r-transparent border-b-transparent';

  return (
    <span
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onTouchStart={toggleTouch}
    >
      {children}
      {visible && (
        <div
          className={`absolute z-50 ${posClasses} px-3 py-2 rounded-lg text-xs text-slate-100
                      bg-slate-700 border border-slate-600 shadow-xl pointer-events-none
                      max-w-64 leading-relaxed`}
          role="tooltip"
        >
          {content}
          {/* Arrow */}
          <span
            className={`absolute ${arrowClasses} w-0 h-0 border-4`}
          />
        </div>
      )}
    </span>
  );
}
