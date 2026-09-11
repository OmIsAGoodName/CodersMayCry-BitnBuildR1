import { useState, useMemo } from 'react';
import {
  Search, Mic, MicOff, AlertCircle, Clock, CheckCircle2, IndianRupee,
  Layers, User, ChevronRight, Sparkles, MessageCircle, Phone, ArrowUpRight
} from 'lucide-react';
import { Order, Settings } from '@/lib/storage/offlineDb';

interface QueryDeskProps {
  orders: Order[];
  settings: Settings;
  onEditOrder: (order: Order) => void;
}

function dateOnly(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function dateOffset(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return dateOnly(d);
}

function money(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

export function QueryDesk({ orders, settings, onEditOrder }: QueryDeskProps) {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const todayStr = dateOnly();
  const next7DaysStr = dateOffset(7);

  // Core Operational Metrics
  const activeOrders = useMemo(() => orders.filter((o) => !['completed', 'cancelled'].includes(o.status)), [orders]);
  
  // 1. Due today & overdue
  const dueTodayOrders = useMemo(() => activeOrders.filter((o) => o.dueDate === todayStr), [activeOrders, todayStr]);
  const overdueOrders = useMemo(() => activeOrders.filter((o) => o.dueDate < todayStr), [activeOrders, todayStr]);

  // 2. Customers who owe money
  const debtorMap = useMemo(() => {
    const map = new Map<string, { customer: string; phone: string; balance: number; orders: Order[] }>();
    for (const order of orders) {
      const balance = Math.max(0, order.amount - order.paidAmount);
      if (balance > 0 && order.customer) {
        if (!map.has(order.customer)) {
          map.set(order.customer, { customer: order.customer, phone: order.phone, balance: 0, orders: [] });
        }
        const entry = map.get(order.customer)!;
        entry.balance += balance;
        entry.orders.push(order);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.balance - a.balance);
  }, [orders]);

  const totalOwed = useMemo(() => debtorMap.reduce((sum, d) => sum + d.balance, 0), [debtorMap]);

  // 3. Customer History Grouping
  const customerHistoryMap = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of orders) {
      if (order.customer) {
        if (!map.has(order.customer)) map.set(order.customer, []);
        map.get(order.customer)!.push(order);
      }
    }
    // Sort each customer's orders by date descending
    for (const [_, list] of map.entries()) {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return map;
  }, [orders]);

  // 4. Committed Capacity this week
  const weeklyCommittedItems = useMemo(() => {
    return activeOrders
      .filter((o) => o.dueDate <= next7DaysStr)
      .reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);
  }, [activeOrders, next7DaysStr]);

  const capacityPercent = Math.min(100, Math.round((weeklyCommittedItems / (settings.capacity || 12)) * 100));

  // Natural Language Query Filter Logic
  const queryIntent = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return 'all';

    if (q.includes('due') || q.includes('aaj') || q.includes('today') || q.includes('overdue') || q.includes('late')) {
      return 'due';
    }
    if (q.includes('owe') || q.includes('balance') || q.includes('debt') || q.includes('baki') || q.includes('paisa') || q.includes('rupaye') || q.includes('unpaid')) {
      return 'balance';
    }
    if (q.includes('capacity') || q.includes('load') || q.includes('week') || q.includes('haf') || q.includes('committed') || q.includes('limit')) {
      return 'capacity';
    }
    if (q.includes('last time') || q.includes('history') || q.includes('spec') || q.includes('previous') || q.includes('pichl')) {
      return 'history';
    }

    // Check if query matches a customer name directly
    const matchingCustomer = Array.from(customerHistoryMap.keys()).find((name) => name.toLowerCase().includes(q));
    if (matchingCustomer) {
      return 'customer_specific';
    }

    return 'search';
  }, [query, customerHistoryMap]);

  // Voice Query Integration
  const toggleVoice = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice speech recognition is not supported in this browser. Please use Chrome/Edge or type your query.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognition as any)();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      setIsListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div className="query-desk-wrap">
      {/* Search & Voice Bar */}
      <div className="search-bar-container">
        <div className="search-input-box">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="query-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything: “Who owes money?”, “What is due today?”, “Asha's last order”, “Committed capacity”"
            data-testid="input-query-desk"
          />
          {query && (
            <button className="clear-btn" onClick={() => { setQuery(''); setSelectedCustomer(null); }}>
              ✕
            </button>
          )}
          <button
            className={`voice-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleVoice}
            title={isListening ? 'Listening… Speak now' : 'Voice Query'}
            data-testid="button-voice-query"
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </div>

        {/* Quick 1-Tap Operational Filter Chips */}
        <div className="quick-chips">
          <button
            className={`chip ${queryIntent === 'due' ? 'active' : ''}`}
            onClick={() => setQuery('What is due today and overdue?')}
            data-testid="chip-due-today"
          >
            <Clock size={14} /> Due & Overdue ({dueTodayOrders.length + overdueOrders.length})
          </button>
          <button
            className={`chip ${queryIntent === 'balance' ? 'active' : ''}`}
            onClick={() => setQuery('Which customers owe money?')}
            data-testid="chip-debtors"
          >
            <IndianRupee size={14} /> Debt Balances ({money(totalOwed)})
          </button>
          <button
            className={`chip ${queryIntent === 'capacity' ? 'active' : ''}`}
            onClick={() => setQuery('What is my committed capacity this week?')}
            data-testid="chip-capacity"
          >
            <Layers size={14} /> Weekly Load ({capacityPercent}%)
          </button>
          <button
            className={`chip ${queryIntent === 'history' ? 'active' : ''}`}
            onClick={() => setQuery('Customer history and specifications')}
            data-testid="chip-history"
          >
            <User size={14} /> Customer Specs
          </button>
        </div>
      </div>

      {/* Instant Answer Cards Grid */}
      <div className="query-answers-grid">
        {/* Card 1: What is due today & overdue? */}
        {(queryIntent === 'all' || queryIntent === 'due') && (
          <section className="answer-card" data-testid="card-query-due">
            <div className="card-head">
              <div className="head-title">
                <span className="pill pill-warning"><Clock size={13} /> Question 1</span>
                <h3>Due Today & Overdue</h3>
              </div>
              <div className="badge-count">{overdueOrders.length + dueTodayOrders.length} Orders</div>
            </div>

            <div className="card-body">
              {overdueOrders.length > 0 && (
                <div className="alert-section overdue-alert">
                  <div className="alert-header">
                    <AlertCircle size={15} color="hsl(var(--destructive))" />
                    <strong>{overdueOrders.length} OVERDUE ORDER{overdueOrders.length > 1 ? 'S' : ''}</strong>
                  </div>
                  <div className="mini-order-list">
                    {overdueOrders.map((o) => (
                      <div key={o.id} className="mini-order-item" onClick={() => onEditOrder(o)}>
                        <div className="item-info">
                          <strong>{o.customer}</strong>
                          <span>{o.items.map((it) => `${it.quantity}× ${it.description}`).join(', ')}</span>
                        </div>
                        <div className="item-meta">
                          <span className="tag-overdue">Due {o.dueDate}</span>
                          <span className="item-price">{money(o.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="alert-section today-section">
                <div className="alert-header">
                  <Clock size={15} color="hsl(var(--primary))" />
                  <strong>DUE TODAY ({dueTodayOrders.length})</strong>
                </div>
                {dueTodayOrders.length > 0 ? (
                  <div className="mini-order-list">
                    {dueTodayOrders.map((o) => (
                      <div key={o.id} className="mini-order-item" onClick={() => onEditOrder(o)}>
                        <div className="item-info">
                          <strong>{o.customer}</strong>
                          <span>{o.items.map((it) => `${it.quantity}× ${it.description}`).join(', ')}</span>
                        </div>
                        <div className="item-meta">
                          <span className="tag-today">Today</span>
                          <span className="item-price">{money(o.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-sub">No other orders due today. Bench is clear!</div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Card 2: Which customers owe money, and how much in total? */}
        {(queryIntent === 'all' || queryIntent === 'balance') && (
          <section className="answer-card" data-testid="card-query-balances">
            <div className="card-head">
              <div className="head-title">
                <span className="pill pill-success"><IndianRupee size={13} /> Question 2</span>
                <h3>Outstanding Debt Balances</h3>
              </div>
              <div className="badge-total">{money(totalOwed)} Total</div>
            </div>

            <div className="card-body">
              {debtorMap.length > 0 ? (
                <div className="debtor-list">
                  {debtorMap.map((d) => (
                    <div key={d.customer} className="debtor-row">
                      <div className="debtor-main">
                        <div className="avatar-circle">{d.customer.charAt(0)}</div>
                        <div className="debtor-info">
                          <strong>{d.customer}</strong>
                          <span>{d.phone || 'No phone recorded'} · {d.orders.length} order{d.orders.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="debtor-actions">
                        <div className="balance-due">{money(d.balance)}</div>
                        {d.phone && (
                          <a
                            href={`https://wa.me/${d.phone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(d.customer)},%20gentle%20reminder%20regarding%20your%20pending%20balance%20of%20${encodeURIComponent(money(d.balance))}%20at%20${encodeURIComponent(settings.operatorName)}'s%20${encodeURIComponent(settings.businessType)}.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-wa"
                            title="Send WhatsApp Reminder"
                          >
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-sub">
                  <CheckCircle2 size={24} color="hsl(var(--primary))" />
                  <span>All customer accounts are fully paid! Zero debt outstanding.</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Card 3: What did this customer order last time & specification? */}
        {(queryIntent === 'all' || queryIntent === 'history' || queryIntent === 'customer_specific') && (
          <section className="answer-card" data-testid="card-query-specs">
            <div className="card-head">
              <div className="head-title">
                <span className="pill pill-info"><User size={13} /> Question 3</span>
                <h3>Customer History & Specifications</h3>
              </div>
              <div className="badge-count">{customerHistoryMap.size} Customers</div>
            </div>

            <div className="card-body">
              <div className="customer-selector">
                <select
                  className="input"
                  value={selectedCustomer || ''}
                  onChange={(e) => setSelectedCustomer(e.target.value || null)}
                >
                  <option value="">-- Choose Customer to View Past Specs --</option>
                  {Array.from(customerHistoryMap.keys()).map((name) => (
                    <option key={name} value={name}>
                      {name} ({customerHistoryMap.get(name)?.length} orders)
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && customerHistoryMap.has(selectedCustomer) ? (
                <div className="customer-history-box">
                  <div className="box-title">
                    <strong>{selectedCustomer}</strong>
                    <span>{customerHistoryMap.get(selectedCustomer)?.length} Recorded Orders</span>
                  </div>

                  <div className="history-timeline">
                    {customerHistoryMap.get(selectedCustomer)!.map((ord, idx) => (
                      <div key={ord.id} className="timeline-node" onClick={() => onEditOrder(ord)}>
                        <div className="node-badge">{idx === 0 ? '✨ Latest Order' : `Order #${idx + 1}`}</div>
                        <div className="node-content">
                          <div className="node-header">
                            <strong>{ord.items.map((it) => `${it.quantity}× ${it.description}`).join(', ')}</strong>
                            <span>{ord.dueDate}</span>
                          </div>

                          {/* Attribute Specifications */}
                          {ord.items[0]?.attributes && Object.keys(ord.items[0].attributes).length > 0 && (
                            <div className="spec-chips">
                              {Object.entries(ord.items[0].attributes).map(([key, val]) => (
                                <span key={key} className="spec-chip">
                                  <em>{key}:</em> {String(val)}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="node-foot">
                            <span>Total: {money(ord.amount)} · Paid: {money(ord.paidAmount)}</span>
                            <span className={`status-pill status-${ord.status}`}>{ord.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="spec-prompt">
                  <Sparkles size={16} />
                  <span>Select any customer above or ask "Asha's last order" to inspect exact past measurements, fabric, flavors, and specifications.</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Card 4: What is my committed capacity this week? */}
        {(queryIntent === 'all' || queryIntent === 'capacity') && (
          <section className="answer-card" data-testid="card-query-capacity">
            <div className="card-head">
              <div className="head-title">
                <span className="pill pill-purple"><Layers size={13} /> Question 4</span>
                <h3>Committed Capacity This Week</h3>
              </div>
              <div className="badge-count">{capacityPercent}% Booked</div>
            </div>

            <div className="card-body">
              <div className="capacity-visual">
                <div className="capacity-stat-line">
                  <div className="stat-big">
                    {weeklyCommittedItems} <span>/ {settings.capacity || 12} items</span>
                  </div>
                  <div className="capacity-status">
                    {capacityPercent >= 90 ? (
                      <span className="cap-tag cap-full">⚠️ Near Capacity</span>
                    ) : (
                      <span className="cap-tag cap-open">✅ {Math.max(0, (settings.capacity || 12) - weeklyCommittedItems)} Slots Open</span>
                    )}
                  </div>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${capacityPercent}%`,
                      backgroundColor: capacityPercent > 85 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'
                    }}
                  />
                </div>

                <div className="capacity-subtext">
                  <span>📅 Next 7 Days (Due up to {next7DaysStr})</span>
                  <span>Target: {settings.capacity || 12} units/week</span>
                </div>
              </div>

              <div className="capacity-breakdown">
                <h4>Active Commitments ({activeOrders.filter((o) => o.dueDate <= next7DaysStr).length} Orders):</h4>
                <div className="mini-order-list">
                  {activeOrders
                    .filter((o) => o.dueDate <= next7DaysStr)
                    .map((o) => (
                      <div key={o.id} className="mini-order-item" onClick={() => onEditOrder(o)}>
                        <div className="item-info">
                          <strong>{o.customer}</strong>
                          <span>{o.items.map((it) => `${it.quantity}× ${it.description}`).join(', ')}</span>
                        </div>
                        <div className="item-meta">
                          <span>{o.dueDate}</span>
                          <strong>{o.items.reduce((s, it) => s + it.quantity, 0)} pcs</strong>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
