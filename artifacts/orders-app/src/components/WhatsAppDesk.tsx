import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, QrCode, Wifi, WifiOff, CheckCircle2, AlertTriangle,
  RotateCcw, Sparkles, Send, Phone, User, Calendar, IndianRupee,
  Layers, Check, Copy, RefreshCw, Volume2, ShieldCheck, Zap,
  Globe, Server, Link2, ExternalLink
, KeyRound, ChevronDown, X
} from 'lucide-react';
import { Order } from '@/lib/storage/offlineDb';
import { parseUniversalMessage } from '@/lib/parser/universalParser';
import { parseOrderHybrid, getActiveModelId, setActiveModelId } from '@/lib/parser/hybridParser';

interface WhatsAppStatus {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  qrDataUrl: string | null;
  qrRaw: string | null;
  connectedNumber: string | null;
  connectedName: string | null;
  autoReply: boolean;
  autoIngestThreshold: number;
  recentCount: number;
  activeBufferCount: number;
  debounceMs?: number;
  requireKeyword?: boolean;
  orderKeyword?: string;
}

interface ChatActivity {
  type: 'aggregating';
  phone: string;
  pushName: string;
  messageCount: number;
  messages: string[];
  preview: string;
}

interface ParsedWhatsAppOrder {
  messageId: string;
  rawMessage: string;
  rawMessages: string[];
  messageCount: number;
  phone: string;
  pushName: string;
  timestamp: number;
  receivedAt: string;
  parsed: {
    customer: string;
    phone: string;
    items: Array<{
      description: string;
      quantity: number;
      attributes?: Record<string, string>;
    }>;
    due_date: string | null;
    dueDate?: string | null;
    amount: number | null;
    paidAmount: number;
    status: string;
    referencesPriorOrder: boolean;
    confidence: number;
    needsClarification: boolean;
  };
  autoIngested?: boolean;
  parserUsed?: string;
}

interface WhatsAppDeskProps {
  onSaveOrder: (order: Partial<Order>) => void;
  onNotify: (msg: string) => void;
}

// Offline Web Audio Chime Synthesizer (Paytm / Soundbox style)
function playWhatsAppChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12); // D6

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  } catch (err) {
    console.debug('Audio chime suppressed:', err);
  }
}

const PRESET_SIMULATIONS = [
  {
    label: 'Grocery & Olive Oil (Sarah)',
    phone: '+919833445566',
    name: 'Sarah',
    text: 'Order: This is Sarah. Need 1 pack of Earl Grey tea bags and 3 bottles of olive oil delivered by 5 PM.',
  },
  {
    label: 'Cafe & Beverage (Mario Balotelli)',
    phone: '+919877112233',
    name: 'Mario Balotelli',
    text: "Order: This is Mario Balotelli. Need 1 pack of Coffee and 3 Cococola delivered by 5 PM. I'll pay u 250rs",
  },
  {
    label: 'Tailoring Burst (Ramesh)',
    phone: '+919820123456',
    name: 'Ramesh Kumar',
    text: 'Order: Bhaiya Ramesh here\n2 kurta urgently chahiye\nchest 40, navy blue\n15 tarikh tak de dena\nadvance ₹1800 gpay kiya',
  },
  {
    label: 'Bakery Order (Priya)',
    phone: '+919876543210',
    name: 'Priya Sharma',
    text: 'Order: main Priya bol rahi hu\nkal dopahar 1 baje 3 veg lunch thali aur 1kg chocolate cake chahiye\nwrite Happy Birthday Aryan\n720 rupaye bhej diye',
  },
];


// ==========================================
// CUSTOM STYLED AI ENGINE DROPDOWN
// ==========================================
interface EngineOption {
  id: string;
  label: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: 'groq' | 'gemini' | 'offline';
}

const ENGINE_OPTIONS: EngineOption[] = [
  {
    id: 'groq-qwen',
    label: 'Groq Ultra-Fast (14,400 req/day)',
    badge: '14,400 req/day · 0.3s',
    badgeColor: '#A855F7',
    description: 'Ultra-fast open weights inference (Qwen 2.5 & Llama 3.3)',
    icon: 'groq',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Google Gemini 3.6 Flash',
    badge: 'Multimodal AI',
    badgeColor: '#38BDF8',
    description: 'Deep semantic comprehension for Indian colloquialisms & Hinglish',
    icon: 'gemini',
  },
  {
    id: 'offline-engine',
    label: 'Sovereign Local Engine (100% Offline)',
    badge: '100% Offline · 0ms',
    badgeColor: '#10B981',
    description: 'Zero cloud dependencies, deterministic local regex & lexicon',
    icon: 'offline',
  },
];

function EngineSelectDropdown({
  activeModel,
  onChange,
}: {
  activeModel: string;
  onChange: (modelId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption =
    ENGINE_OPTIONS.find((opt) => opt.id === activeModel) || ENGINE_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const renderIcon = (type: 'groq' | 'gemini' | 'offline') => {
    switch (type) {
      case 'groq':
        return <Zap size={14} color="#A855F7" />;
      case 'gemini':
        return <Sparkles size={14} color="#38BDF8" />;
      case 'offline':
        return <ShieldCheck size={14} color="#10B981" />;
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        type="button"
        id="select-ai-engine"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 13px',
          borderRadius: 10,
          background: 'hsl(var(--card))',
          border: isOpen ? '1px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
          color: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
        title="Select AI Intake Engine"
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 6,
            background:
              currentOption.icon === 'groq'
                ? 'rgba(168, 85, 247, 0.15)'
                : currentOption.icon === 'gemini'
                ? 'rgba(56, 189, 248, 0.15)'
                : 'rgba(16, 185, 129, 0.15)',
          }}
        >
          {renderIcon(currentOption.icon)}
        </span>

        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Engine:</span>
        <span style={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>
          {currentOption.label.split(' ')[0]} {currentOption.label.split(' ')[1]}
        </span>

        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            fontWeight: 700,
            background: `${currentOption.badgeColor}1a`,
            color: currentOption.badgeColor,
            border: `1px solid ${currentOption.badgeColor}35`,
          }}
        >
          {currentOption.badge.split('·')[0].trim()}
        </span>

        <ChevronDown
          size={13}
          style={{
            color: 'hsl(var(--muted-foreground))',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: 330,
            zIndex: 150,
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 12,
            padding: 6,
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45), 0 0 1px rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            style={{
              padding: '6px 8px 6px',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            Select AI Parser Engine
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {ENGINE_OPTIONS.map((opt) => {
              const isSelected = opt.id === activeModel;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: isSelected ? 'hsl(var(--muted)/.6)' : 'transparent',
                    border: isSelected ? '1px solid hsl(var(--border))' : '1px solid transparent',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'hsl(var(--muted)/.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div
                    style={{
                      marginTop: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: `${opt.badgeColor}18`,
                      flexShrink: 0,
                    }}
                  >
                    {renderIcon(opt.icon)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                        {opt.label}
                      </span>
                      {isSelected && <Check size={14} color="#38bdf8" />}
                    </div>

                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2, lineHeight: 1.3 }}>
                      {opt.description}
                    </div>

                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        color: opt.badgeColor,
                      }}
                    >
                      {opt.badge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function WhatsAppDesk({ onSaveOrder, onNotify }: WhatsAppDeskProps) {
  const [status, setStatus] = useState<WhatsAppStatus>({
    status: 'disconnected',
    qrDataUrl: null,
    qrRaw: null,
    connectedNumber: null,
    connectedName: null,
    autoReply: false,
    autoIngestThreshold: 0.80,
    recentCount: 0,
    activeBufferCount: 0,
    debounceMs: 8000,
    requireKeyword: true,
    orderKeyword: 'order',
  });

  const [activeActivity, setActiveActivity] = useState<ChatActivity | null>(null);
  const [activeModel, setActiveModel] = useState<string>(() => getActiveModelId());
  const [messages, setMessages] = useState<ParsedWhatsAppOrder[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [autoIngest, setAutoIngest] = useState(true);
  const [simText, setSimText] = useState(PRESET_SIMULATIONS[0].text);
  const [simPhone, setSimPhone] = useState(PRESET_SIMULATIONS[0].phone);
  const [simName, setSimName] = useState(PRESET_SIMULATIONS[0].name);
  const [isSimulating, setIsSimulating] = useState(false);
  const [savedOrderIds, setSavedOrderIds] = useState<Set<string>>(new Set());
  const [bridgeUrl, setBridgeUrl] = useState<string>(() => {
    return localStorage.getItem('vendora_wa_bridge_url') || (import.meta.env.VITE_WHATSAPP_BACKEND_URL || '');
  });
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [customBridgeInput, setCustomBridgeInput] = useState('');
  const [dismissGuidance, setDismissGuidance] = useState(false);

  const getApiUrl = (endpoint: string) => {
    const base = bridgeUrl.trim().replace(/\/+$/, '');
    return base ? `${base}${endpoint}` : endpoint;
  };


  const eventSourceRef = useRef<EventSource | null>(null);
  const activityTimerRef = useRef<any>(null);

  // Initialize SSE stream
  useEffect(() => {
    let es: EventSource | null = null;

    const setupSSE = () => {
      try {
        es = new EventSource(getApiUrl('/api/whatsapp/stream'));
        eventSourceRef.current = es;

        es.addEventListener('status', (e) => {
          try {
            const data: WhatsAppStatus = JSON.parse(e.data);
            setStatus(data);
            setConnecting(false);
          } catch {}
        });

        es.addEventListener('qr', (e) => {
          try {
            const data = JSON.parse(e.data);
            setStatus((prev) => ({
              ...prev,
              status: 'qr_ready',
              qrRaw: data.qrRaw,
              qrDataUrl: data.qrDataUrl,
            }));
            setConnecting(false);
          } catch {}
        });

        es.addEventListener('chat_activity', (e) => {
          try {
            const activity: ChatActivity = JSON.parse(e.data);
            setActiveActivity(activity);
            clearTimeout(activityTimerRef.current);
            // Hide aggregating banner after debounce window + grace period
            const waitMs = (status.debounceMs || 8000) + 2000;
            activityTimerRef.current = setTimeout(() => {
              setActiveActivity(null);
            }, waitMs);
          } catch {}
        });

        es.addEventListener('message', (e) => {
          try {
            const order: ParsedWhatsAppOrder = JSON.parse(e.data);
            setActiveActivity(null);
            playWhatsAppChime();

            setMessages((prev) => [order, ...prev.filter((m) => m.messageId !== order.messageId)]);

            onNotify(`WhatsApp Order Received from ${order.parsed.customer}`);

            // Auto Ingestion Check
            if (autoIngest && order.parsed.confidence >= (status.autoIngestThreshold || 0.80) && !order.parsed.needsClarification) {
              onSaveOrder({
                customer: order.parsed.customer,
                phone: order.parsed.phone,
                items: order.parsed.items,
                dueDate: order.parsed.due_date || new Date().toISOString().slice(0, 10),
                amount: order.parsed.amount || 0,
                paidAmount: order.parsed.paidAmount || 0,
                status: 'new',
                referencesPriorOrder: order.parsed.referencesPriorOrder,
                confidence: order.parsed.confidence,
                needsClarification: order.parsed.needsClarification,
                rawMessage: order.rawMessage,
              });
              setSavedOrderIds((prev) => new Set(prev).add(order.messageId));
              onNotify(`Auto-Ingested order from ${order.parsed.customer} to Sovereign Ledger!`);
            }
          } catch {}
        });

        es.onerror = () => {
          // SSE reconnect handled by browser EventSource automatically
        };
      } catch (err) {
        console.warn('SSE Setup error:', err);
      }
    };

    setupSSE();

    // Fetch initial status & recent messages
    fetch(getApiUrl('/api/whatsapp/status'))
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => {});

    fetch(getApiUrl('/api/whatsapp/recent'))
      .then((r) => r.json())
      .then((data) => {
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});

    // Auto-poll status every 3s to guarantee fresh QR code in cloud environments
    const pollInterval = setInterval(() => {
      fetch(getApiUrl('/api/whatsapp/status'))
        .then((r) => r.json())
        .then((data) => {
          if (data && data.status) {
            setStatus((prev) => {
              // Prevent momentary 'connecting' or spurious 'qr_ready' from flickering if already connected
              if (prev.status === 'connected' && data.status === 'connecting') {
                return prev;
              }
              if (prev.qrRaw !== data.qrRaw || prev.status !== data.status || prev.connectedNumber !== data.connectedNumber) {
                return { ...prev, ...data };
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(activityTimerRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [bridgeUrl, autoIngest, status.autoIngestThreshold, onNotify, onSaveOrder]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch(getApiUrl('/api/whatsapp/connect'), { method: 'POST' });
      if (!res.ok) throw new Error('Endpoint unreachable');
    } catch (err) {
      setConnecting(false);
      onNotify('Connecting to WhatsApp bridge... You can also test instant live message parsing via the burst simulator on the right!');
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch(getApiUrl('/api/whatsapp/disconnect'), { method: 'POST' });
      setStatus((prev) => ({
        ...prev,
        status: 'disconnected',
        qrDataUrl: null,
        qrRaw: null,
        connectedNumber: null,
        connectedName: null,
      }));
      onNotify('WhatsApp disconnected.');
    } catch {
      onNotify('Failed to disconnect WhatsApp');
    }
  };

  const handleSetDebounce = async (ms: number) => {
    setStatus((prev) => ({ ...prev, debounceMs: ms }));
    try {
      await fetch(getApiUrl('/api/whatsapp/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debounceMs: ms }),
      });
      onNotify(`Burst debounce window set to ${ms / 1000}s`);
    } catch {}
  };

  const handleToggleAutoReply = async () => {
    const next = !status.autoReply;
    setStatus((prev) => ({ ...prev, autoReply: next }));
    try {
      await fetch(getApiUrl('/api/whatsapp/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoReply: next }),
      });
      onNotify(next ? 'Auto-reply receipts ENABLED' : 'Auto-reply receipts DISABLED');
    } catch {}
  };

  const runClientSideSimulation = async (text: string, phone: string, name: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const totalLines = lines.length || 1;
    let currentIdx = 0;
    const accumulated: string[] = [];

    const interval = setInterval(() => {
      if (currentIdx < totalLines) {
        accumulated.push(lines[currentIdx]);
        currentIdx++;
        setActiveActivity({
          type: 'aggregating',
          phone,
          pushName: name,
          messageCount: accumulated.length,
          messages: [...accumulated],
          preview: accumulated.join(' '),
        });
      } else {
        clearInterval(interval);
        setTimeout(async () => {
          setActiveActivity(null);
          playWhatsAppChime();

          const rawMerged = accumulated.join('\n');
          const cleanMerged = rawMerged.replace(/^(?:order|#order|ord|booking)\b[:\s\-]*/i, '').trim();
          let parsedRes: any = null;
          let parserBadge = 'Sovereign Local Engine';

          try {
            const hybridRes = await parseOrderHybrid(cleanMerged, { modelId: activeModel, forceOffline: activeModel === 'offline-engine' });
            parsedRes = hybridRes;
            parserBadge = hybridRes._source === 'online_ai'
              ? (hybridRes._modelUsed ? `Online AI (${hybridRes._modelUsed})` : 'Online AI (Gemini 3.6 Flash)')
              : 'Sovereign Local Engine';
          } catch {
            parsedRes = parseUniversalMessage(cleanMerged);
            parserBadge = 'Sovereign Local Engine';
          }

          const newOrder: ParsedWhatsAppOrder = {
            messageId: 'sim_' + Date.now(),
            rawMessage: rawMerged,
            rawMessages: [...accumulated],
            messageCount: accumulated.length,
            phone,
            pushName: name,
            timestamp: Math.floor(Date.now() / 1000),
            receivedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            parsed: {
              customer: parsedRes.customer || name,
              phone,
              items: (parsedRes.items || []).map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                attributes: item.attributes,
              })),
              due_date: parsedRes.due_date,
              dueDate: parsedRes.due_date,
              amount: parsedRes.amount,
              paidAmount: 0,
              status: 'new',
              referencesPriorOrder: parsedRes.references_prior_order || parsedRes.referencesPriorOrder || false,
              confidence: parsedRes.confidence,
              needsClarification: parsedRes.needs_clarification || parsedRes.needsClarification || false,
            },
            autoIngested: autoIngest && parsedRes.confidence >= (status.autoIngestThreshold || 0.80) && !parsedRes.needs_clarification,
            parserUsed: parserBadge,
          };

          setMessages((prev) => [newOrder, ...prev.filter((m) => m.messageId !== newOrder.messageId)]);
          onNotify(`WhatsApp Order Received from ${newOrder.parsed.customer}`);

          if (newOrder.autoIngested) {
            onSaveOrder({
              customer: newOrder.parsed.customer,
              phone: newOrder.parsed.phone,
              items: newOrder.parsed.items,
              dueDate: newOrder.parsed.due_date || new Date().toISOString().slice(0, 10),
              amount: newOrder.parsed.amount || 0,
              paidAmount: newOrder.parsed.paidAmount || 0,
              status: 'new',
              referencesPriorOrder: newOrder.parsed.referencesPriorOrder,
              confidence: newOrder.parsed.confidence,
              needsClarification: newOrder.parsed.needsClarification,
              rawMessage: newOrder.rawMessage,
            });
            setSavedOrderIds((prev) => new Set(prev).add(newOrder.messageId));
            onNotify(`Auto-Ingested order from ${newOrder.parsed.customer} to Sovereign Ledger!`);
          }
        }, 1200);
      }
    }, 450);
  };

      const handleToggleEngine = () => {
    const nextModel = activeModel === 'gemini-3.6-flash' ? 'offline-engine' : 'gemini-3.6-flash';
    setActiveModel(nextModel);
    setActiveModelId(nextModel);
    onNotify(nextModel === 'gemini-3.6-flash' ? '⚡ Switched to Online AI (Gemini 3.6 Flash)' : '🛡️ Switched to Sovereign Local Engine (Offline)');
  };

  const handleToggleKeywordGate = async () => {
    const nextVal = !(status.requireKeyword ?? true);
    setStatus((prev) => ({ ...prev, requireKeyword: nextVal }));
    try {
      await fetch(getApiUrl('/api/whatsapp/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requireKeyword: nextVal, orderKeyword: 'order' }),
      });
      onNotify(nextVal ? 'Privacy Keyword Gate ENABLED: Only messages starting with "order" are processed' : 'AI Intent Auto-Detection Mode enabled');
    } catch {}
  };

  const handleSimulateBurst = async () => {
    if (!simText.trim()) return;
    setIsSimulating(true);
    try {
      const res = await fetch(getApiUrl('/api/whatsapp/test-message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: simText,
          phone: simPhone,
          name: simName,
        }),
      });
      if (!res.ok) throw new Error('Backend not available');
      onNotify(`Simulated 5-part message burst from ${simName}!`);
    } catch {
      runClientSideSimulation(simText, simPhone, simName);
      onNotify(`Simulated 5-part message burst from ${simName}! (In-Browser Engine)`);
    } finally {
      setTimeout(() => setIsSimulating(false), 500);
    }
  };

  const handleSaveSingleOrder = (item: ParsedWhatsAppOrder) => {
    onSaveOrder({
      customer: item.parsed.customer,
      phone: item.parsed.phone,
      items: item.parsed.items,
      dueDate: item.parsed.due_date || new Date().toISOString().slice(0, 10),
      amount: item.parsed.amount || 0,
      paidAmount: item.parsed.paidAmount || 0,
      status: 'new',
      referencesPriorOrder: item.parsed.referencesPriorOrder,
      confidence: item.parsed.confidence,
      needsClarification: item.parsed.needsClarification,
      rawMessage: item.rawMessage,
    });
    setSavedOrderIds((prev) => new Set(prev).add(item.messageId));
    onNotify(`Order for ${item.parsed.customer} saved to Sovereign Ledger!`);
  };

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 22, gap: 16 }}>
        <div style={{ maxWidth: 740 }}>
          <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            SOVEREIGN HARDWARE BRIDGE
          </span>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '3px 0 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={26} color="#25D366" />
            WhatsApp Business Live Intake Desk
          </h1>
          <p className="subtitle" style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'hsl(var(--muted-foreground))' }}>
            Zero-cloud-cost multi-device pairing. Aggregates burst customer chats, debounces multi-turn messages, auto-resolves Hinglish colloquialisms, and records orders straight into your Sovereign Ledger.
          </p>
        </div>

        {/* Top Status & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
          {/* Bridge Toggle */}
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setCustomBridgeInput(bridgeUrl);
              setShowBridgeModal(true);
            }}
            title="Configure Cloud Backend Bridge URL (Render / Railway)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 12px', borderRadius: 9 }}
          >
            <Server size={14} color={bridgeUrl ? '#38BDF8' : '#94A3B8'} />
            <span>{bridgeUrl ? 'Cloud Bridge' : 'Local Bridge'}</span>
          </button>

          {/* Connection Status Capsule */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px',
              borderRadius: 9,
              background: status.status === 'connected'
                ? 'rgba(16, 185, 129, 0.12)'
                : status.status === 'qr_ready' || status.status === 'connecting'
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(239, 68, 68, 0.09)',
              border: status.status === 'connected'
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : status.status === 'qr_ready' || status.status === 'connecting'
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: 12,
              fontWeight: 700,
              color: status.status === 'connected'
                ? '#10B981'
                : status.status === 'qr_ready' || status.status === 'connecting'
                  ? '#F59E0B'
                  : '#F87171',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: status.status === 'connected'
                  ? '#10B981'
                  : status.status === 'qr_ready' || status.status === 'connecting'
                    ? '#F59E0B'
                    : '#EF4444',
                boxShadow: status.status === 'connected' ? '0 0 8px #10B981' : 'none',
              }}
            />
            {status.status === 'connected' ? (
              <span>CONNECTED: {status.connectedName} (+{status.connectedNumber})</span>
            ) : status.status === 'qr_ready' ? (
              <span>READY TO PAIR (SCAN QR)</span>
            ) : status.status === 'connecting' ? (
              <span>CONNECTING WEBSOCKET...</span>
            ) : (
              <span>DISCONNECTED</span>
            )}
          </div>

          {/* Connect / Disconnect Action */}
          {status.status === 'connected' ? (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={handleDisconnect}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px', borderRadius: 9 }}
              title="Disconnect linked WhatsApp device"
            >
              <WifiOff size={14} /> Disconnect
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={connecting || status.status === 'connecting'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                padding: '7px 16px',
                borderRadius: 9,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                border: 'none',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              }}
            >
              {connecting ? <RefreshCw size={14} className="spin" /> : <QrCode size={14} />}
              <span>{status.status === 'qr_ready' ? 'Regenerate QR' : 'Pair WhatsApp'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Command & Security Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          padding: '12px 18px',
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 14,
          marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Custom Engine Dropdown */}
          <EngineSelectDropdown
            activeModel={activeModel}
            onChange={(val) => {
              setActiveModel(val);
              setActiveModelId(val);
              onNotify(
                `Switched to ${
                  val === 'groq-qwen'
                    ? 'Groq Fast Engine (14,400 req/day)'
                    : val === 'gemini-3.6-flash'
                    ? 'Google Gemini 3.6 Flash'
                    : 'Sovereign Local Engine'
                }`
              );
            }}
          />

          {/* Privacy Keyword Gate */}
          <button
            type="button"
            id="toggle-keyword-gate-btn"
            onClick={handleToggleKeywordGate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px',
              borderRadius: 10,
              background: (status.requireKeyword ?? true) ? 'rgba(56, 189, 248, 0.09)' : 'rgba(234, 179, 8, 0.09)',
              color: (status.requireKeyword ?? true) ? '#38BDF8' : '#FBBF24',
              border: (status.requireKeyword ?? true) ? '1px solid rgba(56, 189, 248, 0.28)' : '1px solid rgba(234, 179, 8, 0.28)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="When active, messages MUST start with 'order' (e.g. 'Order: ...') so personal family chats are 100% ignored. Click to switch to Auto-Detect All."
          >
            <KeyRound size={13} />
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Keyword Gate:</span>
            <span style={{ fontWeight: 700, color: (status.requireKeyword ?? true) ? '#38BDF8' : '#FBBF24' }}>
              {(status.requireKeyword ?? true) ? 'Required (Prefix "Order")' : 'Off (Auto-Detect All)'}
            </span>
          </button>
        </div>

        {/* Right side: Zero-Leak Privacy Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 12px',
            borderRadius: 20,
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            fontSize: 12,
            color: '#10B981',
            fontWeight: 600,
          }}
          title="AI Privacy Guard auto-filters spouse messages, family chats, personal chatter, and OTPs so employees only see commercial orders"
        >
          <ShieldCheck size={14} />
          <span>Zero-Leak Shield Active</span>
          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
            · {(status.requireKeyword ?? true) ? 'Personal & domestic chats shielded' : 'AI intent scanning active'}
          </span>
        </div>
      </div>

      {/* Subtle Guidance Strip with Dismiss */}
      {!dismissGuidance && (
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.18)',
            borderRadius: 10,
            padding: '8px 14px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={14} color="#38BDF8" style={{ flexShrink: 0 }} />
            <span>
              <strong style={{ color: 'hsl(var(--foreground))' }}>Multi-Turn WhatsApp Bridge:</strong> Live 3.0s burst debouncing with instant voice &amp; message resolution. Use the <strong>Interactive Simulator</strong> on the right to test without a phone, or pair via <strong>QR Connect</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDismissGuidance(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Dismiss notice"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Live Aggregation Pulse Banner (Burst Debouncer in action) */}
      {activeActivity && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(37, 211, 102, 0.15), rgba(16, 185, 129, 0.1))',
            border: '1px solid rgba(37, 211, 102, 0.4)',
            borderRadius: 12,
            padding: '12px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'pulse 1.8s infinite',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 99, background: '#25D366' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 13, color: '#F8FAFC' }}>
                  Customer Typing / Burst Aggregating ({activeActivity.pushName} · {activeActivity.phone})
                </strong>
                <span style={{ fontSize: 11, background: '#25D366', color: '#000', padding: '1px 8px', borderRadius: 99, fontWeight: 700 }}>
                  {activeActivity.messageCount} fragments merged
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 3 }}>
                Live Stream: <em>"{activeActivity.preview}"</em>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, font: '11px var(--app-font-mono)', color: 'hsl(var(--muted-foreground))', textAlign: 'right' }}>
            Debounce buffer: {((status.debounceMs || 8000) / 1000).toFixed(0)}s window...
          </div>
        </div>
      )}

      {/* Main Two-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        {/* Left: Live Inbound WhatsApp Feed */}
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <div>
                <h2>Live Inbound Order Feed</h2>
                <span className="minor">Automatically parsed with {((status.debounceMs || 8000) / 1000).toFixed(0)}s multi-turn debouncing</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    color: '#60A5FA',
                    fontWeight: 600,
                  }}
                  title="Hybrid Mode: Online AI is prioritized, automatically falling back to Sovereign Local Engine when offline"
                >
                  <Sparkles size={11} />
                  <span>Hybrid Engine: Online AI + Offline Fallback</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <label htmlFor="debounce-select" style={{ color: 'hsl(var(--muted-foreground))' }}>Burst Buffer:</label>
                  <select
                    id="debounce-select"
                    value={status.debounceMs || 8000}
                    onChange={(e) => handleSetDebounce(parseInt(e.target.value, 10))}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: 'hsl(var(--muted)/.4)',
                      border: '1px solid hsl(var(--border))',
                      color: 'inherit',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <option value={5000}>5s (Fast)</option>
                    <option value={8000}>8s (Recommended)</option>
                    <option value={10000}>10s (Relaxed)</option>
                    <option value={15000}>15s (Slow Typer)</option>
                  </select>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoIngest}
                    onChange={(e) => setAutoIngest(e.target.checked)}
                  />
                  <span>Auto-Commit to Ledger (&ge;80% conf)</span>
                </label>
              </div>
            </div>

            <div style={{ padding: '0 20px 20px' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'hsl(var(--muted-foreground))' }}>
                  <MessageSquare size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <h3>No incoming WhatsApp orders yet</h3>
                  <p style={{ fontSize: 13, maxWidth: 440, margin: '6px auto 0' }}>
                    Pair your WhatsApp number above or click <strong>"Simulate WhatsApp Burst"</strong> on the right to test multi-turn debounced ingestion.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {messages.map((msg) => {
                    const isSaved = savedOrderIds.has(msg.messageId);
                    return (
                      <div
                        key={msg.messageId}
                        style={{
                          background: 'hsl(var(--muted)/.3)',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 12,
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: 15 }}>{msg.parsed.customer}</strong>
                              <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{msg.phone}</span>
                              <span style={{ fontSize: 10, background: 'hsl(var(--secondary)/.2)', color: 'hsl(var(--secondary))', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>
                                {msg.messageCount} msgs merged
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: (msg.parserUsed || '').includes('Online') ? 'rgba(168, 85, 247, 0.25)' : 'rgba(16, 185, 129, 0.2)',
                                  color: (msg.parserUsed || '').includes('Online') ? '#C084FC' : '#10B981',
                                  border: (msg.parserUsed || '').includes('Online') ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid rgba(16, 185, 129, 0.45)',
                                }}
                                title="Engine used to parse this WhatsApp order"
                              >
                                {(msg.parserUsed || '').includes('Online') ? <Sparkles size={11} /> : <ShieldCheck size={11} />}
                                {msg.parserUsed || 'Sovereign Local Engine'}
                              </span>
                              {msg.parsed.referencesPriorOrder && (
                                <span style={{ fontSize: 10, background: 'rgba(59, 130, 246, 0.2)', color: '#38BDF8', padding: '1px 6px', borderRadius: 6 }}>
                                  Repeat Specs
                                </span>
                              )}
                            </div>
                            <small style={{ color: 'hsl(var(--muted-foreground))' }}>
                              Received: {new Date(msg.timestamp).toLocaleTimeString('en-IN')} · {new Date(msg.timestamp).toLocaleDateString('en-IN')}
                            </small>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                fontSize: 11,
                                padding: '3px 9px',
                                borderRadius: 6,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: (msg.parserUsed || '').includes('Online') ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                                color: (msg.parserUsed || '').includes('Online') ? '#C084FC' : '#10B981',
                                border: (msg.parserUsed || '').includes('Online') ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                              title="Indicates whether this message was extracted via Online AI or Sovereign On-Device NLP"
                            >
                              {(msg.parserUsed || '').includes('Online') ? <Sparkles size={12} /> : <ShieldCheck size={12} />}
                              {msg.parserUsed || 'Sovereign Local Engine'}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                font: '10px var(--app-font-mono)',
                                padding: '2px 8px',
                                borderRadius: 99,
                                background: msg.parsed.confidence >= 0.8 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: msg.parsed.confidence >= 0.8 ? '#10B981' : '#F59E0B',
                                fontWeight: 700,
                              }}
                            >
                              {Math.round(msg.parsed.confidence * 100)}% Match
                            </span>
                            {isSaved ? (
                              <span style={{ fontSize: 11, color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                <Check size={13} /> In Ledger
                              </span>
                            ) : (
                              <button
                                className="btn btn-primary"
                                style={{ padding: '4px 10px', fontSize: 11 }}
                                onClick={() => handleSaveSingleOrder(msg)}
                              >
                                Commit to Ledger
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Extracted Details Pill Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, background: 'hsl(var(--card))', padding: 10, borderRadius: 8 }}>
                          <div>
                            <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', display: 'block' }}>Items</span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>
                              {msg.parsed.items.map((i) => `${i.quantity}x ${i.description}`).join(', ')}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', display: 'block' }}>Attributes</span>
                            <span style={{ fontSize: 12 }}>
                              {Object.entries(msg.parsed.items[0]?.attributes || {}).length > 0
                                ? Object.entries(msg.parsed.items[0].attributes || {})
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(' · ')
                                : 'None'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', display: 'block' }}>Due Date</span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{msg.parsed.due_date || 'None'}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', display: 'block' }}>Total / Advance</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>
                              ₹{msg.parsed.amount || 0} {msg.parsed.paidAmount ? `(Adv ₹${msg.parsed.paidAmount})` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Raw Message Transcripts */}
                        <details style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                          <summary style={{ cursor: 'pointer' }}>View {msg.rawMessages.length} chat turns</summary>
                          <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid hsl(var(--border))' }}>
                            {msg.rawMessages.map((t, idx) => (
                              <div key={idx} style={{ marginTop: 2 }}>
                                • {t}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Device Pairing & Testing Simulator */}
        <div>
          {/* Pairing / QR Card */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <div>
                <h2>WhatsApp Device Pairing</h2>
                <span className="minor">Physical phone or WhatsApp Business</span>
              </div>
            </div>

            <div style={{ padding: '0 20px 20px', textAlign: 'center' }}>
              {status.status === 'connected' ? (
                <div style={{ padding: '24px 12px' }}>
                  <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ margin: 0 }}>Sovereign Bridge Active</h3>
                  <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', margin: '4px 0 16px' }}>
                    Paired to <strong>{status.connectedName}</strong> (+{status.connectedNumber})
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <button className="btn btn-quiet" onClick={handleDisconnect}>
                      Disconnect Device
                    </button>
                  </div>
                </div>
              ) : status.status === 'qr_ready' && status.qrDataUrl ? (
                <div>
                  <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 0 }}>
                    Open WhatsApp &rarr; <strong>Settings</strong> &rarr; <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong>:
                  </p>
                  <div
                    style={{
                      background: '#FFFFFF',
                      padding: 16,
                      borderRadius: 16,
                      display: 'inline-block',
                      margin: '10px auto',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                    }}
                  >
                    <img
                      src={status.qrDataUrl}
                      alt="WhatsApp QR Code"
                      style={{
                        width: 256,
                        height: 256,
                        display: 'block',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                    <button
                      className="btn btn-quiet"
                      onClick={handleConnect}
                      style={{ fontSize: 12 }}
                      title="Request fresh QR code"
                    >
                      <RefreshCw size={12} className={connecting ? "spin" : ""} /> Refresh QR Code
                    </button>
                  </div>
                  <small style={{ display: 'block', color: 'hsl(var(--muted-foreground))', marginTop: 8, fontSize: 11 }}>
                    Active & auto-refreshing • Standard WhatsApp Web multi-device pairing
                  </small>
                </div>
              ) : (
                <div style={{ padding: '24px 12px' }}>
                  <QrCode size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <h3>No Device Linked</h3>
                  <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', margin: '4px 0 16px' }}>
                    Connect your physical WhatsApp or WhatsApp Business number to stream orders in real time with 0 API charges.
                  </p>
                  <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
                    {connecting ? <RefreshCw size={14} className="spin" /> : <QrCode size={14} />}
                    Generate Pairing QR Code
                  </button>
                </div>
              )}

              {/* Auto Reply Receipt Toggle */}
              <div
                style={{
                  borderTop: '1px solid hsl(var(--border))',
                  paddingTop: 14,
                  marginTop: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                }}
              >
                <div>
                  <strong style={{ fontSize: 12, display: 'block' }}>Customer Receipt Auto-Reply</strong>
                  <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                    Sends confirmation receipt on WhatsApp upon ingestion
                  </span>
                </div>
                <button
                  className={`btn ${status.autoReply ? 'btn-primary' : 'btn-quiet'}`}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={handleToggleAutoReply}
                >
                  {status.autoReply ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>

          {/* Test & Judge Evaluation Simulator */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>WhatsApp Burst Simulator</h2>
                <span className="minor">Test multi-turn debouncer without a phone</span>
              </div>
              <Zap size={16} color="hsl(var(--secondary))" />
            </div>

            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {PRESET_SIMULATIONS.map((sim, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-quiet"
                    style={{ padding: '3px 8px', fontSize: 10 }}
                    onClick={() => {
                      setSimText(sim.text);
                      setSimPhone(sim.phone);
                      setSimName(sim.name);
                    }}
                  >
                    {sim.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div className="field">
                  <label style={{ fontSize: 10 }}>Sender Name</label>
                  <input
                    type="text"
                    className="input"
                    value={simName}
                    onChange={(e) => setSimName(e.target.value)}
                    style={{ minHeight: 30, fontSize: 12 }}
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: 10 }}>WhatsApp Phone</label>
                  <input
                    type="text"
                    className="input"
                    value={simPhone}
                    onChange={(e) => setSimPhone(e.target.value)}
                    style={{ minHeight: 30, fontSize: 12 }}
                  />
                </div>
              </div>

              <div className="field">
                <label style={{ fontSize: 10 }}>Fragmented Customer Chat (1 line = 1 message)</label>
                <textarea
                  className="input"
                  rows={5}
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  style={{ font: '12px var(--app-font-mono)', lineHeight: '1.4' }}
                />
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={handleSimulateBurst}
                disabled={isSimulating}
              >
                <Send size={13} />
                {isSimulating ? 'Sending 5-Turn Burst...' : 'Simulate Real-Time WhatsApp Burst'}
              </button>

              <small style={{ display: 'block', color: 'hsl(var(--muted-foreground))', marginTop: 8, fontSize: 11, textAlign: 'center' }}>
                Simulates rapid customer chat bursts &rarr; triggers 3.0s sliding aggregator &rarr; emits live pulse &rarr; outputs structured order.
              </small>
            </div>
          </div>
        </div>
      </div>
      {/* Cloud Bridge Endpoint Modal */}
      {showBridgeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowBridgeModal(false)}
        >
          <div
            className="panel"
            style={{ maxWidth: 520, width: '100%', padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Server size={22} color="#38BDF8" />
              <h2 style={{ fontSize: 18, margin: 0 }}>Configure WhatsApp Cloud Bridge</h2>
            </div>
            <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', lineHeight: 1.5, marginBottom: 16 }}>
              Connect your Vercel deployment to a persistent 24/7 backend on <strong>Render</strong> or <strong>Railway</strong> so physical Baileys WebSockets remain active in the cloud.
            </p>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              Backend Bridge Base URL:
            </label>
            <input
              type="text"
              placeholder="https://vendora-bridge.onrender.com (or leave empty for same-host)"
              value={customBridgeInput}
              onChange={(e) => setCustomBridgeInput(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--muted)/.4)',
                color: 'inherit',
                fontSize: 13,
                marginBottom: 14,
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <button
                className="btn btn-quiet"
                onClick={() => {
                  setBridgeUrl('');
                  localStorage.removeItem('vendora_wa_bridge_url');
                  setShowBridgeModal(false);
                  onNotify('Reset bridge to same-host default.');
                }}
              >
                Reset to Default
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-quiet" onClick={() => setShowBridgeModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const cleaned = customBridgeInput.trim().replace(/\/+$/, '');
                    setBridgeUrl(cleaned);
                    localStorage.setItem('vendora_wa_bridge_url', cleaned);
                    setShowBridgeModal(false);
                    onNotify(cleaned ? `Saved cloud bridge: ${cleaned}` : 'Using same-host bridge');
                  }}
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

