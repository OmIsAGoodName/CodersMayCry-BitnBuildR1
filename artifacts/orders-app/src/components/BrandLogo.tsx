import { useState, useEffect, useRef } from 'react';

export function BrandLogo() {
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchMode, setGlitchMode] = useState<'hover' | 'periodic'>('hover');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerGlitch = (mode: 'hover' | 'periodic' = 'hover') => {
    if (isGlitching) return;
    setGlitchMode(mode);
    setIsGlitching(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Snappy 280ms duration on hover, 420ms on periodic
    const duration = mode === 'hover' ? 280 : 420;
    timeoutRef.current = setTimeout(() => {
      setIsGlitching(false);
    }, duration);
  };

  useEffect(() => {
    // Quick preview glitch 1.5s after initial load
    const initialTimer = setTimeout(() => {
      triggerGlitch('periodic');
    }, 1500);

    // Periodic glitch every 60s - 100s (1 to ~1.7 minutes)
    let intervalTimer: NodeJS.Timeout;
    const scheduleGlitch = () => {
      const nextInterval = Math.floor(65000 + Math.random() * 40000);
      intervalTimer = setTimeout(() => {
        triggerGlitch('periodic');
        scheduleGlitch();
      }, nextInterval);
    };

    scheduleGlitch();

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(intervalTimer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`brand-logo-wrap ${isGlitching ? `is-glitching mode-${glitchMode}` : ''}`}
      onMouseEnter={() => triggerGlitch('hover')}
      title="Vendora Core · Miles Morales Glitch"
    >
      <img
        src="/vendora-logo.jpg"
        alt="Vendora Logo"
        className="brand-mark"
        style={{ objectFit: 'cover' }}
      />
      {/* Spider-Verse Chromatic Aberration & Slice Ghost Layers */}
      <img
        src="/vendora-logo.jpg"
        alt=""
        className="glitch-layer layer-red"
        aria-hidden="true"
      />
      <img
        src="/vendora-logo.jpg"
        alt=""
        className="glitch-layer layer-cyan"
        aria-hidden="true"
      />
      <div className="glitch-slice" aria-hidden="true" />
    </div>
  );
}
