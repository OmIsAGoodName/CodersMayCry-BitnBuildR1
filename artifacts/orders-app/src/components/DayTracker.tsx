import { useState, useEffect } from 'react';
import { Calendar, Clock, Sparkles, RotateCcw, Zap } from 'lucide-react';

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
    accent: '#FF007F', // Electric Magenta / Hyper Rose
    secondary: '#9B51E0',
    rgb: '255, 0, 127',
    themeTitle: 'Magenta Volt',
    badge: '⚡ Audit & Rest',
    tagline: 'Ledger reconciliation, weekly tally & supplier dues review',
    marketMood: 'Quiet hours · Cashflow reconciliation'
  },
  {
    dayIndex: 1,
    short: 'MON',
    name: 'Monday',
    indicName: 'Somvar',
    accent: '#FF1E56', // Miles Signature Crimson Red
    secondary: '#FF5E62',
    rgb: '255, 30, 86',
    themeTitle: 'Crimson Surge',
    badge: '⚡ Week Kickoff',
    tagline: 'Fresh intake, stock allocation & rapid dispatches',
    marketMood: 'High order inflow · Rapid priority dispatch'
  },
  {
    dayIndex: 2,
    short: 'TUE',
    name: 'Tuesday',
    indicName: 'Mangalvar',
    accent: '#FFB800', // Venom Blast Bio-Electric Gold
    secondary: '#FF7700',
    rgb: '255, 184, 0',
    themeTitle: 'Venom Spark',
    badge: '⚡ Peak Velocity',
    tagline: 'Active pipeline delivery, bulk order execution & procurement',
    marketMood: 'Full capacity throughput · Steady dispatches'
  },
  {
    dayIndex: 3,
    short: 'WED',
    name: 'Wednesday',
    indicName: 'Budhvar',
    accent: '#00F5A0', // Cyber Mint / Emerald Green
    secondary: '#00D9F5',
    rgb: '0, 245, 160',
    themeTitle: 'Cyber Mint',
    badge: '⚡ Midweek Sync',
    tagline: 'Inventory balancing, customer follow-ups & credit collections',
    marketMood: 'Balanced ledger · Customer credit reminders'
  },
  {
    dayIndex: 4,
    short: 'THU',
    name: 'Thursday',
    indicName: 'Guruvar',
    accent: '#A855F7', // Spider-Verse Multiverse Purple
    secondary: '#EC4899',
    rgb: '168, 85, 247',
    themeTitle: 'Rift Violet',
    badge: '⚡ High Capacity',
    tagline: 'Workshop throughput, custom orders & weekend staging',
    marketMood: 'Heavy production load · Prep for weekend peak'
  },
  {
    dayIndex: 5,
    short: 'FRI',
    name: 'Friday',
    indicName: 'Shukravar',
    accent: '#00D2FF', // Electric Cyan / Sky Volt
    secondary: '#3B82F6',
    rgb: '0, 210, 255',
    themeTitle: 'Electric Cyan',
    badge: '⚡ Weekend Prep',
    tagline: 'Bazaar rush dispatches, payment collections & weekend orders',
    marketMood: 'Bazaar acceleration · High customer counter footfall'
  },
  {
    dayIndex: 6,
    short: 'SAT',
    name: 'Saturday',
    indicName: 'Shanivar',
    accent: '#FF5400', // Street Flame Orange
    secondary: '#FF0055',
    rgb: '255, 84, 0',
    themeTitle: 'Street Flame',
    badge: '⚡ Bazaar Peak',
    tagline: 'Maximum counter traffic, spot billing & quick turnover',
    marketMood: 'Peak retail volume · Immediate cash settlement'
  }
];

export function applyDayTheme(dayIndex: number) {
  const theme = DAY_THEMES[dayIndex] || DAY_THEMES[1];
  const root = document.documentElement;
  root.setAttribute('data-day', String(dayIndex));
  root.style.setProperty('--day-accent', theme.accent);
  root.style.setProperty('--day-accent-secondary', theme.secondary);
  root.style.setProperty('--day-accent-rgb', theme.rgb);
  root.style.setProperty('--day-glow', `rgba(${theme.rgb}, 0.35)`);
  root.style.setProperty('--day-border', `rgba(${theme.rgb}, 0.45)`);
  root.style.setProperty('--day-bg-tint', `rgba(${theme.rgb}, 0.08)`);
}

interface DayTrackerProps {
  todayLoadCount: number;
  outstandingAmount: string;
}

export function DayTracker({ todayLoadCount, outstandingAmount }: DayTrackerProps) {
  const actualToday = new Date().getDay();
  const [activeDay, setActiveDay] = useState<number>(actualToday);
  const [timeStr, setTimeStr] = useState<string>('');

  // Apply theme when activeDay changes
  useEffect(() => {
    applyDayTheme(activeDay);
  }, [activeDay]);

  // Live clock ticker
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
                <Zap size={11} />
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
                title="Reset chromatic theme to today"
              >
                <RotateCcw size={12} />
                <span>Reset to Today</span>
              </button>
            )}
          </div>
        </div>

        {/* 7-Day Interactive Pill Bar */}
        <div className="day-pills-strip">
          <div className="day-pills-label">
            <span>WEEK CHROMA</span>
            <span className="day-pills-hint">Glance-ready palette</span>
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
                    '--pill-glow': `rgba(${theme.rgb}, 0.4)`,
                    '--pill-bg': `rgba(${theme.rgb}, 0.12)`
                  } as React.CSSProperties}
                  onClick={() => setActiveDay(theme.dayIndex)}
                  title={`${theme.name} (${theme.indicName}) - ${theme.themeTitle} palette`}
                >
                  <span
                    className="day-pill-dot"
                    style={{
                      backgroundColor: theme.accent,
                      boxShadow: isSelected ? `0 0 10px ${theme.accent}` : 'none'
                    }}
                  />
                  <span className="day-pill-text">{theme.short}</span>
                  {isToday && <span className="day-pill-today-badge">NOW</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Market Mood Ticker */}
        <div className="day-mood-bar">
          <div className="mood-item">
            <Sparkles size={13} style={{ color: currentTheme.accent }} />
            <span><strong>Trade Pulse:</strong> {currentTheme.marketMood}</span>
          </div>
          <div className="mood-quick-stats">
            <span>Today's Load: <strong style={{ color: currentTheme.accent }}>{todayLoadCount} orders</strong></span>
            <span className="mood-sep">·</span>
            <span>Outstanding: <strong style={{ color: '#FF4D6D' }}>{outstandingAmount}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
