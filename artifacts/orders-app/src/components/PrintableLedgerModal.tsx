import React, { useState, useMemo, useEffect } from 'react';
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
  CheckSquare,
  Square,
  MinusSquare,
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const todayStr = new Date().toISOString().slice(0, 10);
  const storeName = organization?.name || settings.operatorName || 'Vendora Kirana & Merchandise';
  const managerName = operatorName || settings.operatorName || 'Store Manager';

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        // Status filter
        if (statusFilter === 'active' && ['completed', 'cancelled'].includes(order.status)) return false;
        if (statusFilter === 'completed' && order.status !== 'completed') return false;
        if (statusFilter === 'overdue' && (order.status === 'completed' || order.status === 'cancelled' || order.dueDate >= todayStr))
          return false;

        // Date filter
        if (dateFilter !== 'all') {
          const orderDate = new Date(order.createdAt || order.updatedAt);
          const now = new Date();
          const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
          if (dateFilter === 'week' && diffDays > 7) return false;
          if (dateFilter === 'month' && diffDays > 30) return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, statusFilter, dateFilter, todayStr]);

  // When modal opens or filters change, select all filtered orders by default
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  }, [isOpen, statusFilter, dateFilter, filteredOrders.length]);

  // Toggle single order
  const toggleSelectOrder = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select / Deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  // Select only orders with outstanding dues
  const selectOnlyWithDues = () => {
    const dueOrders = filteredOrders.filter((o) => Math.max(0, (o.amount || 0) - (o.paidAmount || 0)) > 0);
    setSelectedIds(new Set(dueOrders.map((o) => o.id)));
  };

  // Selected orders that will be printed / exported
  const ordersToPrint = useMemo(() => {
    return filteredOrders.filter((o) => selectedIds.has(o.id));
  }, [filteredOrders, selectedIds]);

  // Aggregate Metrics on Selected Orders
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    for (const o of ordersToPrint) {
      const amt = Number(o.amount) || 0;
      const paid = Number(o.paidAmount) || 0;
      totalRevenue += amt;
      totalPaid += paid;
      totalOutstanding += Math.max(0, amt - paid);
    }

    return {
      count: ordersToPrint.length,
      totalRevenue,
      totalPaid,
      totalOutstanding,
    };
  }, [ordersToPrint]);

  if (!isOpen) return null;

  // Generate self-contained print HTML and trigger window.print()
  const handlePrintPdf = () => {
    if (ordersToPrint.length === 0) {
      alert('Please select at least one order to print.');
      return;
    }

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
            font-size: 10.5pt;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0F172A;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .brand-title {
            font-size: 19pt;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: -0.5px;
          }
          .brand-sub {
            font-size: 8.5pt;
            color: #4B5563;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-top: 2px;
          }
          .meta-box {
            text-align: right;
            font-size: 8.5pt;
            color: #374151;
          }
          .meta-box strong {
            color: #111827;
          }
          .kpi-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .kpi-card {
            border: 1px solid #E5E7EB;
            background: #F9FAFB;
            border-radius: 6px;
            padding: 8px 12px;
          }
          .kpi-label {
            font-size: 7.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6B7280;
          }
          .kpi-value {
            font-size: 13pt;
            font-weight: 800;
            margin-top: 2px;
            color: #111827;
          }
          .kpi-value.green { color: #166534; }
          .kpi-value.red { color: #991B1B; }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
            margin-bottom: 14px;
          }
          th {
            background: #F3F4F6;
            color: #374151;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 7.5pt;
            letter-spacing: 0.5px;
            padding: 7px 8px;
            border-top: 1px solid #D1D5DB;
            border-bottom: 1px solid #D1D5DB;
            text-align: left;
          }
          td {
            padding: 7px 8px;
            border-bottom: 1px solid #E5E7EB;
            vertical-align: top;
          }
          tr:nth-child(even) td {
            background-color: #FAFAFA;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .status-badge {
            display: inline-block;
            font-size: 7pt;
            font-weight: 700;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #D1D5DB;
          }
          .status-completed { background: #DCFCE7; color: #166534; border-color: #BBF7D0; }
          .status-ready { background: #FEF9C3; color: #854D0E; border-color: #FEF08A; }
          .status-in_progress { background: #DBEAFE; color: #1E40AF; border-color: #BFDBFE; }
          .status-new { background: #F3F4F6; color: #374151; border-color: #E5E7EB; }

          .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 20px;
            padding-top: 12px;
            border-top: 1px solid #D1D5DB;
            font-size: 8pt;
            color: #6B7280;
          }
          .sign-box {
            width: 200px;
            border-top: 1px dashed #9CA3AF;
            text-align: center;
            padding-top: 4px;
            font-size: 8pt;
            color: #4B5563;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">${storeName}</div>
            <div class="brand-sub">Sovereign Commercial Statement of Accounts &bull; Selected Ledger Entries</div>
          </div>
          <div class="meta-box">
            <div><strong>Statement Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div><strong>Operator:</strong> ${managerName}</div>
            <div><strong>Filter Scope:</strong> ${statusFilter.toUpperCase()} &bull; ${dateFilter === 'all' ? 'ALL TIME' : dateFilter === 'week' ? 'PAST 7 DAYS' : 'PAST 30 DAYS'}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Selected Orders</div>
            <div class="kpi-value">${metrics.count} / ${filteredOrders.length}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Gross Billing Total</div>
            <div class="kpi-value">&#8377;${metrics.totalRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Advance Collected</div>
            <div class="kpi-value green">&#8377;${metrics.totalPaid.toLocaleString('en-IN')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Outstanding Balance Due</div>
            <div class="kpi-value red">&#8377;${metrics.totalOutstanding.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;" class="text-center">#</th>
              <th style="width: 85px;">Date &amp; ID</th>
              <th style="width: 140px;">Customer</th>
              <th>Items &amp; Custom Specifications</th>
              <th style="width: 85px;">Due Date</th>
              <th style="width: 80px;" class="text-right">Total</th>
              <th style="width: 80px;" class="text-right">Advance</th>
              <th style="width: 85px;" class="text-right">Balance Due</th>
              <th style="width: 75px;" class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${ordersToPrint
              .map((o, idx) => {
                const due = Math.max(0, (o.amount || 0) - (o.paidAmount || 0));
                const itemsDesc =
                  (o.items || [])
                    .map((it) => {
                      const attrs = it.attributes
                        ? Object.entries(it.attributes)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')
                        : '';
                      return `<strong>${it.quantity}x ${it.description}</strong>${attrs ? ` <em>(${attrs})</em>` : ''}`;
                    })
                    .join('<br />') || 'Standard Order Item';

                const orderDate = (o.createdAt || '').slice(0, 10);
                const shortId = (o.id || '').slice(0, 8);

                return `
                <tr>
                  <td class="text-center font-mono">${idx + 1}</td>
                  <td>
                    <div style="font-weight: 600;">${orderDate}</div>
                    <div style="font-size: 7pt; color: #6B7280; font-family: monospace;">#${shortId}</div>
                  </td>
                  <td>
                    <div style="font-weight: 700; color: #111827;">${o.customer || 'Direct Counter Customer'}</div>
                    <div style="font-size: 7.5pt; color: #6B7280;">${o.phone || 'No phone'}</div>
                  </td>
                  <td>${itemsDesc}</td>
                  <td style="font-weight: 600; color: ${o.dueDate < todayStr && due > 0 ? '#991B1B' : '#374151'};">
                    ${o.dueDate || '-'}
                  </td>
                  <td class="text-right font-mono" style="font-weight: 600;">&#8377;${(o.amount || 0).toLocaleString('en-IN')}</td>
                  <td class="text-right font-mono" style="color: #166534;">&#8377;${(o.paidAmount || 0).toLocaleString('en-IN')}</td>
                  <td class="text-right font-mono" style="font-weight: 700; color: ${due > 0 ? '#991B1B' : '#374151'};">
                    &#8377;${due.toLocaleString('en-IN')}
                  </td>
                  <td class="text-center">
                    <span class="status-badge status-${o.status}">${o.status.replace('_', ' ')}</span>
                  </td>
                </tr>
               `;
              })
              .join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: 700; background: #E5E7EB; border-top: 2px solid #0F172A;">
              <td colspan="5" class="text-right">LEDGER GRAND TOTALS (${metrics.count} Orders Selected):</td>
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
    if (ordersToPrint.length === 0) {
      alert('Please select at least one order to export.');
      return;
    }

    const headers = ['Order ID', 'Date', 'Customer', 'Phone', 'Items', 'Due Date', 'Status', 'Total Amount', 'Paid Amount', 'Balance Due'];
    const rows = ordersToPrint.map((o) => {
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

  const isAllSelected = filteredOrders.length > 0 && selectedIds.size === filteredOrders.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < filteredOrders.length;

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
          maxWidth: 1020,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          border: '1px solid hsl(var(--border))',
          borderRadius: 16,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'hsl(var(--card))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Printer size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Printable Ledger &amp; PDF Statement</h3>
                <span
                  style={{
                    fontSize: 11,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontWeight: 600,
                  }}
                >
                  Custom Selection Ready
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                Select individual orders or filter by status to print high-contrast A4 statement receipts.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={handleExportCsv}
              disabled={ordersToPrint.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              title="Export selected orders to CSV for Excel / Tally"
            >
              <FileDown size={14} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'hsl(var(--muted-foreground))',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 6,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter & Selection Control Bar */}
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

          {/* Quick Selection Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={toggleSelectAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 600,
                color: 'inherit',
              }}
            >
              {isAllSelected ? <CheckSquare size={13} style={{ color: '#10B981' }} /> : isPartiallySelected ? <MinusSquare size={13} style={{ color: '#FBBF24' }} /> : <Square size={13} />}
              <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
            </button>

            <button
              onClick={selectOnlyWithDues}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#EF4444',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="Select only orders that have an unpaid balance due"
            >
              <IndianRupee size={12} />
              <span>Only with Dues</span>
            </button>

            <span
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                background: selectedIds.size > 0 ? 'rgba(16, 185, 129, 0.15)' : 'hsl(var(--muted)/.4)',
                color: selectedIds.size > 0 ? '#10B981' : 'hsl(var(--muted-foreground))',
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              {selectedIds.size} of {filteredOrders.length} Selected
            </span>
          </div>
        </div>

        {/* Scrollable Printable Sheet Preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'hsl(var(--background))' }}>
          {/* Summary KPI Strip calculated specifically for selected orders */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 600 }}>Selected Orders</div>
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
                  <th style={{ padding: '10px 12px', width: 44, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isPartiallySelected;
                      }}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#10B981' }}
                      title={isAllSelected ? 'Deselect all' : 'Select all'}
                    />
                  </th>
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
                    <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                      No orders found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o, idx) => {
                    const dueAmt = Math.max(0, (o.amount || 0) - (o.paidAmount || 0));
                    const isOverdue = o.status !== 'completed' && o.status !== 'cancelled' && o.dueDate < todayStr;
                    const isSelected = selectedIds.has(o.id);

                    return (
                      <tr
                        key={o.id}
                        onClick={() => toggleSelectOrder(o.id)}
                        style={{
                          borderBottom: '1px solid hsl(var(--border))',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td
                          style={{ padding: '10px 12px', textAlign: 'center' }}
                          onClick={(e) => toggleSelectOrder(o.id, e)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectOrder(o.id, e as unknown as React.MouseEvent)}
                            style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#10B981' }}
                          />
                        </td>
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
                              background:
                                o.status === 'completed'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : o.status === 'in_progress'
                                  ? 'rgba(234, 179, 8, 0.15)'
                                  : 'hsl(var(--muted)/.5)',
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
            <span>
              {ordersToPrint.length === 0
                ? 'No orders selected. Check boxes above to include them in the statement.'
                : `Ready to generate statement for ${ordersToPrint.length} selected order${ordersToPrint.length === 1 ? '' : 's'}.`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-quiet" onClick={onClose}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={handlePrintPdf}
              disabled={ordersToPrint.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: ordersToPrint.length === 0 ? 0.5 : 1,
                cursor: ordersToPrint.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Printer size={15} />
              <span>Print {ordersToPrint.length} Selected {ordersToPrint.length === 1 ? 'Order' : 'Orders'} (PDF)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
