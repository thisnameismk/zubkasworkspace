import { useState, useMemo, useRef } from 'react';
import { Repeat, Plus, Trash2, Pencil, Wallet, TrendingUp, CalendarClock, TriangleAlert as AlertTriangle, Download, X, Check, RefreshCw, Ban, Tag, Loader as Loader2 } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDate } from '@/lib/calc';
import { downloadElementAsPDF } from '@/lib/pdf';
import { syncSubscriptionPayment, computeNextRenewalDate } from '@/lib/subscription-sync';
import { subscriptionStatusConfig } from '@/lib/status';
import { useAccent } from '@/components/doc-layout';
import type { Subscription, SubscriptionCategory, BillingCycle, SubscriptionStatus, PaymentMethod } from '@/lib/types';
import { PageHeader, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function Subscriptions() {
  const { subscriptions, subscriptionCategories, clients, refresh } = useData();
  const { toast } = useToast();
  const [tab, setTab] = useState('subscriptions');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [paymentSub, setPaymentSub] = useState<Subscription | null>(null);
  const [receiptSub, setReceiptSub] = useState<{ sub: Subscription; receiptNo: string; amount: number; date: string; method: string } | null>(null);
  const [cancelSub, setCancelSub] = useState<Subscription | null>(null);

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'Active');
    const overdue = subscriptions.filter((s) => s.status === 'Overdue');
    const now = new Date();
    const renewalsThisMonth = subscriptions.filter((s) => {
      if (s.status === 'Cancelled') return false;
      const rd = new Date(s.renewal_date);
      return rd.getMonth() === now.getMonth() && rd.getFullYear() === now.getFullYear();
    });
    const mrr = active
      .filter((s) => s.billing_cycle === 'Monthly')
      .reduce((sum, s) => sum + Number(s.total_amount), 0)
      + active.filter((s) => s.billing_cycle === 'Quarterly').reduce((sum, s) => sum + Number(s.total_amount) / 3, 0)
      + active.filter((s) => s.billing_cycle === 'Half-Yearly').reduce((sum, s) => sum + Number(s.total_amount) / 6, 0)
      + active.filter((s) => s.billing_cycle === 'Yearly').reduce((sum, s) => sum + Number(s.total_amount) / 12, 0);
    return { activeCount: active.length, mrr, renewalsDue: renewalsThisMonth.length, overdueCount: overdue.length };
  }, [subscriptions]);

  const filtered = useMemo(() => {
    return subscriptions.filter((s) => {
      const matchesSearch = !search ||
        s.plan_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.client_name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, search, statusFilter]);

  const renew = async (sub: Subscription) => {
    const newRenewal = computeNextRenewalDate(sub.renewal_date, sub.billing_cycle);
    const { error } = await supabase
      .from('subscriptions')
      .update({ renewal_date: newRenewal, status: 'Active' })
      .eq('id', sub.id);
    if (error) {
      toast({ title: 'Failed to renew', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Subscription renewed', description: `Next renewal: ${formatDate(newRenewal)}` });
      refresh();
    }
  };

  const confirmCancel = async () => {
    if (!cancelSub) return;
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'Cancelled' })
      .eq('id', cancelSub.id);
    if (error) {
      toast({ title: 'Failed to cancel', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Subscription cancelled' });
      refresh();
    }
    setCancelSub(null);
  };

  const cards = [
    { label: 'Active Subscriptions', value: String(stats.activeCount), icon: Repeat, color: 'from-primary to-primary/70' },
    { label: 'Monthly Recurring Revenue', value: formatINR(stats.mrr), icon: TrendingUp, color: 'from-emerald-500 to-green-600' },
    { label: 'Renewals Due This Month', value: String(stats.renewalsDue), icon: CalendarClock, color: 'from-amber-500 to-orange-600' },
    { label: 'Overdue Subscriptions', value: String(stats.overdueCount), icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
  ];

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Manage recurring billing, track MRR, and record subscription payments"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTab('categories')} className="gap-2">
              <Tag className="w-4 h-4" /> Categories
            </Button>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-5 animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{c.label}</p>
                  <p className="text-2xl font-bold mt-2 tracking-tight">{c.value}</p>
                </div>
                <div className={cn('flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br text-white shadow-lg', c.color)}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="subscriptions" className="gap-1.5"><Repeat className="w-4 h-4" /> Subscriptions</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Tag className="w-4 h-4" /> Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Input placeholder="Search by plan or client..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Repeat className="w-8 h-8" />}
              title="No subscriptions yet"
              description="Create a subscription-type quotation to add recurring billing entries."
            />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden animate-slide-up">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Client</th>
                      <th className="text-left py-3 px-4 font-medium">Plan / Category</th>
                      <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Billing Cycle</th>
                      <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Total</th>
                      <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Start Date</th>
                      <th className="text-left py-3 px-4 font-medium">Renewal Date</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const cat = subscriptionCategories.find((c) => c.id === s.category_id);
                      const cfg = subscriptionStatusConfig[s.status];
                      return (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium">{s.client_name || clients.find((c) => c.id === s.client_id)?.company_name || '-'}</td>
                          <td className="py-3 px-4">
                            <p className="font-medium">{s.plan_name}</p>
                            {cat && <p className="text-xs text-muted-foreground">{cat.name}</p>}
                          </td>
                          <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{s.billing_cycle}</td>
                          <td className="py-3 px-4 hidden sm:table-cell text-right font-semibold">{formatINR(Number(s.total_amount))}</td>
                          <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">{formatDate(s.start_date)}</td>
                          <td className="py-3 px-4 text-muted-foreground">{formatDate(s.renewal_date)}</td>
                          <td className="py-3 px-4"><StatusBadge label={cfg.label} className={cfg.className} dot={cfg.dot} /></td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {s.status !== 'Cancelled' && (
                                <>
                                  <button onClick={() => setPaymentSub(s)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Record Payment">
                                    <Wallet className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => renew(s)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Renew">
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setEditSub(s)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setCancelSub(s)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Cancel">
                                    <Ban className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>
      </Tabs>

      {editSub && <EditSubscriptionDialog subscription={editSub} onClose={() => { setEditSub(null); refresh(); }} />}
      {paymentSub && (
        <RecordPaymentDialog
          subscription={paymentSub}
          onClose={() => { setPaymentSub(null); refresh(); }}
          onReceiptGenerated={(info) => setReceiptSub(info)}
        />
      )}
      {receiptSub && <ReceiptDialog data={receiptSub} onClose={() => setReceiptSub(null)} />}
      {cancelSub && (
        <Dialog open onOpenChange={(v) => !v && setCancelSub(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Cancel Subscription</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground py-3">
              Are you sure you want to cancel <span className="font-medium text-foreground">{cancelSub.plan_name}</span> for {cancelSub.client_name}? This will stop future renewals.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCancelSub(null)}>Keep Active</Button>
              <Button variant="destructive" onClick={confirmCancel} className="gap-2"><Ban className="w-4 h-4" /> Cancel Subscription</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===================== Category Manager =====================

function CategoryManager() {
  const { subscriptionCategories, refresh } = useData();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    if (editingId) {
      const { error } = await supabase.from('subscription_categories').update({ name: name.trim(), description: description || null }).eq('id', editingId);
      if (error) { toast({ title: 'Failed to update', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Category updated' });
    } else {
      const { error } = await supabase.from('subscription_categories').insert({ name: name.trim(), description: description || null });
      if (error) { toast({ title: 'Failed to add', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Category added' });
    }
    setName('');
    setDescription('');
    setEditingId(null);
    refresh();
  };

  const edit = (cat: SubscriptionCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('subscription_categories').delete().eq('id', id);
    if (error) { toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Category deleted' });
    refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 rounded-xl border border-border bg-card p-5 animate-slide-up">
        <h3 className="font-semibold mb-4">{editingId ? 'Edit Category' : 'Add Category'}</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hosting, Maintenance..." className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." className="mt-1 min-h-[60px]" />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="gap-2 flex-1">
              {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Update' : 'Add Category'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={() => { setEditingId(null); setName(''); setDescription(''); }}>Cancel</Button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 animate-slide-up">
        <h3 className="font-semibold mb-4">Categories ({subscriptionCategories.length})</h3>
        {subscriptionCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No categories yet. Add one to get started.</p>
        ) : (
          <div className="space-y-2">
            {subscriptionCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-sm font-medium">{cat.name}</p>
                  {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => edit(cat)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(cat.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== Edit Subscription Dialog =====================

function EditSubscriptionDialog({ subscription, onClose }: { subscription: Subscription; onClose: () => void }) {
  const { subscriptionCategories } = useData();
  const { toast } = useToast();
  const [planName, setPlanName] = useState(subscription.plan_name);
  const [categoryId, setCategoryId] = useState(subscription.category_id || '');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(subscription.billing_cycle);
  const [amount, setAmount] = useState(String(subscription.amount));
  const [startDate, setStartDate] = useState(subscription.start_date);
  const [endDate, setEndDate] = useState(subscription.end_date || '');
  const [renewalDate, setRenewalDate] = useState(subscription.renewal_date);
  const [status, setStatus] = useState<SubscriptionStatus>(subscription.status);

  const save = async () => {
    if (!planName.trim()) { toast({ title: 'Plan name is required', variant: 'destructive' }); return; }
    const taxAmount = Number(amount) * 0.18;
    const totalAmount = Number(amount) + taxAmount;
    const { error } = await supabase.from('subscriptions').update({
      plan_name: planName.trim(),
      category_id: categoryId || null,
      billing_cycle: billingCycle,
      amount: Number(amount) || 0,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      start_date: startDate,
      end_date: endDate || null,
      renewal_date: renewalDate,
      status,
    }).eq('id', subscription.id);
    if (error) { toast({ title: 'Failed to update', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Subscription updated' });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Subscription</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Plan Name *</Label>
            <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Plan name" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {subscriptionCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Billing Cycle</Label>
              <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Half-Yearly">Half-Yearly</SelectItem>
                  <SelectItem value="Yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Base Amount (₹)</Label>
            <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">End Date (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Renewal Date</Label>
              <Input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Record Payment Dialog =====================

function RecordPaymentDialog({ subscription, onClose, onReceiptGenerated }: {
  subscription: Subscription;
  onClose: () => void;
  onReceiptGenerated: (info: { sub: Subscription; receiptNo: string; amount: number; date: string; method: string }) => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(String(subscription.total_amount));
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!amount || Number(amount) <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    setSaving(true);
    const result = await syncSubscriptionPayment({
      subscription,
      amount: Number(amount),
      method,
      paymentDate,
      reference: reference || undefined,
    });
    setSaving(false);
    if (result.error) {
      toast({ title: 'Payment failed', description: result.error, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Subscription payment recorded',
      description: `Receipt ${result.receiptNumber} — Next renewal: ${formatDate(result.newRenewalDate || '')} — Accounting income synced`,
    });
    if (result.receiptNumber) {
      onReceiptGenerated({
        sub: { ...subscription, renewal_date: result.newRenewalDate || subscription.renewal_date, status: 'Active' },
        receiptNo: result.receiptNumber,
        amount: Number(amount),
        date: paymentDate,
        method,
      });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record Subscription Payment</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-semibold">{subscription.plan_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Billing Cycle</span><span className="font-medium">{subscription.billing_cycle}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Due</span><span className="font-bold">{formatINR(Number(subscription.total_amount))}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Current Renewal</span><span>{formatDate(subscription.renewal_date)}</span></div>
          </div>
          <div>
            <Label>Amount (₹) *</Label>
            <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <Label>Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR, Cheque no..." />
          </div>
          <p className="text-xs text-muted-foreground">This will generate a receipt, log income in Accounting, and shift the renewal date to the next cycle.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {saving ? 'Processing...' : 'Record Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Receipt Dialog =====================

function ReceiptDialog({ data, onClose }: {
  data: { sub: Subscription; receiptNo: string; amount: number; date: string; method: string };
  onClose: () => void;
}) {
  const accent = useAccent();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!pdfRef.current) return;
    setDownloading(true);
    try {
      await downloadElementAsPDF(pdfRef.current, `Receipt-${data.receiptNo}.pdf`);
    } catch {
      /* ignore */
    }
    setDownloading(false);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
        <div ref={pdfRef}>
          <div className="bg-white text-gray-900 rounded-lg p-6" style={{ width: '100%', maxWidth: '400px' }}>
            <div className="text-center mb-5 pb-4 border-b-2" style={{ borderColor: accent }}>
              <h1 className="text-2xl font-bold" style={{ color: accent }}>Payment Receipt</h1>
              <p className="text-sm text-gray-500 mt-1">{data.receiptNo}</p>
            </div>
            <div className="space-y-2.5 text-sm mb-5">
              <Row label="Client" value={data.sub.client_name || '-'} />
              <Row label="Plan" value={data.sub.plan_name} />
              <Row label="Billing Cycle" value={data.sub.billing_cycle} />
              <Row label="Payment Date" value={formatDate(data.date)} />
              <Row label="Method" value={data.method} />
            </div>
            <div className="border-t-2 pt-3" style={{ borderColor: accent }}>
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Amount Paid</span>
                <span className="text-2xl font-bold" style={{ color: accent }}>{formatINR(data.amount)}</span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t text-center text-xs text-gray-400">
              <p>Thank you for your payment.</p>
              <p className="mt-1">Next renewal date: {formatDate(data.sub.renewal_date)}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={handleDownload} disabled={downloading} className="gap-2">
            <Download className="w-4 h-4" /> {downloading ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
