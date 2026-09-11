import { useState, useEffect } from 'react';
import { Calendar, Clock, RotateCcw, Tag } from 'lucide-react';

export interface DayTheme {
  dayIndex: number; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  short: string;
  name: string;
  indicName: string;
  accent: string;
  secondary: string;
  rgb: string;
  themeTitle: string;
  badge: string;
  tagline: string;
  marketMood: string;
}

export const DAY_THEMES: DayTheme[] = [
  {
    dayIndex: 0,
    short: 'SUN',
    name: 'Sunday',
    indicName: 'Ravivar',
    accent: '#E0245E', // Solid Crimson-Pink
    secondary: '#8B5CF6',
    rgb: '224, 36, 94',
    themeTitle: 'Weekend Audit',
    badge: 'Sunday Tally',
    tagline: 'Weekly ledger reconciliation, supplier balance audit & rest',
    marketMood: 'Quiet hours · Weekly tally & cashbook reconciliation'
  },
  {
    dayIndex: 1,
    short: 'MON',
    name: 'Monday',
    indicName: 'Somvar',
    accent: '#E63946', // Solid Crimson Red
    secondary: '#F4A261',
    rgb: '230, 57, 70',
    themeTitle: 'Week Kickoff',
    badge: 'Market Opening',
    tagline: 'Fresh order intake, morning stock commitments & dispatches',
    marketMood: 'High order inflow · Rapid priority dispatch'
  },
  {
    dayIndex: 2,
    short: 'TUE',
    name: 'Tuesday',
    indicName: 'Mangalvar',
    accent: '#F59E0B', // Solid Amber Gold
    secondary: '#D97706',
    rgb: '245, 158, 11',
    themeTitle: 'Full Velocity',
    badge: 'Throughput',
    tagline: 'Bulk order execution, workshop throughput & supplier dispatches',
    marketMood: 'Full capacity processing · Steady customer orders'
  },
  {
    dayIndex: 3,
    short: 'WED',
    name: 'Wednesday',
    indicName: 'Budhvar',
    accent: '#10B981', // Solid Emerald Green
    secondary: '#059669',
    rgb: '16, 185, 129',
    themeTitle: 'Midweek Balance',
    badge: 'Midweek Sync',
    tagline: 'Inventory balancing, customer payment reminders & credit follow-ups',
    marketMood: 'Balanced ledger · Customer credit reminders & collections'
  },
  {
    dayIndex: 4,
    short: 'THU',
    name: 'Thursday',
    indicName: 'Guruvar',
    accent: '#8B5CF6', // Solid Royal Purple
    secondary: '#6D28D9',
    rgb: '139, 92, 246',
    themeTitle: 'High Capacity',
    badge: 'Peak Workshop',
    tagline: 'Custom orders, heavy production throughput & weekend staging',
    marketMood: 'Heavy production load · Staging weekend batches'
  },
  {
    dayIndex: 5,
    short: 'FRI',
    name: 'Friday',
    indicName: 'Shukravar',
    accent: '#0284C7', // Solid Electric Cobalt Blue
    secondary: '#0369A1',
    rgb: '2, 132, 199',
    themeTitle: 'Weekend Rush',
    badge: 'Bazaar Rush',
    tagline: 'Counter footfall, immediate delivery handoffs & weekend stocks',
    marketMood: 'Bazaar acceleration · High customer counter footfall'
  },
  {
    dayIndex: 6,
    short: 'SAT',
    name: 'Saturday',
    indicName: 'Shanivar',
    accent: '#EA580C', // Solid Rust-Flame Orange
    secondary: '#C2410C',
    rgb: '234, 88, 12',
    themeTitle: 'Bazaar Peak',
    badge: 'Peak Volume',
    tagline: 'Maximum counter traffic, spot billing & quick turnarounds',
    marketMood: 'Peak retail volume · Spot payment & counter collections'
  }
];

export function applyDayTheme(dayIndex: number) {
  const theme = DAY_THEMES[dayIndex] || DAY_THEMES[1];
  const root = document.documentElement;
  root.setAttribute('data-day', String(dayIndex));
  root.style.setProperty('--day-accent', theme.accent);
  root.style.setProperty('--day-accent-secondary', theme.secondary);
  root.style.setProperty('--day-accent-rgb', theme.rgb);
  root.style.setProperty('--day-border', theme.accent);
  root.style.setProperty('--day-bg-tint', `rgba(${theme.rgb}, 0.1)`);
}

interface DayTrackerProps {
  todayLoadCount: number;
  outstandingAmount: string;
}

export function DayTracker({ todayLoadCount, outstandingAmount }: DayTrackerProps) {
  const actualToday = new Date().getDay();
  const [activeDay, setActiveDay] = useState<number>(actualToday);
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    applyDayTheme(activeDay);
  }, [activeDay]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentTheme = DAY_THEMES[activeDay] || DAY_THEMES[actualToday];
  const isActualToday = activeDay === actualToday;

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="day-tracker-card" data-testid="day-tracker-card">
      <div className="day-tracker-inner">
        {/* Top Header Row */}
        <div className="day-tracker-header">
          <div className="day-title-group">
            <div className="day-name-row">
              <span className="day-pill-badge" style={{ borderColor: currentTheme.accent, color: currentTheme.accent }}>
                <Tag size={11} />
                {currentTheme.badge}
              </span>
              <h2 className="day-main-heading">
                {currentTheme.name}
                <span className="day-indic-tag"> · {currentTheme.indicName}</span>
              </h2>
            </div>
            <p className="day-tagline">{currentTheme.tagline}</p>
          </div>

          <div className="day-meta-group">
            <div className="day-clock-chip" title="Current Local Time (IST)">
              <Clock size={13} style={{ color: currentTheme.accent }} />
              <span>{timeStr || 'LIVE'}</span>
            </div>

            <div className="day-date-chip">
              <Calendar size={13} />
              <span>{formattedDate}</span>
            </div>

            {!isActualToday && (
              <button
                className="day-reset-btn"
                onClick={() => setActiveDay(actualToday)}
                title="Reset color palette to today"
              >
                <RotateCcw size={12} />
                <span>Reset to Today</span>
              </button>
            )}
          </div>
        </div>

        {/* 7-Day Solid Tactile Pill Bar */}
        <div className="day-pills-strip">
          <div className="day-pills-label">
            <span>WEEK PALETTE</span>
            <span className="day-pills-hint">Daily solid indicator</span>
          </div>
          <div className="day-pills-list">
            {DAY_THEMES.map((theme) => {
              const isSelected = theme.dayIndex === activeDay;
              const isToday = theme.dayIndex === actualToday;

              return (
                <button
                  key={theme.dayIndex}
                  type="button"
                  className={`day-pill-btn ${isSelected ? 'active' : ''} ${isToday ? 'is-today' : ''}`}
                  style={{
                    '--pill-accent': theme.accent,
                    '--pill-bg': theme.accent
                  } as React.CSSProperties}
                  onClick={() => setActiveDay(theme.dayIndex)}
                  title={`${theme.name} (${theme.indicName}) palette`}
                >
                  <span
                    className="day-pill-dot"
                    style={{ backgroundColor: theme.accent }}
                  />
                  <span className="day-pill-text">{theme.short}</span>
                  {isToday && <span className="day-pill-today-badge">TODAY</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Solid Trade Bar */}
        <div className="day-mood-bar">
          <div className="mood-item">
            <span className="mood-dot" style={{ backgroundColor: currentTheme.accent }} />
            <span><strong>Trade Focus:</strong> {currentTheme.marketMood}</span>
          </div>
          <div className="mood-quick-stats">
            <span>Today's Load: <strong style={{ color: currentTheme.accent }}>{todayLoadCount} orders</strong></span>
            <span className="mood-sep">|</span>
            <span>Outstanding: <strong style={{ color: '#EF4444' }}>{outstandingAmount}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
