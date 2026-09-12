import { OrgAuthProvider, useOrgAuth } from '@/context/OrgAuthContext';
import { OrgHeader } from '@/components/OrgHeader';
import { TeamManagementPage } from '@/pages/TeamManagementPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { EmployeeLobbyModal } from '@/components/EmployeeLobbyModal';
import { supabase } from '@/lib/supabase';
import { enqueueMutation, flushPendingMutations, pullCloudOrders, cloudToOrder, syncStoreOrders, orderToCloud, clearPendingMutation } from '@/lib/sync/offlineSyncManager';
import { Users as UsersIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState, useRef, useTransition } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Printer, FileDown, Sun, Moon, AlertTriangle, ArrowRight, BarChart3, CalendarDays, Check, CheckCircle2, ClipboardList,
  CloudOff, Database, Download, FileJson, Filter, Home, Inbox, IndianRupee, MessageSquare,
  Layers3, MoreHorizontal, Plus, RefreshCw, RotateCcw, Search, Mic, MicOff, Settings as SettingsIcon,
  Sparkles, Trash2, Upload, Wifi, WifiOff, X, Zap, Cpu, Play, Key, SlidersHorizontal, Copy, User,
  Menu, ArrowLeft, LogOut
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

import {
  OfflineStorage, Order, Settings, OperationLog, ConflictRecord, generateId, getOrCreateDeviceId, OrderStatus
} from '@/lib/storage/offlineDb';
import {
  parseOrderHybrid, HybridParseResult, AVAILABLE_MODELS, ModelOption,
  getSavedProviderKeys, saveProviderKey, getActiveModelId, setActiveModelId, LLMProvider,
  hasCustomApiKey, resetToManagedApiKey
} from '@/lib/parser/hybridParser';
import { parseUniversalMessage } from '@/lib/parser/universalParser';
import { QueryDesk } from '@/components/QueryDesk';
import { transcribeAudio, getSupportedAudioMimeType, setupAudioAnalyser, isOperaOrNonChrome } from '@/lib/speech/audioTranscriber';

import { applyDayTheme } from '@/components/DayTracker';
import { BrandLogo } from '@/components/BrandLogo';
import { PrintableLedgerModal } from '@/components/PrintableLedgerModal';
import { AuthScreen } from '@/components/AuthScreen';
import { WhatsAppDesk } from '@/components/WhatsAppDesk';

const queryClient = new QueryClient();
const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const STATUS_FILTERS: Array<'all' | OrderStatus> = ['all', 'new', 'in_progress', 'ready', 'completed', 'cancelled'];

function initials(name?: string) {
  if (!name) return 'OP';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function dateOnly(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function dateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateOnly(d);
}

function money(value: number) { return `₹${value.toLocaleString('en-IN')}`; }
function shortDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
function isDue(order: Order) { return order.status !== 'completed' && order.status !== 'cancelled' && order.dueDate <= dateOnly(); }
function dueLabel(order: Order) { if (order.dueDate < dateOnly()) return 'Overdue'; if (order.dueDate === dateOnly()) return 'Today'; return shortDate(order.dueDate); }
function itemText(order: Order) { return order.items.map((item) => `${item.quantity} × ${item.description}`).join(', '); }

function maskKey(key: string): string {
  if (!key) return 'Not set';
  if (key.length <= 10) return '••••••••';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function AppShell({ children, settings, online, pendingSyncCount }: { children: ReactNode; settings: Settings; online: boolean; pendingSyncCount: number }) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { currentMember, organization, currentUser, logout } = useOrgAuth();

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('vendora_theme_mode') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = (e?: React.MouseEvent) => {
    const x = e ? e.clientX : window.innerWidth - 60;
    const y = e ? e.clientY : 30;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const applyThemeUpdate = () => {
      const next = themeMode === 'dark' ? 'light' : 'dark';
      setThemeMode(next);
      try {
        localStorage.setItem('vendora_theme_mode', next);
      } catch {}
      document.documentElement.setAttribute('data-theme', next);
      if (next === 'light') {
        document.body.classList.add('theme-light');
      } else {
        document.body.classList.remove('theme-light');
      }
    };

    // Expanding circular ripple using View Transitions API
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      const transition = (document as any).startViewTransition(() => {
        applyThemeUpdate();
      });

      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ];
        document.documentElement.animate(
          {
            clipPath: clipPath
          },
          {
            duration: 520,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      });
    } else {
      applyThemeUpdate();
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    if (themeMode === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  }, [themeMode]);

  const links = [
    { href: '/', label: 'Workbench', icon: Home },
    { href: '/orders', label: 'Ledger', icon: ClipboardList },
    { href: '/inbox', label: 'Universal Inbox', icon: Inbox },
    { href: '/whatsapp', label: 'WhatsApp Live Desk', icon: MessageSquare },
    { href: '/employees', label: 'Employees', icon: UsersIcon },
    { href: '/query', label: 'Query Desk', icon: BarChart3 },
    { href: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="app-shell">
      {/* Desktop Persistent Sidebar */}
      <aside className="sidebar">
        <Link href="/" className="brand" data-testid="link-brand">
          <BrandLogo />
          <span>
            <span className="brand-name">Vendora</span>
            <span className="brand-sub">Sovereign Offline Orders</span>
          </span>
        </Link>

        {/* Dynamic Operator Profile at Top - Always accessible without scrolling */}
        <Link href="/employees" className="operator-profile-card" title="Click to view/manage Team & Roles Hierarchy">
          <span className="initials">{currentMember?.avatarInitials || 'OW'}</span>
          <div className="operator-info">
            <div className="operator-name-row">
              <strong>{currentMember?.name || "Owner"}</strong>
              <span className={`operator-badge badge-${currentMember?.role || "owner"}`}>{(currentMember?.role || "owner").toUpperCase()}</span>
            </div>
            <small className="operator-domain">{organization?.name || "Store Ledger"}</small>
          </div>
        </Link>
        <div style={{ padding: '0 12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            User: <strong style={{ color: '#38bdf8' }}>@{currentUser?.username || 'user'}</strong>
          </span>
          <button
            onClick={() => logout()}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 7px',
              borderRadius: '6px',
            }}
            title="Sign Out"
          >
            <LogOut size={11} />
            <span>Log Out</span>
          </button>
        </div>

        <div className="nav-label">Core Desk</div>
        <nav className="nav">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${location === href ? 'active' : ''}`}
              data-testid={`link-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              <Icon />
              <span>{label}</span>
              {href === '/inbox' && <span style={{ marginLeft: 'auto', font: '10px var(--app-font-mono)', color: 'hsl(var(--secondary))', fontWeight: 700 }}>HYBRID</span>}
              
            </Link>
          ))}
        </nav>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Hamburger Button for Mobile / Small Screens */}
            <button
              className="icon-btn mobile-menu-toggle"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              title="Menu"
            >
              <Menu size={18} />
            </button>

            {/* Mobile Fast Back Button */}
            {location !== '/' && (
              <Link href="/" className="icon-btn mobile-back-btn" title="Back to Workbench">
                <ArrowLeft size={16} />
              </Link>
            )}

            <span className="crumb">
              {location === '/' ? 'Command Workbench' : location.slice(1).replace('-', ' ')}
            </span>
          </div>

          <div className="top-actions">
            <div className="offline-pill" data-testid="status-connectivity">
              <span className={`offline-dot ${online ? 'online' : ''}`} />
              <span className="offline-pill-text">{online ? 'Online' : 'Offline'}</span>
            </div>
            <button
              className="icon-btn"
              onClick={(e) => toggleTheme(e)}
              title={themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Light/Dark Theme"
              data-testid="button-theme-toggle"
            >
              {themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link href="/settings" className="icon-btn" data-testid="link-settings" title="Settings">
              <SettingsIcon />
            </Link>
            <button
              id="btn-global-logout"
              className="logout-btn-topbar"
              onClick={() => logout()}
              title="Log Out of Account"
              aria-label="Log Out"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#ffffff',
                background: '#dc2626',
                border: '1px solid #b91c1c',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              <LogOut size={15} />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Organization Bar with Store Switcher, Role Hierarchy, and Multi-Device Sync */}
        <OrgHeader />

        {/* Mobile Slide-in Drawer */}
        {drawerOpen && (
          <div className="mobile-drawer-overlay" onClick={() => setDrawerOpen(false)}>
            <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-drawer-header">
                <Link href="/" className="brand" style={{ padding: 0 }} onClick={() => setDrawerOpen(false)}>
                  <BrandLogo />
                  <div>
                    <span className="brand-name">Vendora</span>
                    <span className="brand-sub">Sovereign Offline Orders</span>
                  </div>
                </Link>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="icon-btn"
                    onClick={(e) => toggleTheme(e)}
                    title={themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  >
                    {themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                  <button className="icon-btn" onClick={() => setDrawerOpen(false)} title="Close menu">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <Link
                href="/settings"
                className="operator-profile-card"
                onClick={() => setDrawerOpen(false)}
                style={{ margin: '14px 0 16px' }}
              >
                <span className="initials">{initials(settings.operatorName)}</span>
                <div className="operator-info">
                  <div className="operator-name-row">
                    <strong>{settings.operatorName}</strong>
                    <span className="operator-badge">Active</span>
                  </div>
                  <small className="operator-domain">{settings.businessType}</small>
                </div>
              </Link>

              {/* Mobile Drawer Direct Sign Out */}
              <div style={{ padding: '0 0 14px' }}>
                <button
                  type="button"
                  onClick={() => { setDrawerOpen(false); logout(); }}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '10px',
                    color: '#ef4444',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={16} />
                  <span>Log Out (@{currentUser?.username || 'user'})</span>
                </button>
              </div>

              <div className="nav-label">Core Desk</div>
              <nav className="nav">
                {links.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`nav-link ${location === href ? 'active' : ''}`}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <Icon />
                    <span>{label}</span>
                    {href === '/inbox' && (
                      <span style={{ marginLeft: 'auto', font: '10px var(--app-font-mono)', color: 'hsl(var(--secondary))', fontWeight: 700 }}>
                        HYBRID
                      </span>
                    )}

                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}

        <EmployeeLobbyModal />
        <main>{children}</main>
      </div>
    </div>
  );
}

function Header({ eyebrow, title, subtitle, action, showBack = true }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode; showBack?: boolean }) {
  const [location] = useLocation();
  return (
    <div className="page-heading">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          {showBack && location !== '/' && (
            <Link href="/" className="back-link-pill" title="Back to Workbench">
              <ArrowLeft size={12} /> Workbench
            </Link>
          )}
          <div className="eyebrow">{eyebrow}</div>
        </div>
        <h1>{title}</h1>
        <p className="subheading">{subtitle}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>;
}

function EmptyState({ icon: Icon = Inbox, title, text }: { icon?: typeof Inbox; title: string; text: string }) {
  return (
    <div className="empty">
      <Icon />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function OrderModal({
  order,
  onClose,
  onSave,
  onDelete,
}: {
  order: Order | null;
  onClose: () => void;
  onSave: (data: Partial<Order>) => void;
  onDelete?: (id: string) => void;
}) {
  const isNew = !order;
  const [form, setForm] = useState<Partial<Order>>(
    order || {
      customer: '',
      phone: '',
      dueDate: dateOffset(1),
      amount: 0,
      paidAmount: 0,
      status: 'new',
      items: [{ description: '', quantity: 1, attributes: {} }],
      needsClarification: false,
    },
  );
  const item = form.items?.[0] || { description: '', quantity: 1, attributes: {} };
  const set = (key: keyof Order, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="order-modal-title">
        <div className="modal-head">
          <div>
            <div className="eyebrow">{isNew ? 'New Sovereign Record' : `Order #${order?.id.slice(-6)}`}</div>
            <h2 id="order-modal-title">{isNew ? 'Capture New Order' : 'Edit Order Record'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog" data-testid="button-close-order">
            <X />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="customer">Customer Name</label>
              <input
                id="customer"
                className="input"
                data-testid="input-order-customer"
                value={String(form.customer || '')}
                onChange={(e) => set('customer', e.target.value)}
                placeholder="e.g. Asha Menon"
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                className="input"
                data-testid="input-order-phone"
                value={String(form.phone || '')}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="98xxx xxxxx"
              />
            </div>
            <div className="field full">
              <label htmlFor="item">Work / Item Description</label>
              <input
                id="item"
                className="input"
                data-testid="input-order-item"
                value={item.description}
                onChange={(e) => set('items', [{ ...item, description: e.target.value }])}
                placeholder="e.g. 2 Anarkali kurta navy blue"
              />
            </div>
            <div className="field">
              <label htmlFor="qty">Quantity</label>
              <input
                id="qty"
                type="number"
                min="1"
                className="input"
                data-testid="input-order-quantity"
                value={item.quantity}
                onChange={(e) => set('items', [{ ...item, quantity: Number(e.target.value) || 1 }])}
              />
            </div>
            <div className="field">
              <label htmlFor="due">Due Date</label>
              <input
                id="due"
                type="date"
                className="input"
                data-testid="input-order-due"
                value={String(form.dueDate || '')}
                onChange={(e) => set('dueDate', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="amount">Total Amount (₹)</label>
              <input
                id="amount"
                type="number"
                min="0"
                className="input"
                data-testid="input-order-amount"
                value={Number(form.amount || 0)}
                onChange={(e) => set('amount', Number(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label htmlFor="paid">Advance / Paid (₹)</label>
              <input
                id="paid"
                type="number"
                min="0"
                className="input"
                data-testid="input-order-paid"
                value={Number(form.paidAmount || 0)}
                onChange={(e) => set('paidAmount', Number(e.target.value) || 0)}
              />
            </div>
            <div className="field">
              <label htmlFor="status">Lifecycle Status</label>
              <select
                id="status"
                className="input"
                data-testid="select-order-status"
                value={form.status as string}
                onChange={(e) => set('status', e.target.value)}
              >
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="attributes">Attributes / Measurements / Specifications</label>
              <input
                id="attributes"
                className="input"
                data-testid="input-order-attributes"
                value={Object.entries(item.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
                onChange={(e) => {
                  const attrs = e.target.value.split(',').reduce<Record<string, string>>((acc, pair) => {
                    const [k, ...rest] = pair.split(':');
                    if (k?.trim()) acc[k.trim()] = rest.join(':').trim();
                    return acc;
                  }, {});
                  set('items', [{ ...item, attributes: attrs }]);
                }}
                placeholder="chest: 40, color: navy blue, fabric: cotton"
              />
            </div>
          </div>

          <div className="modal-actions">
            {!isNew && onDelete ? (
              <button className="btn btn-danger" onClick={() => onDelete(order.id)} data-testid="button-delete-order">
                <Trash2 /> Delete
              </button>
            ) : <span />}

            <div className="action-group">
              <button className="btn btn-quiet" onClick={onClose} data-testid="button-cancel-order">
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => onSave(form)} data-testid="button-save-order">
                <Check /> {isNew ? 'Save Order' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Dashboard({
  orders,
  settings,
  onNew,
  onEdit,
}: {
  orders: Order[];
  settings: Settings;
  onNew: () => void;
  onEdit: (order: Order) => void;
}) {
  const { currentMember, organization } = useOrgAuth();
  const [showPrintLedger, setShowPrintLedger] = useState(false);
  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const due = active.filter((o) => o.dueDate === dateOnly()).length;
  const overdue = active.filter((o) => o.dueDate < dateOnly()).length;
  const outstanding = active.reduce((sum, o) => sum + Math.max(0, o.amount - o.paidAmount), 0);
  const committed = active.filter((o) => o.dueDate <= dateOffset(7)).reduce((sum, o) => sum + o.items.reduce((n, i) => n + i.quantity, 0), 0);
  const recent = [...orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const bars = [3, 5, 2, committed, 4, 6, 3];
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <Header
        eyebrow={todayLabel}
        title={`Welcome, ${currentMember ? currentMember.name : settings.operatorName}.`}
        subtitle="Your sovereign offline workbench is fast, resilient, and always in sync."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn"
              onClick={() => setShowPrintLedger(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontWeight: 600,
                fontSize: 13,
                background: 'rgba(16, 185, 129, 0.16)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                padding: '8px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(16, 185, 129, 0.1)'
              }}
              title="Generate clean printable statement of accounts & export to PDF"
              data-testid="button-print-ledger"
            >
              <Printer size={16} /> Print Ledger (PDF)
            </button>
            <button className="btn btn-primary" onClick={onNew} data-testid="button-new-order">
              <Plus /> New Order
            </button>
          </div>
        }
      />


      <div className="stats-grid">
        <div className="stat-card featured">
          <div className="stat-label">Today's Load</div>
          <div className="stat-value">{due + overdue}</div>
          <div className="stat-meta">{due} due today · {overdue} overdue</div>
          <CalendarDays className="stat-icon" size={48} />
        </div>

        <div className="stat-card">
          <div className="stat-label">Outstanding Balance</div>
          <div className="stat-value">{money(outstanding)}</div>
          <div className="stat-meta">across {active.filter((o) => o.amount > o.paidAmount).length} open orders</div>
          <IndianRupee className="stat-icon" size={48} />
        </div>

        <div className="stat-card">
          <div className="stat-label">Weekly Capacity</div>
          <div className="stat-value">
            {committed}<span style={{ fontSize: 18 }}> / {settings.capacity}</span>
          </div>
          <div className="stat-meta">{Math.round((committed / (settings.capacity || 12)) * 100)}% committed this week</div>
          <Layers3 className="stat-icon" size={48} />
        </div>
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent Orders</h2>
              <span className="minor">Real-time local ledger</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-quiet"
                onClick={() => setShowPrintLedger(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}
                title="Export Printable Ledger Statement"
                data-testid="button-export-ledger-pdf"
              >
                <FileDown size={14} /> Export PDF
              </button>
              <Link href="/orders" className="btn btn-quiet" data-testid="link-see-all-orders">
                View All <ArrowRight />
              </Link>
            </div>
          </div>
          <div className="order-list">
            {recent.length ? (
              recent.map((o) => (
                <button
                  key={o.id}
                  className="order-row"
                  onClick={() => onEdit(o)}
                  data-testid={`button-recent-order-${o.id}`}
                >
                  <span className="order-avatar">{initials(o.customer)}</span>
                  <div className="order-info">
                    <span className="order-name">{o.customer || 'Unnamed customer'}</span>
                    <span className="order-detail">{itemText(o)} · {money(o.amount)}</span>
                  </div>
                  <div className="order-side">
                    <span className="order-date">{dueLabel(o)}</span>
                    <StatusBadge status={o.status} />
                  </div>
                </button>
              ))
            ) : (
              <EmptyState title="Bench is clear" text="Capture an order or import customer messages to begin." />
            )}
          </div>
        </section>

        <div className="side-stack">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Committed Load</h2>
                <span className="minor">Next 7 days</span>
              </div>
              <span className="minor">{committed} / {settings.capacity} items</span>
            </div>
            <div className="capacity">
              <div className="capacity-top">
                <span className="capacity-number">{Math.min(100, Math.round((committed / (settings.capacity || 12)) * 100))}%</span>
                <span className="capacity-unit">planned workload</span>
              </div>
              <div className="meter">
                <span style={{ width: `${Math.min(100, (committed / (settings.capacity || 12)) * 100)}%` }} />
              </div>
            </div>
            <div className="week-bars">
              {bars.map((value, i) => (
                <div className="bar-wrap" key={i}>
                  <span className={`bar ${i === 3 ? 'today' : ''}`} style={{ height: `${Math.min(90, value * 13)}%` }} />
                  <span className="bar-label">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel quick-card">
            <div className="panel-head">
              <div>
                <h2>Instant Query Desk</h2>
                <span className="minor">Voice & Natural Language</span>
              </div>
              <Sparkles size={16} style={{ color: 'var(--day-accent)' }} />
            </div>
            <div className="quick-card-body">
              <p>Answer "Who owes money?" or "What is due today?" with sub-2ms local lookups.</p>
              <Link href="/query" className="btn btn-primary" data-testid="link-open-query-desk" style={{ width: 'fit-content' }}>
                <Sparkles size={14} /> Open Query Desk
              </Link>
            </div>
          </section>
        </div>
      </div>

      <PrintableLedgerModal
        isOpen={showPrintLedger}
        onClose={() => setShowPrintLedger(false)}
        orders={orders}
        settings={settings}
        organization={organization}
        operatorName={currentMember?.name || settings.operatorName}
      />
    </div>
  );
}

function OrdersPage({
  orders,
  settings,
  onNew,
  onEdit,
  query,
  setQuery,
  filter,
  setFilter,
}: {
  orders: Order[];
  settings?: Settings;
  onNew: () => void;
  onEdit: (order: Order) => void;
  query: string;
  setQuery: (q: string) => void;
  filter: 'all' | OrderStatus;
  setFilter: (f: 'all' | OrderStatus) => void;
}) {
  const { currentMember, organization } = useOrgAuth();
  const [showPrintLedger, setShowPrintLedger] = useState(false);

  const filtered = orders.filter(
    (o) =>
      (filter === 'all' || o.status === filter) &&
      `${o.customer} ${o.phone} ${itemText(o)}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="page">
      <Header
        eyebrow="The Sovereign Ledger"
        title="Orders Ledger"
        subtitle="All customer commitments, measurements, and payment records."
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn"
              onClick={() => setShowPrintLedger(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontWeight: 600,
                fontSize: 13,
                background: 'rgba(16, 185, 129, 0.16)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                padding: '8px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(16, 185, 129, 0.1)'
              }}
              title="Generate clean printable statement of accounts & export to PDF"
              data-testid="button-orders-print-ledger"
            >
              <Printer size={16} /> Print Ledger (PDF)
            </button>
            <button className="btn btn-primary" onClick={onNew} data-testid="button-add-order">
              <Plus /> Add Order
            </button>
          </div>
        }
      />

      <div className="orders-toolbar">
        <div className="orders-search-box">
          <Search className="orders-search-icon" size={17} />
          <input
            className="orders-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer name, phone, item description, notes..."
            aria-label="Search orders"
            data-testid="input-search-orders"
          />
          {query && (
            <button
              type="button"
              className="orders-search-clear"
              onClick={() => setQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {(query || filter !== 'all') && (
          <button
            type="button"
            className="orders-reset-btn"
            onClick={() => { setQuery(''); setFilter('all'); }}
            data-testid="button-clear-filters"
          >
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      <div className="filter-tabs-row">
        <div className="filter-tabs-scroll">
          {STATUS_FILTERS.map((key) => {
            const count = key === 'all' ? orders.length : orders.filter((o) => o.status === key).length;
            return (
              <button
                key={key}
                type="button"
                className={`filter-pill ${filter === key ? 'active' : ''}`}
                onClick={() => setFilter(key)}
                data-testid={`filter-orders-${key}`}
              >
                <span>{key === 'all' ? 'All Orders' : STATUS_LABEL[key]}</span>
                <span className="filter-pill-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="panel table-panel">
        {filtered.length ? (
          <>
            <div className="table-head">
              <span>Customer</span>
              <span>Work & Attributes</span>
              <span>Due Date</span>
              <span>Balance</span>
              <span>Status</span>
            </div>
            {filtered.map((o) => (
              <button
                key={o.id}
                className="table-row"
                onClick={() => onEdit(o)}
                data-testid={`button-edit-order-${o.id}`}
              >
                <span className="customer-cell">
                  <span className="order-avatar">{initials(o.customer)}</span>
                  <div>
                    <strong>{o.customer || 'Unnamed'}</strong>
                    <small>{o.phone || 'No phone'}</small>
                  </div>
                </span>
                <span className="cell-muted">{itemText(o)}</span>
                <span className={`cell-muted ${o.dueDate <= dateOnly() && isDue(o) ? 'money due' : ''}`}>
                  {dueLabel(o)}
                </span>
                <span className={`money ${o.amount - o.paidAmount > 0 ? 'due' : ''}`}>
                  {money(Math.max(0, o.amount - o.paidAmount))}
                </span>
                <span>
                  <StatusBadge status={o.status} />
                </span>
              </button>
            ))}
          </>
        ) : (
          <EmptyState icon={Filter} title="No matching orders" text="Try another search term or reset filters." />
        )}
      </section>

      <PrintableLedgerModal
        isOpen={showPrintLedger}
        onClose={() => setShowPrintLedger(false)}
        orders={orders}
        settings={settings || { operatorName: 'Store Manager', capacity: 12, theme: 'dark', sound: false }}
        organization={organization}
        operatorName={currentMember?.name || settings?.operatorName}
      />
    </div>
  );
}

function InboxPage({
  onSave,
  onNotify,
  message,
  setMessage,
  parsed,
  setParsed,
  forceOffline,
  setForceOffline,
}: {
  onSave: (data: Partial<Order>) => void;
  onNotify: (message: string) => void;
  message: string;
  setMessage: (m: string) => void;
  parsed: HybridParseResult | null;
  setParsed: (p: HybridParseResult | null) => void;
  forceOffline: boolean;
  setForceOffline: (f: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);

  // Model & Provider Selection State
  const [selectedModelId, setSelectedModelId] = useState<string>(getActiveModelId());
  const [providerKeys, setProviderKeys] = useState(getSavedProviderKeys());
  const [keyInput, setKeyInput] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Live Speech Recognition & Audio Intake
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechState, setSpeechState] = useState<'idle' | 'listening' | 'sound_detected' | 'speech_detected'>('idle');
  const [voiceStatus, setVoiceStatus] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cleanupAudioAnalyserRef = useRef<(() => void) | null>(null);

  const startMediaRecorderVoice = async () => {
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }

      setIsListening(true);
      setLiveTranscript('');
      setSpeechState('listening');
      setVoiceStatus('🎙️ Microphone active. Speak customer order, tap "Done ✓" when finished...');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      if (cleanupAudioAnalyserRef.current) cleanupAudioAnalyserRef.current();
      cleanupAudioAnalyserRef.current = setupAudioAnalyser(stream, (hasSound) => {
        setSpeechState(hasSound ? 'speech_detected' : 'sound_detected');
      });

      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(100);
    } catch (err: any) {
      setIsListening(false);
      setVoiceStatus('⚠️ Could not access microphone. Please check browser permissions.');
    }
  };

  const stopVoice = async () => {
    if (cleanupAudioAnalyserRef.current) {
      cleanupAudioAnalyserRef.current();
      cleanupAudioAnalyserRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const audioBlobPromise = new Promise<Blob>((resolve) => {
        if (!mediaRecorderRef.current) return resolve(new Blob());
        mediaRecorderRef.current.onstop = () => {
          const mime = audioChunksRef.current[0]?.type || getSupportedAudioMimeType() || 'audio/webm';
          resolve(new Blob(audioChunksRef.current, { type: mime }));
        };
      });

      try { mediaRecorderRef.current.stop(); } catch {}

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setVoiceStatus('Transcribing customer voice message with AI (Gemini 3.6 Flash)...');
      const audioBlob = await audioBlobPromise;
      if (audioBlob.size > 200) {
        try {
          const transcribed = await transcribeAudio(audioBlob);
          if (transcribed) {
            setMessage(transcribed);
            setLiveTranscript(transcribed);
            setVoiceStatus(`Transcribed: "${transcribed}"`);
            onNotify('Voice message transcribed');
            setIsListening(false);
            setSpeechState('idle');
            return;
          }
        } catch (gemErr) {
          console.warn('Audio transcription failed:', gemErr);
        }
      }
    }

    setIsListening(false);
    setSpeechState('idle');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (liveTranscript) {
      setVoiceStatus(`Transcribed: "${liveTranscript}"`);
      onNotify('Voice message captured');
    } else {
      setVoiceStatus('Voice intake complete.');
    }
  };

  const toggleVoice = async () => {
    if (typeof window === 'undefined') return;

    if (isListening) {
      await stopVoice();
      return;
    }

    const isOpera = isOperaOrNonChrome();
    const SpeechRecognition = !isOpera && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch {}
          recognitionRef.current = null;
        }

        let isSwitchingToMediaRecorder = false;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-IN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        setIsListening(true);
        setLiveTranscript('');
        setSpeechState('listening');
        setVoiceStatus('🎙️ Listening... Speak customer order (say "bhaiya 2 kurta navy blue parso chahiye")');

        recognition.onaudiostart = () => { setSpeechState('listening'); };
        recognition.onsoundstart = () => { setSpeechState('sound_detected'); };
        recognition.onspeechstart = () => { setSpeechState('speech_detected'); };

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = 0; i < event.results.length; ++i) {
            const transcript = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              final += (final ? ' ' : '') + transcript;
            } else {
              interim += (interim ? ' ' : '') + transcript;
            }
          }
          const liveWords = final ? (interim ? `${final} ${interim}` : final) : interim;
          if (liveWords) {
            setMessage(liveWords);
            setLiveTranscript(liveWords);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed') {
            setIsListening(false);
            setVoiceStatus('⚠️ Microphone permission blocked. Allow mic in browser settings.');
          } else {
            startMediaRecorderVoice();
          }
        };

        recognition.onend = () => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            setIsListening(false);
            setSpeechState('idle');
          }
        };

        recognition.start();
        return;
      } catch (recErr) {
        console.warn('SpeechRecognition start failed, fallback to media recorder:', recErr);
      }
    }

    // UNIVERSAL NON-CHROMIUM & OPERA PATH
    await startMediaRecorderVoice();
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const activeModel = AVAILABLE_MODELS.find((m) => m.id === selectedModelId) || AVAILABLE_MODELS[0];
  const activeKey = providerKeys[activeModel.provider] || '';

  const handleModelChange = (newModelId: string) => {
    setSelectedModelId(newModelId);
    setActiveModelId(newModelId);
    const chosen = AVAILABLE_MODELS.find((m) => m.id === newModelId);
    if (chosen) {
      onNotify(`Switched to ${chosen.label}`);
    }
  };

  const handleSaveKeyForCurrent = () => {
    if (activeModel.provider === 'offline') return;
    saveProviderKey(activeModel.provider, keyInput);
    setProviderKeys(getSavedProviderKeys());
    setShowKeyModal(false);
    onNotify(`${activeModel.label} key updated`);
  };

  const runParser = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const result = await parseOrderHybrid(message, {
        forceOffline,
        modelId: selectedModelId,
      });
      setParsed(result);
      if (result._source === 'online_ai') {
        if (result._apiError?.includes('429') || result._providerNote?.includes('Fallback')) {
          onNotify(`⚡ Gemini Quota Reached (429) → Automatically Fallen Back to Groq! (${result._speedMs}ms)`);
        } else {
          onNotify(`⚡ Parsed with ${result._providerNote} in ${result._speedMs}ms`);
        }
      } else {
        onNotify(`⚡ Parsed with Local Deterministic Engine in ${result._speedMs}ms`);
      }
    } catch {
      const fallback = parseUniversalMessage(message);
      setParsed({
        ...fallback,
        _source: 'offline_nlp',
        _domain: 'general',
        _speedMs: 1,
        _providerNote: 'Local Deterministic Engine (Sub-ms Fallback)',
      });
      onNotify('Parsed with local fallback engine');
    } finally {
      setBusy(false);
    }
  };

  const item = parsed?.items?.[0] || { description: '', quantity: 1, attributes: {} };

  const getFormattedJson = () => {
    if (!parsed) return '';
    return JSON.stringify(
      {
        customer: parsed.customer,
        items: parsed.items,
        due_date: parsed.due_date,
        amount: parsed.amount,
        references_prior_order: parsed.references_prior_order,
        confidence: parsed.confidence,
        needs_clarification: parsed.needs_clarification,
      },
      null,
      2
    );
  };

  const handleDownloadJson = () => {
    if (!parsed) return;
    const jsonStr = getFormattedJson();
    const customerSlug = parsed.customer ? parsed.customer.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'order';
    const filename = `order-parsed-${customerSlug}-${dateOnly()}.json`;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Downloaded ${filename}`);
  };

  const handleCopyJson = () => {
    if (!parsed) return;
    navigator.clipboard.writeText(getFormattedJson());
    onNotify('JSON copied to clipboard!');
  };

  const handleSaveToLedger = () => {
    if (!parsed) return;
    onSave({
      customer: parsed.customer || '',
      phone: '',
      items: parsed.items,
      dueDate: parsed.due_date || dateOffset(1),
      amount: parsed.amount || 0,
      paidAmount: 0,
      status: 'new',
      referencesPriorOrder: parsed.references_prior_order,
      confidence: parsed.confidence,
      needsClarification: parsed.needs_clarification,
      rawMessage: message,
    });
    setMessage('');
    setParsed(null);
  };

  return (
    <div className="page">
      <Header
        eyebrow="Universal NLP Desk"
        title="Hybrid Message Parser"
        subtitle="Ingests Hinglish, Devanagari, and Roman transliterations for tailoring, bakery, tiffin, electrical, and general trades."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn ${forceOffline ? 'btn-secondary' : 'btn-quiet'}`}
              onClick={() => {
                const next = !forceOffline;
                setForceOffline(next);
                onNotify(next ? 'Mode: Forced Offline (0ms Local)' : 'Mode: Hybrid (Online AI + Local Fallback)');
              }}
              title="Toggle forced offline mode"
            >
              <Cpu size={14} /> {forceOffline ? 'Forced Offline' : 'Hybrid Mode'}
            </button>
          </div>
        }
      />

      <div className="inbox-grid">
        {/* Left: Input Message */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Paste Customer Message</h2>
              <span className="minor">WhatsApp / SMS / Free Text / Live Voice</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className={`voice-btn ${isListening ? 'listening' : ''}`}
                onClick={toggleVoice}
                title={isListening ? 'Live speech recording active... Tap to stop' : 'Live Voice Input (Google Keyboard style)'}
                data-testid="button-voice-inbox"
                style={{ position: 'relative', right: 'auto', width: 32, height: 32 }}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </div>
          </div>

          <div style={{ padding: '0 22px 22px' }}>
            {/* Live Speech Recognition Banner */}
            {isListening && (
              <div className="voice-listening-banner" style={{ marginBottom: 12 }}>
                <div className="voice-wave-bars">
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                  <span className="wave-bar" />
                </div>
                <div className="voice-live-wrap">
                  <div className="voice-live-badge">
                    {speechState === 'speech_detected' ? '🗣️ LIVE TRANSCRIBING' : speechState === 'sound_detected' ? '🔊 HEARING AUDIO' : '🎙️ LISTENING'}
                  </div>
                  <div className="voice-live-text">
                    {liveTranscript ? (
                      <>
                        <strong>"{liveTranscript}"</strong>
                        <span className="voice-cursor">|</span>
                      </>
                    ) : (
                      <em>Speak customer order (say e.g. "bhaiya 2 chocolate cake parso chahiye")...</em>
                    )}
                  </div>
                </div>
                <button type="button" className="voice-stop-btn" onClick={stopVoice}>
                  Done ✓
                </button>
              </div>
            )}

            {/* Voice Status pill if any */}
            {voiceStatus && !isListening && (
              <div className="voice-status-pill" style={{ marginBottom: 12 }}>
                <span>{voiceStatus}</span>
                <button type="button" onClick={() => setVoiceStatus('')} title="Dismiss">✕</button>
              </div>
            )}

            <textarea
              className="input message-box"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. “bhaiya main Ramesh. 2 kurta chahiye navy blue, chest 40, parso tak ho jayega kya? total ₹1850” or click the mic to speak live"
              data-testid="textarea-raw-message"
            />

            <div className="parser-hint">
              <Sparkles size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              <strong>Engine:</strong> {activeModel.label}. Auto-infers domain, Devanagari numerals, dates (parso, agle mangalwar), measurements, and repeat cues.
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 14, padding: 12 }}
              onClick={runParser}
              disabled={!message.trim() || busy}
              data-testid="button-parse-message"
            >
              {busy ? <RefreshCw className="spin" /> : <Zap />}
              {busy ? 'Running Parser…' : `Parse Message with ${activeModel.badge}`}
            </button>
          </div>
        </section>

        {/* Right: Structured Output Review */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Standardized Order Record</h2>
              <span className="minor">{parsed ? `Domain: ${parsed._domain}` : 'Waiting for input'}</span>
            </div>
            {parsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={parsed._source === 'online_ai' ? 'badge-source-ai' : 'badge-source-local'}>
                  {parsed._source === 'online_ai' ? `✨ ${parsed._providerNote || 'Online AI'}` : '⚡ Sub-ms Local Engine'}
                </span>
                <button
                  className="icon-btn"
                  style={{ width: 30, height: 30 }}
                  onClick={handleDownloadJson}
                  title="Download JSON File"
                >
                  <Download size={14} />
                </button>
                <button
                  className="icon-btn"
                  style={{ width: 30, height: 30 }}
                  onClick={handleCopyJson}
                  title="Copy JSON to Clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>
            )}
          </div>

          {parsed ? (
            <div style={{ padding: '0 22px 22px' }}>
              {parsed._apiError && (
                <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b' }}>
                    <AlertTriangle size={16} />
                    <span><strong>Online AI Notice:</strong> {parsed._apiError}</span>
                  </div>
                  <button
                    className="btn btn-quiet"
                    style={{ padding: '4px 10px', fontSize: 11, background: 'hsl(var(--card))' }}
                    onClick={() => {
                      setKeyInput('');
                      setShowKeyModal(true);
                    }}
                  >
                    <Key size={12} /> Enter Fresh Key
                  </button>
                </div>
              )}

              <div className="confidence-line">
                <span>Confidence Calibration</span>
                <strong>{Math.round((parsed.confidence || 0) * 100)}% ({parsed._speedMs}ms)</strong>
              </div>
              <div className="meter">
                <span style={{ width: `${(parsed.confidence || 0) * 100}%` }} />
              </div>

              <div className="review-grid">
                <div className="field">
                  <label>Customer Name</label>
                  <input
                    className="input"
                    value={parsed.customer || ''}
                    onChange={(e) => setParsed({ ...parsed, customer: e.target.value || null })}
                    placeholder="None detected"
                    data-testid="input-parsed-customer"
                  />
                </div>
                <div className="field">
                  <label>Due Date (ISO)</label>
                  <input
                    className="input"
                    type="date"
                    value={parsed.due_date || ''}
                    onChange={(e) => setParsed({ ...parsed, due_date: e.target.value || null })}
                    data-testid="input-parsed-due"
                  />
                </div>
                <div className="field">
                  <label>Work Description</label>
                  <input
                    className="input"
                    value={item.description}
                    onChange={(e) => setParsed({ ...parsed, items: [{ ...item, description: e.target.value }] })}
                    data-testid="input-parsed-item"
                  />
                </div>
                <div className="field">
                  <label>Quantity</label>
                  <input
                    type="number"
                    className="input"
                    value={item.quantity}
                    onChange={(e) => setParsed({ ...parsed, items: [{ ...item, quantity: Number(e.target.value) || 1 }] })}
                    data-testid="input-parsed-qty"
                  />
                </div>
                <div className="field">
                  <label>Total Amount (₹)</label>
                  <input
                    type="number"
                    className="input"
                    value={parsed.amount || 0}
                    onChange={(e) => setParsed({ ...parsed, amount: Number(e.target.value) || null })}
                    data-testid="input-parsed-amount"
                  />
                </div>
                <div className="field">
                  <label>Prior Order Reference</label>
                  <input
                    className="input"
                    readOnly
                    value={parsed.references_prior_order ? '✅ Yes (Repeat)' : '❌ No'}
                  />
                </div>
              </div>

              {parsed.needs_clarification && (
                <div className="flag">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>Flagged for Clarification:</strong> Key details are ambiguous or missing. Please verify highlighted fields before committing to the ledger.
                  </span>
                </div>
              )}

              {/* Action Toolbar with Save to Ledger, Download JSON, and Copy JSON */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 10, marginTop: 18 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveToLedger}
                  data-testid="button-save-parsed-order"
                >
                  <Check /> Commit to Sovereign Ledger
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleDownloadJson}
                  data-testid="button-download-parsed-json"
                >
                  <Download /> Export JSON
                </button>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div className="eyebrow">
                    Exact schema.json Output ({parsed._providerNote || 'Standard schema'})
                  </div>
                  <button
                    className="btn btn-quiet"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={handleCopyJson}
                  >
                    <Copy size={12} /> Copy JSON
                  </button>
                </div>
                <pre className="json-box" data-testid="text-parsed-json">
                  {getFormattedJson()}
                </pre>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={FileJson}
              title="Review desk is waiting"
              text="Run the parser to inspect structured JSON output matching schema.json."
            />
          )}
        </section>
      </div>

    </div>
  );
}

function SettingsPage({
  settings,
  online,
  formDraft,
  onFormDraftChange,
  onSave,
  onExport,
  onImport,
  onReset,
  onNotify,
}: {
  settings: Settings;
  online: boolean;
  formDraft: Settings | null;
  onFormDraftChange: (s: Settings | null) => void;
  onSave: (settings: Settings) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  onNotify: (msg: string) => void;
}) {
  const { currentUser, logout } = useOrgAuth();
  const [form, setForm] = useState(formDraft || settings);

  useEffect(() => {
    if (!formDraft) setForm(settings);
  }, [settings, formDraft]);

  const set = (key: keyof Settings, value: unknown) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      onFormDraftChange(next);
      return next;
    });
  };

  return (
    <div className="page">
      <Header
        eyebrow="Device Configuration"
        title="Settings & Data Sovereignty"
        subtitle="Manage your sovereign device profile, weekly committed capacity limit, and complete offline JSON backups."
      />

      <div className="settings-grid">
        <section className="settings-card">
          <div className="eyebrow">Operator Identity</div>
          <h3 style={{ marginTop: 8 }}>Workspace Profile</h3>
          <p>Personalize your command centre name and business category.</p>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="operator">Operator Name</label>
            <input
              id="operator"
              className="input"
              value={form.operatorName}
              onChange={(e) => set('operatorName', e.target.value)}
              data-testid="input-operator-name"
            />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="business">Business Domain</label>
            <input
              id="business"
              className="input"
              value={form.businessType}
              onChange={(e) => set('businessType', e.target.value)}
              placeholder="e.g. Custom Tailoring & Studio"
              data-testid="input-business-type"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                onSave(form);
                onNotify('Workspace profile saved successfully!');
              }}
              data-testid="button-save-settings"
            >
              <Check /> Save Profile
            </button>
          </div>
        </section>

        <section className="settings-card">
          <div className="eyebrow">Capacity Planning</div>
          <h3 style={{ marginTop: 8 }}>Weekly Commitment Target</h3>
          <p>How many order items can your workshop comfortably deliver in 7 days?</p>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="capacity">Target Item Capacity / Week</label>
            <input
              id="capacity"
              type="number"
              min="1"
              className="input"
              value={form.capacity}
              onChange={(e) => set('capacity', Number(e.target.value) || 1)}
              data-testid="input-capacity"
            />
          </div>
          <div className="setting-row">
            <span>
              <strong>Device Node ID</strong><br />
              <small className="cell-muted">{settings.deviceId}</small>
            </span>
            <span className="offline-pill">
              <span className={`offline-dot ${online ? 'online' : ''}`} />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                onSave(form);
                onNotify('Weekly commitment capacity target saved!');
              }}
            >
              <Check /> Save Capacity
            </button>
          </div>
        </section>

        <section className="settings-card wide">
          <div className="eyebrow">Data Sovereignty</div>
          <h3 style={{ marginTop: 8 }}>Export & Restore</h3>
          <p>All data lives in your browser IndexedDB. Export an offline JSON snapshot anytime.</p>
          <div className="setting-row">
            <span>
              <strong>Export Complete Ledger</strong><br />
              <small className="cell-muted">Download complete JSON archive including orders, oplog, and settings.</small>
            </span>
            <button className="btn btn-quiet" onClick={onExport} data-testid="button-export-workspace">
              <Download /> Export Backup
            </button>
          </div>
          <div className="setting-row">
            <span>
              <strong>Restore From Backup</strong><br />
              <small className="cell-muted">Import a Vendora backup JSON file.</small>
            </span>
            <label className="btn btn-quiet" htmlFor="workspace-import">
              <Upload /> Import Backup
            </label>
            <input
              id="workspace-import"
              hidden
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
              }}
              data-testid="input-import-workspace"
            />
          </div>
          <div className="setting-row">
            <span>
              <strong>Reset Sample Data</strong><br />
              <small className="cell-muted">Reset local storage back to standard demo seed records.</small>
            </span>
            <button className="btn btn-danger" onClick={onReset} data-testid="button-reset-workspace">
              <Trash2 /> Reset Data
            </button>
          </div>
        </section>

        <section className="settings-card wide" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.04)' }}>
          <div className="eyebrow" style={{ color: '#ef4444' }}>Account & Session</div>
          <h3 style={{ color: '#ef4444', marginTop: 8 }}>Authentication & Store Access</h3>
          <p className="setting-desc">Manage your active store credentials and device authentication.</p>
          <div className="setting-row">
            <span>
              <strong>Current User</strong><br />
              <small className="cell-muted">Signed in as <strong>@{currentUser?.username || 'user'}</strong> ({currentUser?.fullName || 'Owner'})</small>
            </span>
            <button
              className="btn btn-danger"
              onClick={() => logout()}
              style={{
                background: '#ef4444',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                padding: '8px 16px',
              }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function App() {
  const { organization, currentMember, currentUser, isAuthenticated, logout } = useOrgAuth();
  const [loaded, setLoaded] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings>({
    operatorName: 'Om Shetkar',
    businessType: 'Custom Tailoring & Studio',
    capacity: 15,
    deviceId: getOrCreateDeviceId(),
  });
  const [oplog, setOplog] = useState<OperationLog[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState<Order | null | undefined>(undefined);

  // Tab-persistent session state (reverts to default on full page refresh)
  const [inboxMessage, setInboxMessage] = useState('');
  const [inboxParsed, setInboxParsed] = useState<HybridParseResult | null>(null);
  const [inboxForceOffline, setInboxForceOffline] = useState(false);

  const [ordersQuery, setOrdersQuery] = useState('');
  const [ordersFilter, setOrdersFilter] = useState<'all' | OrderStatus>('all');

  const [queryDeskQuery, setQueryDeskQuery] = useState('');
  const [queryDeskCustomer, setQueryDeskCustomer] = useState<string | null>(null);

  const [settingsDraft, setSettingsDraft] = useState<Settings | null>(null);

  // Initialize Sovereign Offline Database & Online Reconnection Listeners
  useEffect(() => {
    // Automatically apply dynamic theme based on today's real day of the week
    applyDayTheme(new Date().getDay());

    OfflineStorage.init().then((data) => {
      setOrders(data.orders);
      setSettings(data.settings);
      setOplog(data.oplog);
      setConflicts(data.conflicts);
      setLoaded(true);

      // Setup wizard never auto-pops up on login
    });

    const handleOnline = () => {
      setOnline(true);
      setToast('🌐 Internet Reconnected — Online AI Models Active');
    };
    const handleOffline = () => {
      setOnline(false);
      setToast('📴 Offline / Airplane Mode — Local Sovereign Storage Active');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 1. Cloud Hydration on Startup / Login / Org Switch
  useEffect(() => {
    if (!loaded || !organization?.id) return;
    let isCurrent = true;

    syncStoreOrders(organization.id).then((merged) => {
      if (isCurrent && merged && merged.length > 0) {
        setOrders(merged);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [loaded, organization?.id]);

  // 2. Live Supabase Realtime Channel: Cross-device multi-device sync
  useEffect(() => {
    if (!loaded || !organization?.id) return;

    const channelName = 'org-orders-realtime-' + organization.id;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: 'org_id=eq.' + organization.id,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const incoming = cloudToOrder(payload.new);
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === incoming.id);
              const next = exists ? prev.map((o) => (o.id === incoming.id ? incoming : o)) : [incoming, ...prev];
              OfflineStorage.bulkUpsertOrders(next);
              return next;
            });
            notify(payload.eventType === 'INSERT' ? '⚡ New order received from another device' : '⚡ Order updated from cloud');
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setOrders((prev) => {
                const next = prev.filter((o) => o.id !== deletedId);
                OfflineStorage.bulkUpsertOrders(next);
                return next;
              });
              notify('⚡ Order removed from another device');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loaded, organization?.id]);

  // 3. Auto-sync on window focus or custom sync event
  useEffect(() => {
    const handleSync = () => {
      if (navigator.onLine && organization?.id) {
        syncStoreOrders(organization.id).then((merged) => {
          if (merged && merged.length > 0) setOrders(merged);
        });
      }
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('vendora:sync-complete', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('vendora:sync-complete', handleSync);
    };
  }, [organization?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (msg: string) => setToast(msg);

  const saveOrder = async (payload: Partial<Order>) => {
    const now = new Date().toISOString();
    const existing = payload.id ? orders.find((o) => o.id === payload.id) : undefined;
    const nextOrder: Order = {
      ...(existing || {
        id: generateId('ord'),
        createdAt: now,
        version: 0,
        deviceId: settings.deviceId,
      }),
      ...payload,
      updatedAt: now,
      version: (existing?.version || 0) + 1,
      deviceId: settings.deviceId,
      pendingSync: true,
      items: payload.items?.length ? payload.items : [{ description: 'Customer order', quantity: 1, attributes: {} }],
    } as Order;

    const op: OperationLog = {
      id: generateId('op'),
      orderId: nextOrder.id,
      action: existing ? 'Updated Order' : 'Created Order',
      field: existing ? 'multiple_fields' : 'new_record',
      at: now,
      deviceId: settings.deviceId,
      hlc: `${Date.now().toString(36)}:0:${settings.deviceId}`,
    };

    await OfflineStorage.saveOrder(nextOrder);
    await OfflineStorage.recordOperation(op);

    setOrders((prev) => (existing ? prev.map((o) => (o.id === nextOrder.id ? nextOrder : o)) : [nextOrder, ...prev]));
    setOplog((prev) => [...prev, op]);
    setEditing(undefined);
    notify(existing ? 'Order updated locally' : 'Order saved to sovereign ledger');

    // Instant Realtime Cloud Sync to Supabase & All Devices
    if (navigator.onLine && organization?.id) {
      const cloudRecord = orderToCloud(nextOrder, organization.id, currentMember?.name || currentUser?.fullName || 'Operator');
      supabase
        .from('orders')
        .upsert(cloudRecord)
        .then(({ error }) => {
          if (error) {
            console.warn('Direct cloud upsert failed, queued:', error);
            enqueueMutation('upsert', nextOrder.id, nextOrder);
          } else {
            clearPendingMutation(nextOrder.id);
            setOrders((prev) => prev.map((o) => (o.id === nextOrder.id ? { ...o, pendingSync: false } : o)));
          }
        });
    } else {
      enqueueMutation('upsert', nextOrder.id, nextOrder);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!window.confirm('Delete this order from local sovereign ledger?')) return;
    await OfflineStorage.deleteOrder(orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setEditing(undefined);
    notify('Order deleted from local ledger');

    // Cloud delete from Supabase
    if (navigator.onLine && organization?.id) {
      supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .eq('org_id', organization.id)
        .then(({ error }) => {
          if (error) {
            enqueueMutation('delete', orderId);
          } else {
            clearPendingMutation(orderId);
          }
        });
    } else {
      enqueueMutation('delete', orderId);
    }
  };

  const updateSettings = async (nextSettings: Settings) => {
    await OfflineStorage.saveSettings(nextSettings);
    setSettings(nextSettings);
    notify('Workspace settings saved');
  };

  const exportWorkspace = () => {
    const snapshot = { orders, settings, oplog, conflicts };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendora-backup-${dateOnly()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Backup snapshot downloaded');
  };

  const importWorkspace = (file: File) => {
    file.text().then((text) => {
      try {
        const json = JSON.parse(text);
        if (json.orders && Array.isArray(json.orders)) {
          json.orders.forEach((o: Order) => OfflineStorage.saveOrder(o));
          setOrders(json.orders);
          if (json.settings) {
            OfflineStorage.saveSettings(json.settings);
            setSettings(json.settings);
          }
          notify('Ledger restored successfully from backup');
        }
      } catch {
        notify('Invalid backup file');
      }
    });
  };

  const resetWorkspace = async () => {
    if (!window.confirm('Reset all records back to demo store defaults?')) return;
    const res = await OfflineStorage.resetToSampleData();
    setOrders(res.orders);
    setSettings(res.settings);
    setOplog([]);
    setConflicts([]);
    notify('Demo store workspace restored');
  };

  const resolveConflict = async (id: string, resolution: 'local' | 'remote' | 'merge') => {
    await OfflineStorage.resolveConflict(id, resolution);
    setConflicts((prev) => prev.map((c) => (c.id === id ? { ...c, resolved: true, resolution } : c)));
    notify(`Conflict resolved: ${resolution}`);
  };

    if (!isAuthenticated || !currentUser) {
    return <AuthScreen onSuccess={() => window.location.reload()} />;
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: '100dvh', padding: 32, background: 'hsl(var(--background))' }}>
        <div className="skeleton" style={{ height: 32, width: 200 }} />
        <div className="skeleton" style={{ height: 60, width: '50%', marginTop: 40 }} />
        <div className="skeleton" style={{ height: 160, width: '100%', marginTop: 24 }} />
      </div>
    );
  }

  return (
    <AppShell settings={settings} online={online} pendingSyncCount={orders.filter((o) => o.pendingSync).length}>
      <Switch>
        <Route path="/">
          <Dashboard orders={orders} settings={settings} onNew={() => setEditing(null)} onEdit={setEditing} />
        </Route>
        <Route path="/orders">
          <OrdersPage
            orders={orders}
            settings={settings}
            onNew={() => setEditing(null)}
            onEdit={setEditing}
            query={ordersQuery}
            setQuery={setOrdersQuery}
            filter={ordersFilter}
            setFilter={setOrdersFilter}
          />
        </Route>
        <Route path="/inbox">
          <InboxPage
            message={inboxMessage}
            setMessage={setInboxMessage}
            parsed={inboxParsed}
            setParsed={setInboxParsed}
            forceOffline={inboxForceOffline}
            setForceOffline={setInboxForceOffline}
            onSave={saveOrder}
            onNotify={notify}
          />
        </Route>
        <Route path="/whatsapp">
          <WhatsAppDesk onSaveOrder={saveOrder} onNotify={notify} />
        </Route>
        <Route path="/employees">
          <EmployeesPage />
        </Route>
        <Route path="/team">
          <EmployeesPage />
        </Route>
        <Route path="/query">
          <div className="page">
            <Header
              eyebrow="AI Store Assistant"
              title="Operational Query Desk"
              subtitle="Natural Language and Voice query layer answering all core operational questions with zero scrolling."
            />
            <QueryDesk
              orders={orders}
              settings={settings}
              onEditOrder={setEditing}
              query={queryDeskQuery}
              onQueryChange={setQueryDeskQuery}
              selectedCustomer={queryDeskCustomer}
              onSelectCustomer={setQueryDeskCustomer}
            />
          </div>
        </Route>
        <Route path="/settings">
          <SettingsPage
            settings={settings}
            online={online}
            formDraft={settingsDraft}
            onFormDraftChange={setSettingsDraft}
            onSave={(newSettings) => {
              updateSettings(newSettings);
              setSettingsDraft(null);
            }}
            onExport={exportWorkspace}
            onImport={importWorkspace}
            onReset={resetWorkspace}
            onNotify={notify}
          />
        </Route>
        <Route component={NotFound} />
      </Switch>

      {editing !== undefined && (
        <OrderModal order={editing} onClose={() => setEditing(undefined)} onSave={saveOrder} onDelete={deleteOrder} />
      )}


      {toast && (
        <div className="toast" role="status" data-testid="status-toast">
          <CheckCircle2 /> {toast}
        </div>
      )}
    </AppShell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OrgAuthProvider>
          <RoutedErrorBoundary>
            <App />
          </RoutedErrorBoundary>
          <Toaster />
        </OrgAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default Root;
