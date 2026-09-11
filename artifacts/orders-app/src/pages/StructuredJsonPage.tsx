import { useState, useRef } from 'react';
import {
  Upload, FileJson, Download, Copy, Check, RefreshCw, AlertTriangle, Search, CheckCircle2,
  Sparkles, Layers, Cpu, ArrowRight, Play, Eye, FileCode2, Database
} from 'lucide-react';
import { parseOrderHybrid, HybridParseResult, AVAILABLE_MODELS, getActiveModelId } from '@/lib/parser/hybridParser';
import { parseUniversalMessage, StandardParsedOrder } from '@/lib/parser/universalParser';
import { Order } from '@/lib/storage/offlineDb';

interface BatchItemResult extends StandardParsedOrder {
  id: string;
  rawMessage: string;
  _source: 'online_ai' | 'offline_nlp';
  _speedMs: number;
}

const SAMPLE_TEST_BATCH = [
  'bhaiya main Ramesh. 2 kurta navy blue, chest 40, parso chahiye. total ₹1850, 500 advance diya pichli baar jaisa.',
  'main Priya bol rahi hu. Kal dopahar 1 baje 3 veg lunch thali chahiye. 720 rupaye bhej diye.',
  '1kg chocolate cake with eggless base, write Happy Birthday Aryan, 15th ko chahiye. 1200 rs',
  'uncle switchboard mein sparking ho rahi hai hall mein, kal subah aakar check kardo. - Vikram',
  '2 linen shirts white color, size 42, agle mangalwar tak ready chahiye. ₹2400 bill bana do - Ankit Sharma',
  'Asha didi bol rahi hu. 5 box kaju katli aur 2kg gulab jamun Sunday delivery. advance 1000 transfer kar diya',
  'bhaiya ceiling fan ka regulator change karna hai master bedroom mein. kal sham ko time milega kya? - Suresh',
  'hi bhaiya please call back immediately',
  '3 cotton salwar suit stitching with lining, red and golden, 10 tarikh tak urgently. 3200 total - Sunita Verma',
  'Daily tiffin service start kardo Monday se. Only dinner veg, 1 month plan ₹3500. Rahul Jain here.'
];

export function StructuredJsonPage({
  onSaveOrder,
  onNotify,
}: {
  onSaveOrder: (order: Partial<Order>) => void;
  onNotify: (msg: string) => void;
}) {
  const [items, setItems] = useState<BatchItemResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedEngine, setSelectedEngine] = useState<'hybrid' | 'offline'>('hybrid');
  const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<boolean>(false);

  const extractMessagesFromFile = (rawContent: string): string[] => {
    // Remove BOM and clean whitespace
    const clean = rawContent.replace(/^\uFEFF/, '').trim();
    try {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) {
        return parsed.map((it) => {
          if (typeof it === 'string') return it.trim();
          if (typeof it === 'object' && it !== null) {
            return (
              (it as Record<string, unknown>).message ||
              (it as Record<string, unknown>).rawMessage ||
              (it as Record<string, unknown>).text ||
              (it as Record<string, unknown>).msg ||
              (it as Record<string, unknown>).content ||
              JSON.stringify(it)
            );
          }
          return String(it);
        }).filter(Boolean);
      }
      if (typeof parsed === 'object' && parsed !== null) {
        const candidateList =
          parsed.messages ||
          parsed.orders ||
          parsed.data ||
          parsed.records ||
          parsed.items ||
          Object.values(parsed);
        if (Array.isArray(candidateList)) {
          return candidateList.map((it) => {
            if (typeof it === 'string') return it.trim();
            if (typeof it === 'object' && it !== null) {
              return (
                (it as Record<string, unknown>).message ||
                (it as Record<string, unknown>).rawMessage ||
                (it as Record<string, unknown>).text ||
                JSON.stringify(it)
              );
            }
            return String(it);
          }).filter(Boolean);
        }
      }
    } catch {
      // If not strict JSON, try newline-separated text
      return clean.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 2);
    }
    return [];
  };

  const processMessagesBatch = async (messages: string[]) => {
    if (!messages.length) {
      onNotify('No valid text messages found in file');
      return;
    }

    setIsProcessing(true);
    abortControllerRef.current = false;
    setProgress({ current: 0, total: messages.length });

    const results: BatchItemResult[] = [];
    const activeModelId = getActiveModelId();

    for (let i = 0; i < messages.length; i++) {
      if (abortControllerRef.current) {
        onNotify('Batch processing stopped');
        break;
      }

      const msg = messages[i];
      const start = Date.now();

      try {
        let parsed: StandardParsedOrder;
        let source: 'online_ai' | 'offline_nlp' = 'offline_nlp';

        if (selectedEngine === 'hybrid') {
          const res = await parseOrderHybrid(msg, { modelId: activeModelId });
          parsed = res;
          source = res._source;
        } else {
          parsed = parseUniversalMessage(msg);
          source = 'offline_nlp';
        }

        results.push({
          id: `batch-${i + 1}`,
          rawMessage: msg,
          customer: parsed.customer,
          items: parsed.items,
          due_date: parsed.due_date,
          amount: parsed.amount,
          references_prior_order: parsed.references_prior_order,
          confidence: parsed.confidence,
          needs_clarification: parsed.needs_clarification,
          _source: source,
          _speedMs: Date.now() - start,
        });
      } catch (err) {
        console.warn(`Failed to parse batch item #${i + 1}:`, err);
        const fallback = parseUniversalMessage(msg);
        results.push({
          id: `batch-${i + 1}`,
          rawMessage: msg,
          ...fallback,
          _source: 'offline_nlp',
          _speedMs: Date.now() - start,
        });
      }

      setProgress({ current: i + 1, total: messages.length });
      // Update UI progressively every 3 items
      if (i % 3 === 0 || i === messages.length - 1) {
        setItems([...results]);
      }
    }

    setItems(results);
    setIsProcessing(false);
    onNotify(`Successfully parsed ${results.length} orders into structured JSON!`);
  };

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    file.text().then((text) => {
      const msgs = extractMessagesFromFile(text);
      if (msgs.length === 0) {
        onNotify('Could not detect any message strings in the file. Please check JSON format.');
        return;
      }
      processMessagesBatch(msgs);
    }).catch((err) => {
      console.error(err);
      onNotify('Error reading file: ' + (err instanceof Error ? err.message : 'Unknown error'));
    });
  };

  const handleLoadSampleBatch = () => {
    setFileName('sample_test_batch_10.json');
    processMessagesBatch(SAMPLE_TEST_BATCH);
  };

  const getCleanJsonOutput = (): string => {
    const cleanOutput = items.map((it) => ({
      customer: it.customer,
      items: it.items,
      due_date: it.due_date,
      amount: it.amount,
      references_prior_order: it.references_prior_order,
      confidence: it.confidence,
      needs_clarification: it.needs_clarification,
    }));
    return JSON.stringify(cleanOutput, null, 2);
  };

  const handleDownloadOutputJson = () => {
    if (!items.length) return;
    const jsonStr = getCleanJsonOutput();
    const outName = fileName ? `clean-${fileName.replace(/\.[^/.]+$/, '')}-output.json` : 'janvyapar-structured-orders.json';
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Downloaded clean structured JSON: ${outName}`);
  };

  const handleCopyOutputJson = () => {
    if (!items.length) return;
    navigator.clipboard.writeText(getCleanJsonOutput());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onNotify('Clean structured JSON copied to clipboard!');
  };

  const handleCommitAllToLedger = () => {
    if (!items.length) return;
    let savedCount = 0;
    items.forEach((it) => {
      if (!it.needs_clarification || it.items?.length > 0) {
        onSaveOrder({
          customer: it.customer || 'Unnamed Customer',
          phone: '',
          items: it.items,
          dueDate: it.due_date || new Date().toISOString().slice(0, 10),
          amount: it.amount || 0,
          paidAmount: 0,
          status: 'new',
          referencesPriorOrder: it.references_prior_order,
          confidence: it.confidence,
          needsClarification: it.needs_clarification,
          rawMessage: it.rawMessage,
        });
        savedCount++;
      }
    });
    onNotify(`Committed ${savedCount} structured orders to your sovereign ledger!`);
  };

  const filteredItems = items.filter((it) => {
    const q = searchQuery.toLowerCase();
    return (
      (it.customer && it.customer.toLowerCase().includes(q)) ||
      it.rawMessage.toLowerCase().includes(q) ||
      it.items.some((i) => i.description.toLowerCase().includes(q))
    );
  });

  const totalProcessed = items.length;
  const avgConfidence = totalProcessed > 0 ? Math.round((items.reduce((s, i) => s + i.confidence, 0) / totalProcessed) * 100) : 0;
  const clarificationFlags = items.filter((i) => i.needs_clarification).length;
  const totalExtractedRevenue = items.reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">High-Throughput Transformation</div>
          <h1>Structured JSON File Processor</h1>
          <p className="subheading">
            Import raw multi-lingual customer messages (.json or .txt) and instantly generate clean, standardized output conforming strictly to <code>schema.json</code>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 2 }}>
            <button
              className={`btn ${selectedEngine === 'hybrid' ? 'btn-primary' : 'btn-quiet'}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setSelectedEngine('hybrid')}
            >
              <Sparkles size={13} /> Online AI (Gemini)
            </button>
            <button
              className={`btn ${selectedEngine === 'offline' ? 'btn-primary' : 'btn-quiet'}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setSelectedEngine('offline')}
            >
              <Cpu size={13} /> Local Sub-ms NLP
            </button>
          </div>
        </div>
      </div>

      {/* Big Drag-and-Drop File Import Button */}
      <div
        className="panel"
        style={{
          border: '2px dashed hsl(var(--border))',
          borderRadius: 16,
          padding: '36px 24px',
          textAlign: 'center',
          background: 'hsl(var(--card)/.5)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          marginBottom: 24,
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'hsl(var(--primary))'; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = 'hsl(var(--border))'; }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = 'hsl(var(--border))';
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileUpload(file);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".json,.txt,.jsonl,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'hsl(var(--primary)/.15)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isProcessing ? <RefreshCw className="spin" size={32} /> : <FileJson size={32} />}
          </div>

          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: 20 }}>
              {isProcessing
                ? `Processing File: ${progress.current} of ${progress.total} messages...`
                : 'Click to Import Messages JSON File or Drag & Drop'}
            </h2>
            <p className="minor" style={{ margin: 0 }}>
              Supports array of strings <code>["msg1", "msg2"]</code>, objects <code>[&#123;"message": "..."&#125;]</code>, or nested batch formats.
            </p>
          </div>

          {isProcessing ? (
            <div style={{ width: '100%', maxWidth: 420, marginTop: 12 }}>
              <div className="meter" style={{ height: 8 }}>
                <span style={{ width: `${Math.round((progress.current / (progress.total || 1)) * 100)}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6, color: 'hsl(var(--muted-foreground))' }}>
                <span>Parsing with {selectedEngine === 'hybrid' ? 'Gemini 3.6 Flash' : 'Local NLP'}</span>
                <span>{Math.round((progress.current / (progress.total || 1)) * 100)}% Complete</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              <button
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: 14 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} /> Choose JSON File to Import
              </button>
              <button
                className="btn btn-quiet"
                style={{ padding: '10px 18px', fontSize: 14 }}
                onClick={handleLoadSampleBatch}
              >
                <Play size={14} /> Try Sample 10-Message Batch
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Batch Stats KPI Hub */}
      {items.length > 0 && (
        <>
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card featured">
              <div className="stat-label">Total Messages Processed</div>
              <div className="stat-value">{totalProcessed}</div>
              <div className="stat-meta">{fileName || 'Direct Ingestion'}</div>
              <FileCode2 className="stat-icon" size={48} />
            </div>

            <div className="stat-card">
              <div className="stat-label">Mean Confidence</div>
              <div className="stat-value">{avgConfidence}%</div>
              <div className="stat-meta">Calibrated schema compliance</div>
              <CheckCircle2 className="stat-icon" size={48} />
            </div>

            <div className="stat-card">
              <div className="stat-label">Clarifications Flagged</div>
              <div className="stat-value">{clarificationFlags}</div>
              <div className="stat-meta">{totalProcessed - clarificationFlags} high-confidence orders</div>
              <AlertTriangle className="stat-icon" size={48} />
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Extracted Revenue</div>
              <div className="stat-value">₹{totalExtractedRevenue.toLocaleString('en-IN')}</div>
              <div className="stat-meta">Across all parsed items</div>
              <Layers className="stat-icon" size={48} />
            </div>
          </div>

          {/* Action Hub & Output Tabs */}
          <section className="panel" style={{ marginBottom: 28 }}>
            <div className="panel-head" style={{ flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', background: 'hsl(var(--muted)/.4)', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 2 }}>
                  <button
                    className={`btn ${activeTab === 'preview' ? 'btn-primary' : 'btn-quiet'}`}
                    style={{ padding: '6px 14px', fontSize: 12 }}
                    onClick={() => setActiveTab('preview')}
                  >
                    <Eye size={14} /> Interactive Preview Table
                  </button>
                  <button
                    className={`btn ${activeTab === 'json' ? 'btn-primary' : 'btn-quiet'}`}
                    style={{ padding: '6px 14px', fontSize: 12 }}
                    onClick={() => setActiveTab('json')}
                  >
                    <FileCode2 size={14} /> Clean schema.json Code ({items.length})
                  </button>
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleDownloadOutputJson}
                  style={{ padding: '8px 16px' }}
                >
                  <Download size={15} /> Download Clean JSON File
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleCopyOutputJson}
                  style={{ padding: '8px 14px' }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied!' : 'Copy JSON'}
                </button>
                <button
                  className="btn btn-quiet"
                  onClick={handleCommitAllToLedger}
                  style={{ padding: '8px 14px' }}
                  title="Add all parsed orders to the sovereign local database"
                >
                  <Database size={15} /> Commit All to Ledger
                </button>
              </div>
            </div>

            {/* TAB 1: Interactive Table Preview */}
            {activeTab === 'preview' && (
              <div style={{ padding: '0 22px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                  <div className="input-wrap" style={{ flex: 1, maxWidth: 380 }}>
                    <Search />
                    <input
                      className="input"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search customer, item, or raw text..."
                    />
                  </div>
                  <span className="minor" style={{ font: '11px var(--app-font-mono)' }}>
                    Showing {filteredItems.length} of {items.length} records
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))', fontSize: 11, textTransform: 'uppercase', font: '11px var(--app-font-mono)' }}>
                        <th style={{ padding: '10px 12px' }}>#</th>
                        <th style={{ padding: '10px 12px' }}>Customer</th>
                        <th style={{ padding: '10px 12px' }}>Items & Attributes</th>
                        <th style={{ padding: '10px 12px' }}>Due Date</th>
                        <th style={{ padding: '10px 12px' }}>Amount</th>
                        <th style={{ padding: '10px 12px' }}>Repeat</th>
                        <th style={{ padding: '10px 12px' }}>Confidence</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((it, idx) => (
                        <tr key={it.id} style={{ borderBottom: '1px solid hsl(var(--border)/.4)' }}>
                          <td style={{ padding: '12px 12px', font: '11px var(--app-font-mono)', color: 'hsl(var(--muted-foreground))' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <strong>{it.customer || '—'}</strong>
                          </td>
                          <td style={{ padding: '12px 12px', maxWidth: 260 }}>
                            {it.items?.map((item, i) => (
                              <div key={i} style={{ fontSize: 12 }}>
                                <strong>{item.quantity} × {item.description}</strong>
                                {Object.keys(item.attributes || {}).length > 0 && (
                                  <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                                    {Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </td>
                          <td style={{ padding: '12px 12px', font: '11px var(--app-font-mono)' }}>
                            {it.due_date || '—'}
                          </td>
                          <td style={{ padding: '12px 12px', fontWeight: 600 }}>
                            {it.amount !== null ? `₹${it.amount.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            {it.references_prior_order ? '✅ Repeat' : '—'}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <span className="badge-source-ai" style={{ fontSize: 10, padding: '2px 6px' }}>
                              {Math.round(it.confidence * 100)}%
                            </span>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            {it.needs_clarification ? (
                              <span className="badge-source-local" style={{ background: 'hsl(var(--destructive)/.2)', color: 'hsl(var(--destructive))', fontSize: 10, padding: '2px 6px' }}>
                                ⚠️ Needs Clarification
                              </span>
                            ) : (
                              <span className="badge-source-ai" style={{ fontSize: 10, padding: '2px 6px' }}>
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Clean Formatted JSON Contract Codeblock */}
            {activeTab === 'json' && (
              <div style={{ padding: '0 22px 22px' }}>
                <pre className="json-box" style={{ maxHeight: 520, fontSize: 12 }}>
                  {getCleanJsonOutput()}
                </pre>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
