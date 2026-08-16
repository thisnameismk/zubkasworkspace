import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, FileText, Download, Calendar, BarChart3, PieChart as PieIcon, Percent } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useData } from '@/lib/data-context';
import { formatINR, formatDate, parseDateLocal } from '@/lib/calc';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type RangeKey = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export function Reports() {
  const { invoices, payments, transactions, incomeCategories, expenseCategories, clients } = useData();
  const [range, setRange] = useState<RangeKey>('monthly');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { start, end } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    if (range === 'custom') {
      return {
        start: fromDate ? parseDateLocal(fromDate) : new Date(0),
        end: toDate ? (() => { const e = parseDateLocal(toDate); e.setHours(23, 59, 59, 999); return e; })() : endOfDay,
      };
    }
    if (range === 'daily') {
      return { start: today, end: endOfDay };
    }
    if (range === 'weekly') {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: s, end: endOfDay };
    }
    if (range === 'monthly') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: s, end: endOfDay };
    }
    // yearly
    const s = new Date(today.getFullYear(), 0, 1);
    return { start: s, end: endOfDay };
  }, [range, fromDate, toDate]);

  const inRange = (d: string) => {
    const date = parseDateLocal(d);
    return date >= start && date <= end;
  };

  // Filter transactions
  const rangeTx = useMemo(() => transactions.filter((t) => inRange(t.transaction_date)), [transactions, start, end]);
  const rangePayments = useMemo(() => payments.filter((p) => inRange(p.payment_date)), [payments, start, end]);

  // Summary
  const totalIncome = rangeTx.filter((t) => t.type === 'income' && t.payment_status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = rangeTx.filter((t) => t.type === 'expense' && t.payment_status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Tax
  const taxCollected = rangePayments.reduce((s, p) => {
    const inv = invoices.find((i) => i.id === p.invoice_id);
    if (!inv) return s;
    const taxRate = Number(inv.cgst) + Number(inv.sgst) + Number(inv.igst);
    const invTotal = Number(inv.total);
    if (invTotal === 0) return s;
    const ratio = Number(p.amount) / invTotal;
    return s + taxRate * ratio;
  }, 0);
  const taxPaid = rangeTx.filter((t) => t.type === 'expense' && t.tax_included).reduce((s, t) => s + Number(t.tax_amount), 0);

  // Income vs Expense chart data
  const comparisonData = useMemo(() => {
    const buckets: Record<string, { period: string; sortKey: number; income: number; expense: number }> = {};
    rangeTx.forEach((t) => {
      const d = parseDateLocal(t.transaction_date);
      let key: string;
      if (range === 'daily' || range === 'weekly') {
        key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      } else if (range === 'yearly') {
        key = d.toLocaleDateString('en-IN', { month: 'short' });
      } else {
        key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      }
      if (!buckets[key]) buckets[key] = { period: key, sortKey: d.getTime(), income: 0, expense: 0 };
      if (t.payment_status === 'paid') {
        if (t.type === 'income') buckets[key].income += Number(t.amount);
        else buckets[key].expense += Number(t.amount);
      }
    });
    return Object.values(buckets).sort((a, b) => a.sortKey - b.sortKey);
  }, [rangeTx, range]);

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    rangeTx.filter((t) => t.type === 'expense' && t.payment_status === 'paid').forEach((t) => {
      const name = t.category_name || 'Uncategorized';
      map[name] = (map[name] || 0) + Number(t.amount);
    });
    return Object.entries(map).map(([name, value]) => {
      const cat = expenseCategories.find((c) => c.name === name);
      return { name, value, color: cat?.color || '#6b7280' };
    }).sort((a, b) => b.value - a.value);
  }, [rangeTx, expenseCategories]);

  // Revenue source breakdown
  const revenueSource = useMemo(() => {
    const invoiceIncome = rangeTx.filter((t) => t.is_auto_synced).reduce((s, t) => s + Number(t.amount), 0);
    const manualIncome = rangeTx.filter((t) => !t.is_auto_synced && t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    return [
      { name: 'Invoice Income', value: invoiceIncome, color: '#10b981' },
      { name: 'Manual Income', value: manualIncome, color: '#3b82f6' },
    ].filter((d) => d.value > 0);
  }, [rangeTx]);

  const summaryCards = [
    { label: 'Total Income', value: formatINR(totalIncome), icon: TrendingUp, color: 'from-emerald-500 to-green-600' },
    { label: 'Total Expense', value: formatINR(totalExpense), icon: TrendingDown, color: 'from-red-500 to-rose-600' },
    { label: 'Net Profit / Loss', value: formatINR(netProfit), icon: Wallet, color: netProfit >= 0 ? 'from-blue-500 to-cyan-600' : 'from-orange-500 to-red-600' },
    { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, icon: Percent, color: 'from-violet-500 to-purple-600' },
    { label: 'Tax Collected', value: formatINR(taxCollected), icon: FileText, color: 'from-teal-500 to-cyan-600' },
    { label: 'Tax Paid', value: formatINR(taxPaid), icon: FileText, color: 'from-amber-500 to-orange-600' },
  ];

  // Export CSV
  const exportCSV = () => {
    const rows = [
      ['Date', 'Type', 'Category', 'Description', 'Vendor/Client', 'Payment Method', 'Status', 'Amount', 'Tax Amount'],
      ...rangeTx.map((t) => {
        const client = clients.find((c) => c.id === t.client_id);
        return [
          t.transaction_date,
          t.type,
          t.category_name || '',
          t.description || '',
          t.vendor || client?.company_name || '',
          t.payment_method || '',
          t.payment_status,
          String(t.amount),
          String(t.tax_amount),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${start.toISOString().slice(0, 10)}-to-${end.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF (print-friendly)
  const exportPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const html = `
      <html><head><title>Financial Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1f2937; }
        h1 { color: #0ea5e9; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; }
        .period { color: #6b7280; margin-bottom: 20px; }
        .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
        .card .label { font-size: 12px; color: #6b7280; }
        .card .value { font-size: 20px; font-weight: bold; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f3f4f6; text-align: left; padding: 8px; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        .income { color: #059669; }
        .expense { color: #dc2626; }
      </style></head><body>
      <h1>Financial Report</h1>
      <p class="period">Period: ${formatDate(start.toISOString())} to ${formatDate(end.toISOString())}</p>
      <div class="cards">
        <div class="card"><div class="label">Total Income</div><div class="value income">${formatINR(totalIncome)}</div></div>
        <div class="card"><div class="label">Total Expense</div><div class="value expense">${formatINR(totalExpense)}</div></div>
        <div class="card"><div class="label">Net Profit/Loss</div><div class="value">${formatINR(netProfit)}</div></div>
        <div class="card"><div class="label">Profit Margin</div><div class="value">${profitMargin.toFixed(1)}%</div></div>
        <div class="card"><div class="label">Tax Collected</div><div class="value">${formatINR(taxCollected)}</div></div>
        <div class="card"><div class="label">Tax Paid</div><div class="value">${formatINR(taxPaid)}</div></div>
      </div>
      <h2>Transactions</h2>
      <table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>
      ${rangeTx.map((t) => `<tr><td>${formatDate(t.transaction_date)}</td><td class="${t.type}">${t.type}</td><td>${t.category_name || ''}</td><td>${t.description || ''}</td><td class="${t.type}">${t.type === 'income' ? '+' : '-'} ${formatINR(Number(t.amount))}</td></tr>`).join('')}
      </tbody></table>
      </body></html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const rangeLabel = `${formatDate(start.toISOString())} — ${formatDate(end.toISOString())}`;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Financial insights, analytics, and exportable reports"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4" /> CSV</Button>
            <Button variant="outline" onClick={exportPDF} className="gap-2"><Download className="w-4 h-4" /> PDF</Button>
          </div>
        }
      />

      {/* Date Range Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-3.5 py-2 rounded-lg text-sm font-medium border transition-all capitalize',
                range === r ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
              )}
            >
              {r === 'custom' ? <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Custom</span> : r}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex gap-2 items-center">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="max-w-[160px]" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="max-w-[160px]" />
          </div>
        )}
        <div className="text-sm text-muted-foreground flex items-center gap-1.5 sm:ml-auto">
          <Calendar className="w-4 h-4" /> {rangeLabel}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {summaryCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-5 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{c.label}</p>
                  <p className="text-2xl font-bold mt-2">{c.value}</p>
                </div>
                <div className={cn('flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br text-white shadow-lg', c.color)}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Income vs Expense Chart */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6 animate-slide-up">
        <h3 className="font-semibold mb-1 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Income vs Expense</h3>
        <p className="text-xs text-muted-foreground mb-4">{rangeLabel}</p>
        {comparisonData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={comparisonData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }} formatter={(v: number) => formatINR(v)} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-16">No data for selected range</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Expense Breakdown Pie */}
        <div className="rounded-xl border border-border bg-card p-5 animate-slide-up">
          <h3 className="font-semibold mb-1 flex items-center gap-2"><PieIcon className="w-4 h-4" /> Expense Breakdown by Category</h3>
          <p className="text-xs text-muted-foreground mb-4">{rangeLabel}</p>
          {expenseByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {expenseByCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }} formatter={(v: number) => formatINR(v)} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">No expense data</p>
          )}
        </div>

        {/* Revenue Source Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5 animate-slide-up">
          <h3 className="font-semibold mb-1 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Revenue Source Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">{rangeLabel}</p>
          {revenueSource.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={revenueSource} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {revenueSource.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }} formatter={(v: number) => formatINR(v)} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">No income data</p>
          )}
        </div>
      </div>

      {/* Income vs Expense Trend Line */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6 animate-slide-up">
        <h3 className="font-semibold mb-1">Income vs Expense Trend</h3>
        <p className="text-xs text-muted-foreground mb-4">{rangeLabel}</p>
        {comparisonData.length > 1 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={comparisonData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }} formatter={(v: number) => formatINR(v)} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-16">Not enough data points for trend</p>
        )}
      </div>

      {/* Transaction Summary Table */}
      <div className="rounded-xl border border-border bg-card p-5 animate-slide-up">
        <h3 className="font-semibold mb-4">Transaction Summary ({rangeTx.length} transactions)</h3>
        {rangeTx.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No transactions in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-left py-2 px-3 font-medium">Category</th>
                  <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Description</th>
                  <th className="text-right py-2 px-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rangeTx.slice(0, 20).map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                    <td className="py-2.5 px-3">
                      <span className={cn('text-xs font-medium', t.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                        {t.type === 'income' ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{t.category_name || '-'}</td>
                    <td className="py-2.5 px-3 text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{t.description || '-'}</td>
                    <td className={cn('py-2.5 px-3 text-right font-semibold', t.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                      {t.type === 'income' ? '+' : '-'} {formatINR(Number(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rangeTx.length > 20 && <p className="text-xs text-muted-foreground text-center mt-3">Showing 20 of {rangeTx.length} transactions. Export for full list.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
