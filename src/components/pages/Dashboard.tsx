import { useMemo } from 'react';
import { Wallet, TrendingUp, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight, Receipt, FileText, Users } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useData } from '@/lib/data-context';
import { formatINR, formatDate } from '@/lib/calc';
import { invoiceStatusConfig, paymentMethodConfig } from '@/lib/status';
import { StatusBadge } from '@/components/shared';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { invoices, payments, clients, quotations, loading } = useData();

  const stats = useMemo(() => {
    const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const paidInvoices = invoices.filter((i) => i.status === 'paid').length;
    const pendingDues = invoices
      .filter((i) => i.status === 'sent' || i.status === 'pending' || i.status === 'overdue')
      .reduce((s, i) => {
        const paid = payments.filter((p) => p.invoice_id === i.id).reduce((a, p) => a + Number(p.amount), 0);
        return s + Math.max(0, Number(i.total) - paid);
      }, 0);
    const overdueAmount = invoices
      .filter((i) => i.status === 'overdue')
      .reduce((s, i) => {
        const paid = payments.filter((p) => p.invoice_id === i.id).reduce((a, p) => a + Number(p.amount), 0);
        return s + Math.max(0, Number(i.total) - paid);
      }, 0);
    return { totalRevenue, paidInvoices, pendingDues, overdueAmount };
  }, [invoices, payments]);

  const chartData = useMemo(() => {
    const months: { month: string; revenue: number; invoiced: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      const monthInv = invoices.filter((inv) => {
        const id = new Date(inv.issue_date);
        return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear();
      });
      const invoiced = monthInv.reduce((s, i) => s + Number(i.total), 0);
      const revenue = payments
        .filter((p) => {
          const pd = new Date(p.payment_date);
          return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
        })
        .reduce((s, p) => s + Number(p.amount), 0);
      months.push({ month: label, revenue, invoiced });
    }
    return months;
  }, [invoices, payments]);

  const recentActivity = useMemo(() => {
    const acts: { type: string; title: string; subtitle: string; date: string; amount?: number }[] = [];
    payments.slice(0, 4).forEach((p) => {
      const inv = invoices.find((i) => i.id === p.invoice_id);
      const client = clients.find((c) => c.id === p.client_id);
      acts.push({
        type: 'payment',
        title: `Payment received — ${inv?.invoice_number || ''}`,
        subtitle: client?.company_name || '',
        date: p.payment_date,
        amount: Number(p.amount),
      });
    });
    invoices.slice(0, 3).forEach((i) => {
      const client = clients.find((c) => c.id === i.client_id);
      acts.push({
        type: 'invoice',
        title: `Invoice ${i.invoice_number} created`,
        subtitle: client?.company_name || '',
        date: i.created_at,
        amount: Number(i.total),
      });
    });
    return acts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  }, [payments, invoices, clients]);

  const cards = [
    { label: 'Total Revenue', value: formatINR(stats.totalRevenue), icon: TrendingUp, color: 'from-emerald-500 to-green-600', trend: '+12.5%', up: true },
    { label: 'Pending Dues', value: formatINR(stats.pendingDues), icon: Wallet, color: 'from-amber-500 to-orange-600', trend: '3 invoices', up: false },
    { label: 'Paid Invoices', value: String(stats.paidInvoices), icon: CheckCircle2, color: 'from-blue-500 to-cyan-600', trend: `${invoices.length} total`, up: true },
    { label: 'Overdue Amount', value: formatINR(stats.overdueAmount), icon: AlertTriangle, color: 'from-red-500 to-rose-600', trend: 'Action needed', up: false },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="relative overflow-hidden rounded-xl border border-border bg-card p-5 animate-slide-up hover:shadow-lg transition-shadow"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{c.label}</p>
                  <p className="text-2xl font-bold mt-2 tracking-tight">{c.value}</p>
                </div>
                <div className={cn('flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br text-white shadow-lg', c.color)}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs">
                {c.up ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className={cn('font-medium', c.up ? 'text-emerald-500' : 'text-muted-foreground')}>{c.trend}</span>
                <span className="text-muted-foreground ml-1">vs last month</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Revenue Trend</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-chart-1" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-chart-3" />Invoiced</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }}
                formatter={(v: number) => formatINR(v)}
              />
              <Area type="monotone" dataKey="invoiced" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#invGrad)" />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 animate-slide-up">
          <h3 className="font-semibold mb-1">Invoice Status</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribution overview</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusBars(invoices)} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '12px' }} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="hsl(var(--chart-1))" barSize={22} />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <MiniStat icon={Users} label="Clients" value={clients.length} />
            <MiniStat icon={FileText} label="Quotes" value={quotations.length} />
            <MiniStat icon={Receipt} label="Invoices" value={invoices.length} />
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-border bg-card p-5 animate-slide-up">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No activity yet. Start by creating a client or invoice.</p>
        ) : (
          <div className="space-y-1">
            {recentActivity.map((act, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg shrink-0', act.type === 'payment' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400')}>
                  {act.type === 'payment' ? <Wallet className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{act.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{act.subtitle}</p>
                </div>
                <div className="text-right shrink-0">
                  {act.amount != null && <p className="text-sm font-semibold">{formatINR(act.amount)}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(act.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border border-border bg-card p-5 animate-slide-up">
        <h3 className="font-semibold mb-4">Recent Transactions</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No payments recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {payments.slice(0, 5).map((p) => {
              const inv = invoices.find((i) => i.id === p.invoice_id);
              const client = clients.find((c) => c.id === p.client_id);
              const cfg = paymentMethodConfig[p.payment_method as keyof typeof paymentMethodConfig] || { label: p.payment_method };
              return (
                <div key={p.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{client?.company_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{inv?.invoice_number} · {cfg.label}</p>
                  </div>
                  <StatusBadge label={p.status} className={p.status === 'full' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'} />
                  <p className="text-sm font-semibold shrink-0">{formatINR(Number(p.amount))}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function statusBars(invoices: { status: string }[]) {
  const order = ['draft', 'sent', 'paid', 'pending', 'overdue'];
  return order.map((s) => ({ name: invoiceStatusConfig[s as keyof typeof invoiceStatusConfig]?.label || s, count: invoices.filter((i) => i.status === s).length }));
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <Icon className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
