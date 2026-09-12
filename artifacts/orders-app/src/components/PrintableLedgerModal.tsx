import React, { useState, useMemo } from 'react';
import { Order, OrderStatus } from '@/lib/storage/offlineDb';
import { Settings } from '@/lib/storage/offlineDb';
import {
  Printer,
  FileDown,
  X,
  Calendar,
  IndianRupee,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Filter,
} from 'lucide-react';

interface PrintableLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  settings: Settings;
  organization?: { name: string; slug: string } | null;
  operatorName?: string;
}

export function PrintableLedgerModal({
  isOpen,
  onClose,
  orders,
  settings,
  organization,
  operatorName,
}: PrintableLedgerModalProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month'>('all');

  const todayStr = new Date().toISOString().slice(0, 10);
  const storeName = organization?.name || settings.operatorName || 'Vendora Kirana & Merchandise';
  const managerName = operatorName || settings.operatorName || 'Store Manager';

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (statusFilter === 'active' && ['completed', 'cancelled'].includes(order.status)) return false;
      if (statusFilter === 'completed' && order.status !== 'completed') return false;
      if (statusFilter === 'overdue' && (order.status === 'completed' || order.status === 'cancelled' || order.dueDate >= todayStr)) return false;

      // Date filter
      if (dateFilter !== 'all') {
        const orderDate = new Date(order.createdAt || order.updatedAt);
        const now = new Date();
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
        if (dateFilter === 'week' && diffDays > 7) return false;
        if (dateFilter === 'month' && diffDays > 30) return false;
      }

      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, statusFilter, dateFilter, todayStr]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    for (const o of filteredOrders) {
      const amt = Number(o.amount) || 0;
      const paid = Number(o.paidAmount) || 0;
      totalRevenue += amt;
      totalPaid += paid;
      totalOutstanding += Math.max(0, amt - paid);
    }

    return {
      count: filteredOrders.length,
      totalRevenue,
      totalPaid,
      totalOutstanding,
    };
  }, [filteredOrders]);

  if (!isOpen) return null;

  // Generate self-contained print HTML and trigger window.print()
  const handlePrintPdf = () => {
    const printDocHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Vendora_Ledger_${todayStr}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            background: #FFFFFF;
            font-size: 11pt;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0F172A;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .brand-title {
            font-size: 20pt;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: -0.5px;
          }
          .brand-sub {
            font-size: 9pt;
            color: #4B5563;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-top: 2px;
          }
          .meta-box {
            text-align: right;
            font-size: 9pt;
            color: #374151;
          }
          .meta-box strong {
            color: #111827;
          }
          .kpi-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }
          .kpi-card {
            border: 1px solid #E5E7EB;
            background: #F9FAFB;
            border-radius: 6px;
            padding: 8px 12px;
          }
          .kpi-label {
            font-size: 8pt;
            text-transform: uppercase;
            color: #6B7280;
            font-weight: 600;
          }
          .kpi-val {
            font-size: 14pt;
            font-weight: 700;
            color: #111827;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
            margin-bottom: 16px;
          }
          th {
            background: #0F172A;
            color: #FFFFFF;
            font-weight: 600;
            text-align: left;
            padding: 8px 6px;
            font-size: 8.5pt;
            text-transform: uppercase;
          }
          td {
            padding: 7px 6px;
            border-bottom: 1px solid #E5E7EB;
            vertical-align: top;
          }
          tr:nth-child(even) td {
            background: #F9FAFB;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 7.5pt;
            font-weight: 700;
            text-transform: uppercase;
          }
          .badge-completed { background: #DCFCE7; color: #166534; }
          .badge-ready { background: #E0E7FF; color: #3730A3; }
          .badge-in_progress { background: #FEF3C7; color: #92400E; }
          .badge-new { background: #F3F4F6; color: #374151; }
          .badge-cancelled { background: #FEE2E2; color: #991B1B; }
          .footer-section {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 14px;
            border-top: 1px solid #E5E7EB;
            font-size: 8.5pt;
            color: #6B7280;
          }
          .sign-box {
            text-align: center;
            border-top: 1px dashed #9CA3AF;
            width: 200px;
            padding-top: 4px;
            font-weight: 600;
            color: #374151;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">${storeName}</div>
            <div class="brand-sub">Sovereign Store Ledger &bull; Statement of Accounts</div>
          </div>
          <div class="meta-box">
            <div>Doc Ref: <strong>VND-${Date.now().toString(36).toUpperCase()}</strong></div>
            <div>Generated: <strong>${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong></div>
            <div>Authorized Manager: <strong>${managerName}</strong></div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Total Orders Recorded</div>
            <div class="kpi-val">${metrics.count}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Gross Order Value</div>
            <div class="kpi-val">&#8377;${metrics.totalRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Advance Collected</div>
            <div class="kpi-val" style="color: #166534;">&#8377;${metrics.totalPaid.toLocaleString('en-IN')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Outstanding Balance</div>
            <div class="kpi-val" style="color: #991B1B;">&#8377;${metrics.totalOutstanding.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 28px;" class="text-center">#</th>
              <th style="width: 80px;">Date</th>
              <th style="width: 140px;">Customer</th>
              <th>Items &amp; Specifications</th>
              <th style="width: 85px;">Due Date</th>
              <th style="width: 75px;" class="text-right">Total</th>
              <th style="width: 75px;" class="text-right">Advance</th>
              <th style="width: 75px;" class="text-right">Due</th>
              <th style="width: 85px;" class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.map((o, idx) => {
              const dueAmt = Math.max(0, (o.amount || 0) - (o.paidAmount || 0));
              const itemsList = (o.items || [])
                .map((it) => {
                  const attrs = it.attributes && Object.keys(it.attributes).length > 0
                    ? ` (${Object.entries(it.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')})`
                    : '';
                  return `${it.quantity}x ${it.description}${attrs}`;
                })
                .join('; ');

              return `
                <tr>
                  <td class="text-center" style="font-weight: 600; color: #6B7280;">${idx + 1}</td>
                  <td>${new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td>
                    <strong>${o.customer || 'Customer'}</strong>
                    <div style="font-size: 7.5pt; color: #6B7280;">${o.phone || '-'}</div>
                  </td>
                  <td>${itemsList || 'Order items'}</td>
                  <td>${o.dueDate || '-'}</td>
                  <td class="text-right">&#8377;${(o.amount || 0).toLocaleString('en-IN')}</td>
                  <td class="text-right" style="color: #166534;">&#8377;${(o.paidAmount || 0).toLocaleString('en-IN')}</td>
                  <td class="text-right" style="font-weight: 700; color: ${dueAmt > 0 ? '#991B1B' : '#6B7280'};">&#8377;${dueAmt.toLocaleString('en-IN')}</td>
                  <td class="text-center">
                    <span class="badge badge-${o.status}">${o.status.replace('_', ' ')}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: 700; background: #E5E7EB; border-top: 2px solid #0F172A;">
              <td colspan="5" class="text-right">LEDGER GRAND TOTALS (${metrics.count} Orders):</td>
              <td class="text-right">&#8377;${metrics.totalRevenue.toLocaleString('en-IN')}</td>
              <td class="text-right" style="color: #166534;">&#8377;${metrics.totalPaid.toLocaleString('en-IN')}</td>
              <td class="text-right" style="color: #991B1B;">&#8377;${metrics.totalOutstanding.toLocaleString('en-IN')}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="footer-section">
          <div>
            <div><strong>Vendora Sovereign Offline Workbench</strong> &bull; End-to-end Local CRDT Verification</div>
            <div style="font-size: 7.5pt; color: #9CA3AF; margin-top: 2px;">This electronic ledger statement is generated offline from cryptographic local state. Valid without physical stamp under IT Act 2000.</div>
          </div>
          <div class="sign-box">
            Authorized Signatory / Seal
          </div>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printDocHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Order ID', 'Date', 'Customer', 'Phone', 'Items', 'Due Date', 'Status', 'Total Amount', 'Paid Amount', 'Balance Due'];
    const rows = filteredOrders.map((o) => {
      const itemsList = (o.items || []).map((it) => `${it.quantity}x ${it.description}`).join('; ');
      const due = Math.max(0, (o.amount || 0) - (o.paidAmount || 0));
      return [
        `"${o.id}"`,
        `"${o.createdAt.slice(0, 10)}"`,
        `"${(o.customer || '').replace(/"/g, '""')}"`,
        `"${o.phone || ''}"`,
        `"${itemsList.replace(/"/g, '""')}"`,
        `"${o.dueDate || ''}"`,
        `"${o.status}"`,
        o.amount || 0,
        o.paidAmount || 0,
        due,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Vendora_Ledger_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{
          maxWidth: 960,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          border: '1px solid hsl(var(--border))',
          borderRadius: 16,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', color: '#38BDF8' }}>
              <Printer size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Printable Ledger Statement</h2>
              <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                {storeName} &bull; Generated for {managerName}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn-quiet"
              onClick={handleExportCsv}
              title="Download Excel / CSV format"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <FileDown size={14} />
              <span>Export CSV</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={handlePrintPdf}
              title="Open Printable PDF / System Print Dialog"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>
            <button
              className="icon-btn"
              onClick={onClose}
              style={{ width: 32, height: 32 }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid hsl(var(--border))',
            background: 'hsl(var(--muted)/.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'hsl(var(--muted-foreground))' }}>
              <Filter size={13} /> Filter:
            </span>

            {/* Status Pills */}
            <div style={{ display: 'flex', background: 'hsl(var(--card))', borderRadius: 8, padding: 2, border: '1px solid hsl(var(--border))' }}>
              {(['all', 'active', 'completed', 'overdue'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: statusFilter === s ? 700 : 500,
                    background: statusFilter === s ? 'hsl(var(--primary))' : 'transparent',
                    color: statusFilter === s ? '#FFFFFF' : 'inherit',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Date Pills */}
            <div style={{ display: 'flex', background: 'hsl(var(--card))', borderRadius: 8, padding: 2, border: '1px solid hsl(var(--border))' }}>
              {(['all', 'week', 'month'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: dateFilter === d ? 700 : 500,
                    background: dateFilter === d ? 'hsl(var(--primary))' : 'transparent',
                    color: dateFilter === d ? '#FFFFFF' : 'inherit',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {d === 'all' ? 'All Time' : d === 'week' ? 'Past 7 Days' : 'Past 30 Days'}
                </button>
              ))}
            </div>
          </div>

          <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
            Showing <strong>{metrics.count}</strong> ledger entries
          </span>
        </div>

        {/* Scrollable Printable Sheet Preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'hsl(var(--background))' }}>
          {/* Summary KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 600 }}>Total Orders</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{metrics.count}</div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 600 }}>Gross Value</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>&#8377;{metrics.totalRevenue.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div style={{ fontSize: 11, color: '#10B981', textTransform: 'uppercase', fontWeight: 600 }}>Advance Paid</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2, color: '#10B981' }}>&#8377;{metrics.totalPaid.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div style={{ fontSize: 11, color: '#EF4444', textTransform: 'uppercase', fontWeight: 600 }}>Balance Due</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2, color: '#EF4444' }}>&#8377;{metrics.totalOutstanding.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Ledger Table Preview */}
          <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
              <thead style={{ background: 'hsl(var(--muted)/.4)', borderBottom: '1px solid hsl(var(--border))' }}>
                <tr>
                  <th style={{ padding: '10px 12px', width: 36, textAlign: 'center' }}>#</th>
                  <th style={{ padding: '10px 12px' }}>Customer</th>
                  <th style={{ padding: '10px 12px' }}>Items</th>
                  <th style={{ padding: '10px 12px', width: 100 }}>Due Date</th>
                  <th style={{ padding: '10px 12px', width: 90, textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '10px 12px', width: 90, textAlign: 'right' }}>Paid</th>
                  <th style={{ padding: '10px 12px', width: 90, textAlign: 'right' }}>Due</th>
                  <th style={{ padding: '10px 12px', width: 100, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                      No orders found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o, idx) => {
                    const dueAmt = Math.max(0, (o.amount || 0) - (o.paidAmount || 0));
                    const isOverdue = o.status !== 'completed' && o.status !== 'cancelled' && o.dueDate < todayStr;
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <strong style={{ display: 'block' }}>{o.customer || 'Unnamed'}</strong>
                          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{o.phone || '-'}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {(o.items || []).map((it) => `${it.quantity}x ${it.description}`).join(', ') || 'No item detail'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ color: isOverdue ? '#EF4444' : 'inherit', fontWeight: isOverdue ? 700 : 400 }}>
                            {o.dueDate || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>&#8377;{(o.amount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10B981' }}>&#8377;{(o.paidAmount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: dueAmt > 0 ? '#EF4444' : 'inherit' }}>
                          &#8377;{dueAmt.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: o.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : o.status === 'in_progress' ? 'rgba(234, 179, 8, 0.15)' : 'hsl(var(--muted)/.5)',
                              color: o.status === 'completed' ? '#10B981' : o.status === 'in_progress' ? '#FBBF24' : 'inherit',
                            }}
                          >
                            {o.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
            <FileText size={14} />
            <span>Landscape A4 Vector PDF with auto-computed balances and totals.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-quiet" onClick={onClose}>
              Close
            </button>
            <button className="btn btn-primary" onClick={handlePrintPdf} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Printer size={15} />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
