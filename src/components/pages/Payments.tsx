import { useState, useMemo, useRef } from 'react';
import { Plus, Wallet, Banknote, Smartphone, Building2, Trash2, Link2, Copy, CircleCheck as CheckCircle2, Receipt as ReceiptIcon, Download, Eye, Loader as Loader2 } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDate, genNumber } from '@/lib/calc';
import { downloadElementAsPDF } from '@/lib/pdf';
import { DocHeader, DocFooter, useAccent, useCompany } from '@/components/doc-layout';
import { syncPaymentAndAccounting } from '@/lib/payment-sync';
import type { Payment, PaymentMethod } from '@/lib/types';
import { PageHeader, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { paymentStatusConfig } from '@/lib/status';
import { cn } from '@/lib/utils';

const methodIcons: Record<PaymentMethod, typeof Wallet> = {
  Cash: Banknote,
  UPI: Smartphone,
  'Bank Transfer': Building2,
};

export function Payments() {
  const { payments, invoices, clients, refresh } = useData();
  const { toast } = useToast();
  const [logOpen, setLogOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    const partial = payments.filter((p) => p.status === 'partial').length;
    const full = payments.filter((p) => p.status === 'full').length;
    const byMethod: Record<string, number> = {};
    payments.forEach((p) => { byMethod[p.payment_method] = (byMethod[p.payment_method] || 0) + Number(p.amount); });
    return { total, partial, full, byMethod };
  }, [payments]);

  const filtered = payments.filter((p) => {
    const inv = invoices.find((i) => i.id === p.invoice_id);
    const client = clients.find((c) => c.id === p.client_id);
    const q = search.toLowerCase();
    return (inv?.invoice_number || '').toLowerCase().includes(q) || (client?.company_name || '').toLowerCase().includes(q);
  });

  const remove = async (id: string) => {
    if (!confirm('Delete this payment record?')) return;
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) { console.error('[Supabase] Failed to delete payment:', error); toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Payment deleted' });
    refresh();
  };

  const methodCards: { method: PaymentMethod; amount: number; icon: typeof Wallet; color: string }[] = [
    { method: 'UPI', amount: stats.byMethod.UPI || 0, icon: Smartphone, color: 'from-violet-500 to-purple-600' },
    { method: 'Bank Transfer', amount: stats.byMethod['Bank Transfer'] || 0, icon: Building2, color: 'from-blue-500 to-cyan-600' },
    { method: 'Cash', amount: stats.byMethod.Cash || 0, icon: Banknote, color: 'from-emerald-500 to-green-600' },
  ];

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Track payments, log transactions, generate payment links and receipts"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLinkOpen(true)} className="gap-2" disabled={invoices.length === 0}>
              <Link2 className="w-4 h-4" /> Payment Link
            </Button>
            <Button onClick={() => setLogOpen(true)} className="gap-2" disabled={invoices.length === 0}>
              <Plus className="w-4 h-4" /> Log Payment
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-5 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Received</p>
              <p className="text-2xl font-bold mt-2">{formatINR(stats.total)}</p>
            </div>
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
            <span>{stats.full} full</span><span>{stats.partial} partial</span>
          </div>
        </div>
        {methodCards.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={m.method} className="rounded-xl border border-border bg-card p-5 animate-slide-up" style={{ animationDelay: `${(i + 1) * 60}ms` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{m.method}</p>
                  <p className="text-2xl font-bold mt-2">{formatINR(m.amount)}</p>
                </div>
                <div className={cn('flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br text-white shadow-lg', m.color)}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="payments" className="gap-1.5"><Wallet className="w-4 h-4" /> Payments</TabsTrigger>
          <TabsTrigger value="receipts" className="gap-1.5"><ReceiptIcon className="w-4 h-4" /> Receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <div className="mb-4">
            <Input placeholder="Search by invoice or client..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<Wallet className="w-8 h-8" />} title="No payments recorded" description="Log your first payment to start tracking revenue." action={<Button onClick={() => setLogOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Log Payment</Button>} />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden animate-slide-up">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Invoice</th>
                      <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Client</th>
                      <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Method</th>
                      <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-right py-3 px-4 font-medium">Amount</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const inv = invoices.find((i) => i.id === p.invoice_id);
                      const client = clients.find((c) => c.id === p.client_id);
                      const Icon = methodIcons[p.payment_method as PaymentMethod] || Wallet;
                      return (
                        <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium">{inv?.invoice_number || '-'}</td>
                          <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">{client?.company_name || '-'}</td>
                          <td className="py-3 px-4 hidden md:table-cell">
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Icon className="w-3.5 h-3.5" />{p.payment_method}</span>
                          </td>
                          <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">{formatDate(p.payment_date)}</td>
                          <td className="py-3 px-4"><StatusBadge label={paymentStatusConfig[p.status as keyof typeof paymentStatusConfig]?.label || p.status} className={paymentStatusConfig[p.status as keyof typeof paymentStatusConfig]?.className} /></td>
                          <td className="py-3 px-4 text-right font-semibold">{formatINR(Number(p.amount))}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setReceiptPayment(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="View Receipt"><ReceiptIcon className="w-4 h-4" /></button>
                              <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
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

        <TabsContent value="receipts">
          {payments.length === 0 ? (
            <EmptyState icon={<ReceiptIcon className="w-8 h-8" />} title="No receipts yet" description="Receipts are generated automatically when payments are logged." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {payments.map((p, i) => {
                const inv = invoices.find((i) => i.id === p.invoice_id);
                const client = clients.find((c) => c.id === p.client_id);
                const receiptNo = `RCP-${p.id.slice(0, 8).toUpperCase()}`;
                return (
                  <div key={p.id} className="rounded-xl border border-border bg-card p-5 animate-slide-up hover:shadow-lg transition-all" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold">{receiptNo}</p>
                        <p className="text-xs text-muted-foreground">{client?.company_name || '-'}</p>
                      </div>
                      <StatusBadge label={paymentStatusConfig[p.status as keyof typeof paymentStatusConfig]?.label || p.status} className={paymentStatusConfig[p.status as keyof typeof paymentStatusConfig]?.className} />
                    </div>
                    <div className="text-sm space-y-0.5 mb-3">
                      <div className="flex justify-between text-muted-foreground"><span>Date</span><span>{formatDate(p.payment_date)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Method</span><span>{p.payment_method}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">{formatINR(Number(p.amount))}</span></div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setReceiptPayment(p)}>
                      <Eye className="w-3.5 h-3.5" /> View & Download
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {logOpen && <LogPaymentDialog onClose={() => { setLogOpen(false); refresh(); }} />}
      {linkOpen && <PaymentLinkDialog onClose={() => setLinkOpen(false)} />}
      {receiptPayment && <ReceiptDialog payment={receiptPayment} onClose={() => setReceiptPayment(null)} />}
    </div>
  );
}

function LogPaymentDialog({ onClose }: { onClose: () => void }) {
  const { invoices, clients, payments } = useData();
  const { toast } = useToast();
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);
  const invoiceTotal = selectedInvoice ? Number(selectedInvoice.total) : 0;
  const receivedSoFar = selectedInvoice
    ? payments.filter((p) => p.invoice_id === invoiceId).reduce((s, p) => s + Number(p.amount), 0)
    : 0;
  const balanceDue = Math.max(0, invoiceTotal - receivedSoFar);

  const save = async () => {
    if (!invoiceId || !amount) { toast({ title: 'Fill all fields', variant: 'destructive' }); return; }
    const amt = Number(amount);
    if (amt <= 0) { toast({ title: 'Amount must be positive', variant: 'destructive' }); return; }
    if (amt > balanceDue) { toast({ title: `Amount exceeds balance of ${formatINR(balanceDue)}`, variant: 'destructive' }); return; }
    setSaving(true);
    const inv = invoices.find((i) => i.id === invoiceId)!;
    const result = await syncPaymentAndAccounting({
      invoice: inv,
      amount: amt,
      method,
      paymentDate,
      reference: reference || undefined,
    });
    setSaving(false);
    if (result.error) { toast({ title: result.error, variant: 'destructive' }); return; }
    const isFull = (result.balanceDue ?? 0) <= 0;
    toast({
      title: isFull ? 'Invoice fully paid' : 'Partial payment logged',
      description: `Receipt ${result.receiptNumber} · Balance due ${formatINR(result.balanceDue ?? 0)} · Accounting income & project synced`,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record Payment{selectedInvoice ? ` for ${selectedInvoice.invoice_number}` : ''}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Invoice *</Label>
            <Select value={invoiceId} onValueChange={(v) => { setInvoiceId(v); const inv = invoices.find((i) => i.id === v); if (inv) setAmount(String(Number(inv.total))); }}>
              <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
              <SelectContent>
                {invoices.filter((i) => i.status !== 'draft').map((i) => {
                  const c = clients.find((cl) => cl.id === i.client_id);
                  return <SelectItem key={i.id} value={i.id}>{i.invoice_number} — {c?.company_name}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          {selectedInvoice && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Invoice Total</span><span className="font-semibold">{formatINR(invoiceTotal)}</span></div>
              {receivedSoFar > 0 && (
                <div className="flex justify-between text-emerald-500"><span>Received So Far</span><span className="font-semibold">{formatINR(receivedSoFar)}</span></div>
              )}
              <div className="flex justify-between text-orange-500 font-medium"><span>Balance Due</span><span className="font-bold">{formatINR(balanceDue)}</span></div>
            </div>
          )}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Log Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentLinkDialog({ onClose }: { onClose: () => void }) {
  const { invoices, clients } = useData();
  const [invoiceId, setInvoiceId] = useState('');
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);
  const client = selectedInvoice ? clients.find((c) => c.id === selectedInvoice.client_id) : undefined;
  const link = invoiceId
    ? `${window.location.origin}/pay/${invoiceId}?ref=ZT-${invoiceId.slice(0, 8).toUpperCase()}`
    : '';

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Generate Payment Link</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Select Invoice</Label>
            <Select value={invoiceId} onValueChange={(v) => { setInvoiceId(v); setGenerated(true); }}>
              <SelectTrigger><SelectValue placeholder="Choose invoice" /></SelectTrigger>
              <SelectContent>
                {invoices.filter((i) => i.status !== 'draft' && i.status !== 'paid').map((i) => {
                  const c = clients.find((cl) => cl.id === i.client_id);
                  return <SelectItem key={i.id} value={i.id}>{i.invoice_number} — {c?.company_name} — {formatINR(Number(i.total))}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          {generated && selectedInvoice && client && (
            <div className="space-y-3 animate-fade-in">
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span className="font-medium">{client.company_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{formatINR(Number(selectedInvoice.total))}</span></div>
              </div>
              <div>
                <Label>Payment Link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={link} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copy} className="shrink-0">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Share this link with {client.contact_person} to collect payment. The link references invoice {selectedInvoice.invoice_number}.</p>
            </div>
          )}
          {!generated && (
            <p className="text-sm text-muted-foreground text-center py-4">Select an invoice to generate a unique payment link.</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { invoices, clients, payments } = useData();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const accent = useAccent();
  const company = useCompany();

  const inv = invoices.find((i) => i.id === payment.invoice_id);
  const client = clients.find((c) => c.id === payment.client_id);
  const receiptNo = payment.receipt_number || `RCP-${payment.id.slice(0, 8).toUpperCase()}`;

  const invoiceTotal = inv ? Number(inv.total) : 0;
  const totalReceived = payments
    .filter((p) => p.invoice_id === payment.invoice_id)
    .reduce((s, p) => s + Number(p.amount), 0);
  const balanceDue = Math.max(0, invoiceTotal - totalReceived);

  const handleDownload = async () => {
    if (!pdfRef.current) return;
    setDownloading(true);
    try {
      await downloadElementAsPDF(pdfRef.current, `Receipt-${receiptNo}.pdf`);
      toast({ title: 'Receipt PDF downloaded' });
    } catch {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
    setDownloading(false);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
        </DialogHeader>

        <div ref={pdfRef} className="bg-white text-gray-900 rounded-lg p-6 sm:p-8" style={{ width: '210mm', maxWidth: '100%' }}>
          <DocHeader title="PAYMENT RECEIPT" docNumber={receiptNo} accent={accent} />

          {/* Receipt details card */}
          <div className="rounded-lg border border-gray-200 overflow-hidden mb-5">
            <div className="grid grid-cols-2">
              <div className="p-4 border-r border-b border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>Receipt No.</p>
                <p className="font-semibold text-sm">{receiptNo}</p>
              </div>
              <div className="p-4 border-b border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>Payment Date</p>
                <p className="font-semibold text-sm">{formatDate(payment.payment_date)}</p>
              </div>
              <div className="p-4 border-r border-b border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>Received From</p>
                <p className="font-semibold text-sm">{client?.company_name || '-'}</p>
                {client?.contact_person && <p className="text-xs text-gray-500">{client.contact_person}</p>}
              </div>
              <div className="p-4 border-b border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>Invoice Reference</p>
                <p className="font-semibold text-sm">{inv?.invoice_number || '-'}</p>
              </div>
              <div className="p-4 border-r border-b border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>Payment Mode</p>
                <p className="font-semibold text-sm">{payment.payment_method}</p>
              </div>
              <div className="p-4 border-b border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>Transaction ID</p>
                <p className="font-semibold text-sm font-mono">{payment.reference || 'N/A'}</p>
              </div>
            </div>
            {/* Amount box */}
            <div className="flex justify-between items-center px-4 py-4" style={{ background: `${accent}10`, borderTop: `2px solid ${accent}` }}>
              <span className="font-bold text-gray-800">Amount Paid</span>
              <span className="text-2xl font-bold" style={{ color: accent }}>{formatINR(Number(payment.amount))}</span>
            </div>
            {/* Balance due row */}
            <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-600">Invoice Total</span>
              <span className="text-sm font-semibold text-gray-800">{formatINR(invoiceTotal)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-600">Total Received</span>
              <span className="text-sm font-semibold text-emerald-600">{formatINR(totalReceived)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
              <span className="text-sm font-bold text-gray-700">Balance Due</span>
              <span className="text-sm font-bold" style={{ color: balanceDue > 0 ? '#f97316' : '#10b981' }}>
                {balanceDue > 0 ? formatINR(balanceDue) : '₹0.00'}
              </span>
            </div>
          </div>

          {/* Status stamp */}
          <div className="flex justify-end mb-4">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}40` }}
            >
              {payment.status === 'full' ? 'Full Payment' : 'Partial Payment'}
            </span>
          </div>

          <DocFooter accent={accent} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDownload} className="gap-2" disabled={downloading}>
            <Download className="w-4 h-4" /> {downloading ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
