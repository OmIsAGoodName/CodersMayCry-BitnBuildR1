import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Mic, MicOff, AlertCircle, Clock, CheckCircle2, IndianRupee,
  Layers, User, ChevronRight, Sparkles, Phone, ArrowUpRight
} from 'lucide-react';
import { Order, Settings } from '@/lib/storage/offlineDb';
import { getSavedProviderKeys } from '@/lib/parser/hybridParser';

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
  return `\u20B9${value.toLocaleString('en-IN')}`;
}

async function transcribeAudioWithGemini(audioBlob: Blob, apiKey: string): Promise<string> {
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
  });
  reader.readAsDataURL(audioBlob);
  const base64Audio = await base64Promise;
  if (!base64Audio) return '';

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Audio
            }
          },
          {
            text: 'Transcribe what is spoken in this audio query in English or Hinglish (e.g. "Whats due today", "Kiska paisa baki hai", "Asha ka pichla order"). Return ONLY the exact transcribed words, nothing else.'
          }
        ]
      }]
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini transcription error: ${res.status}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return text.replace(/^[\"']|[\"']$/g, '');
}

export function QueryDesk({ orders, settings, onEditOrder }: QueryDeskProps) {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechState, setSpeechState] = useState<'idle' | 'listening' | 'sound_detected' | 'speech_detected'>('idle');
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<any>(null);

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

  // Natural Language & Hinglish Query Filter Logic
  const queryIntent = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return 'all';

    // 1. Check for specific customer mention in query
    for (const customerName of customerHistoryMap.keys()) {
      const cLow = customerName.toLowerCase();
      if (q.includes(cLow)) {
        if (selectedCustomer !== customerName) {
          setSelectedCustomer(customerName);
        }
        return 'customer_specific';
      }
    }

    // 2. Due today / Overdue / Urgency (English & Hinglish)
    const dueKeywords = [
      'due', 'today', 'overdue', 'late', 'urgent', 'pending order', 'deadline',
      'aaj', 'kal', 'parso', 'kab dena', 'dena hai', 'deliver', 'delivery',
      'taiyari', 'taiyar', 'kya delivery hai', 'kiska delivery'
    ];
    if (dueKeywords.some((kw) => q.includes(kw))) {
      return 'due';
    }

    // 3. Debt / Balances / Unpaid (English & Hinglish)
    const balanceKeywords = [
      'owe', 'owes', 'balance', 'debt', 'unpaid', 'dues',
      'baki', 'baaki', 'paisa', 'paise', 'rupaye', 'rupees', 'udhar', 'udhari',
      'hisab', 'hisaab', 'kiska baki', 'kiske paise', 'lena hai', 'vasooli', 'bache hain'
    ];
    if (balanceKeywords.some((kw) => q.includes(kw))) {
      return 'balance';
    }

    // 4. Committed Capacity / Workshop load (English & Hinglish)
    const capacityKeywords = [
      'capacity', 'load', 'week', 'committed', 'limit', 'target', 'quota', 'slots',
      'hafta', 'hafte', 'kaam', 'kam baki', 'kitna load', 'workshop load',
      'kitna deliver', 'kitne orders kar payenge'
    ];
    if (capacityKeywords.some((kw) => q.includes(kw))) {
      return 'capacity';
    }

    // 5. Customer History / Previous specs (English & Hinglish)
    const historyKeywords = [
      'last time', 'history', 'spec', 'specs', 'previous', 'past', 'measurement', 'measurements', 'fabric', 'flavor',
      'pichla', 'pichle', 'pichli', 'purana', 'purane', 'pehle kya', 'kya banwaya'
    ];
    if (historyKeywords.some((kw) => q.includes(kw))) {
      return 'history';
    }

    // Check partial customer name match
    const matchingCustomer = Array.from(customerHistoryMap.keys()).find((name) =>
      name.toLowerCase().includes(q) || q.split(/\s+/).some((w) => w.length > 2 && name.toLowerCase().includes(w))
    );
    if (matchingCustomer) {
      if (selectedCustomer !== matchingCustomer) {
        setSelectedCustomer(matchingCustomer);
      }
      return 'customer_specific';
    }

    return 'search';
  }, [query, customerHistoryMap, selectedCustomer]);

  // Stop Recording / Listening
  const stopVoice = async () => {
    setIsListening(false);
    setSpeechState('idle');

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    // Process audio if fallback MediaRecorder was used
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const recorder = mediaRecorderRef.current;
      const audioBlobPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
        };
      });
      try { recorder.stop(); } catch {}

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setVoiceStatus('Transcribing audio with Google Gemini...');
      const audioBlob = await audioBlobPromise;
      const geminiKey = getSavedProviderKeys().gemini;
      if (geminiKey && audioBlob.size > 800) {
        try {
          const transcribed = await transcribeAudioWithGemini(audioBlob, geminiKey);
          if (transcribed) {
            setQuery(transcribed);
            setLiveTranscript(transcribed);
            setVoiceStatus(`Transcribed: "${transcribed}"`);
            return;
          }
        } catch (gemErr) {
          console.warn('Gemini audio transcription failed:', gemErr);
        }
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (liveTranscript) {
      setVoiceStatus(`Transcribed: "${liveTranscript}"`);
    } else {
      setVoiceStatus('Voice query complete.');
    }
  };

  // Start Live Speech Recognition (Google Keyboard / Gboard live streaming style)
  const toggleVoice = async () => {
    if (typeof window === 'undefined') return;

    if (isListening) {
      await stopVoice();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // PRIMARY PATH: Web Speech API for instantaneous live word-by-word streaming typing
    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch {}
          recognitionRef.current = null;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-IN'; // Google's Indian bilingual speech model for English & Hinglish
        recognition.continuous = true;
        recognition.interimResults = true; // Enables instant live typing while speaking
        recognition.maxAlternatives = 1;

        setIsListening(true);
        setLiveTranscript('');
        setSpeechState('listening');
        setVoiceStatus('🎙️ Listening... Speak now (say "whats due today" or "kiska paisa baki hai")');

        recognition.onaudiostart = () => {
          setSpeechState('listening');
        };

        recognition.onsoundstart = () => {
          setSpeechState('sound_detected');
        };

        recognition.onspeechstart = () => {
          setSpeechState('speech_detected');
        };

        // Stream words live as you speak (Google Keyboard style)
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
            setQuery(liveWords);
            setLiveTranscript(liveWords);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsListening(false);
            setVoiceStatus('⚠️ Microphone permission blocked. Click the lock/settings icon in your browser URL bar to allow microphone.');
          } else if (event.error === 'network') {
            setIsListening(false);
            setVoiceStatus('⚠️ Speech connection timeout. Tap mic to retry.');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          setSpeechState('idle');
        };

        recognition.start();
        return;
      } catch (recErr) {
        console.warn('SpeechRecognition start failed, trying MediaRecorder fallback:', recErr);
      }
    }

    // FALLBACK PATH: For browsers without SpeechRecognition (Firefox / Safari restrictions)
    try {
      setIsListening(true);
      setLiveTranscript('');
      setVoiceStatus('Recording audio query via microphone...');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(250);
    } catch (err: any) {
      setIsListening(false);
      setVoiceStatus('⚠️ Could not access microphone. Please check browser microphone permissions.');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

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
            placeholder='Ask anything in English or Hinglish: "Whats due today?", "Kiska paisa baki hai?", "Asha ka pichla order", "Hafte ka load"'
            data-testid="input-query-desk"
          />
          {query && (
            <button className="clear-btn" onClick={() => { setQuery(''); setSelectedCustomer(null); setLiveTranscript(''); setVoiceStatus(''); }} title="Clear query">
              ✕
            </button>
          )}
          <button
            className={`voice-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleVoice}
            title={isListening ? 'Live speech recording active... Tap to stop' : 'Live Voice Query (Google Keyboard style)'}
            data-testid="button-voice-query"
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </div>

        {/* Live Gboard-Style Real-Time Speech Feedback Banner */}
        {isListening && (
          <div className="voice-listening-banner">
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
                  <em>Speak now (say e.g. "whats due today" or "kiska paisa baki hai")...</em>
                )}
              </div>
            </div>
            <button className="voice-stop-btn" onClick={stopVoice}>
              Done ✓
            </button>
          </div>
        )}

        {/* Voice status banner */}
        {voiceStatus && !isListening && (
          <div className="voice-status-pill">
            <span>{voiceStatus}</span>
            <button onClick={() => setVoiceStatus('')} title="Dismiss">✕</button>
          </div>
        )}

        {/* Quick 1-Tap Operational & Hinglish Filter Chips */}
        <div className="quick-chips">
          <button
            className={`chip ${queryIntent === 'due' ? 'active' : ''}`}
            onClick={() => setQuery('Aaj kya deliver karna hai?')}
            data-testid="chip-due-today"
            title="What is due today & overdue?"
          >
            <Clock size={14} /> Due & Overdue ({dueTodayOrders.length + overdueOrders.length})
            <span className="chip-hinglish">"Aaj kya deliver karna hai?"</span>
          </button>
          <button
            className={`chip ${queryIntent === 'balance' ? 'active' : ''}`}
            onClick={() => setQuery('Kiska paisa baki hai?')}
            data-testid="chip-debtors"
            title="Which customers owe money?"
          >
            <IndianRupee size={14} /> Unpaid Balances ({money(totalOwed)})
            <span className="chip-hinglish">"Kiska paisa baki hai?"</span>
          </button>
          <button
            className={`chip ${queryIntent === 'capacity' ? 'active' : ''}`}
            onClick={() => setQuery('Hafte ka kitna load hai?')}
            data-testid="chip-capacity"
            title="What is our committed capacity this week?"
          >
            <Layers size={14} /> Weekly Load ({capacityPercent}%)
            <span className="chip-hinglish">"Hafte ka load?"</span>
          </button>
          <button
            className={`chip ${queryIntent === 'history' || queryIntent === 'customer_specific' ? 'active' : ''}`}
            onClick={() => {
              const firstCust = Array.from(customerHistoryMap.keys())[0] || '';
              setQuery(firstCust ? `${firstCust} ka pichla order` : 'Customer history and specifications');
            }}
            data-testid="chip-history"
            title="Customer history, repeat orders, and exact past specifications"
          >
            <User size={14} /> Customer Specs
            <span className="chip-hinglish">"Pichla order & specs"</span>
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
                          <span>{o.items.map((it) => `${it.quantity} × ${it.description}`).join(', ')}</span>
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
                          <span>{o.items.map((it) => `${it.quantity} × ${it.description}`).join(', ')}</span>
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
                          <span>{d.phone || 'No phone recorded'} • {d.orders.length} order{d.orders.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="debtor-actions">
                        <div className="balance-due">{money(d.balance)}</div>
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
                            <strong>{ord.items.map((it) => `${it.quantity} × ${it.description}`).join(', ')}</strong>
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
                            <span>Total: {money(ord.amount)} • Paid: {money(ord.paidAmount)}</span>
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
                  <span>Select any customer above, speak into mic, or type "Asha ka pichla order" to inspect exact past measurements, fabric, flavors, and specifications.</span>
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
                          <span>{o.items.map((it) => `${it.quantity} × ${it.description}`).join(', ')}</span>
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
