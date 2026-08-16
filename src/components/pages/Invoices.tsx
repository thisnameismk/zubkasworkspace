import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Receipt, Trash2, Eye, Pencil, Download, X, Save, Filter, ListPlus, Wallet, Loader as Loader2 } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { useSettings, type PaymentAccount } from '@/lib/settings';
import { supabase } from '@/lib/supabase';
import { calcTotals, formatINR, formatDate, genNumber } from '@/lib/calc';
import { downloadElementAsPDF } from '@/lib/pdf';
import { DocHeader, DocClientBox, DocMetaBox, DocItemsTable, DocTotals, DocFooter, useAccent } from '@/components/doc-layout';
import type { LineItem, DiscountType, TaxType, Invoice, InvoiceStatus, PaymentMethod } from '@/lib/types';
import { PageHeader, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { invoiceStatusConfig } from '@/lib/status';
import { consumeInvoicePrefill, consumeInvoicePreview } from '@/lib/prefill';
import { syncPaymentAndAccounting } from '@/lib/payment-sync';
import { cn } from '@/lib/utils';

export function Invoices() {
  const { invoices, clients, payments, refresh, addInvoice } = useData();
  const { toast } = useToast();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [logPaymentInv, setLogPaymentInv] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const previewId = consumeInvoicePreview();
    if (previewId) {
      const inv = invoices.find((i) => i.id === previewId);
      if (inv) setViewInvoice(inv);
    }
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      const client = clients.find((c) => c.id === inv.client_id);
      const q = search.toLowerCase();
      return inv.invoice_number.toLowerCase().includes(q) || (client?.company_name || '').toLowerCase().includes(q);
    });
  }, [invoices, clients, statusFilter, search]);

  const paidFor = (invId: string) => payments.filter((p) => p.invoice_id === invId).reduce((s, p) => s + Number(p.amount), 0);

  const remove = async (inv: Invoice) => {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
    if (error) { console.error('[Supabase] Failed to delete invoice:', error); toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Invoice deleted' });
    refresh();
  };

  const updateStatus = async (inv: Invoice, status: InvoiceStatus) => {
    if (status === 'partially_paid') {
      setLogPaymentInv(inv);
      return;
    }
    if (status === 'paid' && inv.status !== 'paid') {
      const paid = paidFor(inv.id);
      const balance = Math.max(0, Number(inv.total) - paid);
      if (balance > 0) {
        const result = await syncPaymentAndAccounting({
          invoice: inv,
          amount: balance,
          method: 'UPI',
          paymentDate: new Date().toISOString().slice(0, 10),
          reference: 'Full payment',
        });
        if (result.error) { toast({ title: result.error, variant: 'destructive' }); return; }
        toast({ title: 'Invoice marked as paid', description: 'Payment receipt, accounting income & project auto-created.' });
        refresh();
        return;
      }
    }
    const { error } = await supabase.from('invoices').update({ status }).eq('id', inv.id);
    if (error) { console.error('[Supabase] Failed to update invoice status:', error); toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Status updated to ${status}` });
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create, manage, and track invoices with automatic GST calculation"
        action={
          <Button onClick={() => { setEditingInvoice(null); setBuilderOpen(true); }} className="gap-2" disabled={clients.length === 0}>
            <Plus className="w-4 h-4" /> New Invoice
          </Button>
        }
      />

      {clients.length === 0 ? (
        <EmptyState icon={<Receipt className="w-8 h-8" />} title="No clients" description="Add a client first to create invoices." />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Input placeholder="Search invoice # or client..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<Receipt className="w-8 h-8" />} title="No invoices found" description="Create your first invoice or adjust filters." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((inv, i) => {
                const client = clients.find((c) => c.id === inv.client_id);
                const cfg = invoiceStatusConfig[inv.status];
                const paid = paidFor(inv.id);
                const balance = Math.max(0, Number(inv.total) - paid);
                return (
                  <div key={inv.id} className="rounded-xl border border-border bg-card p-5 animate-slide-up hover:shadow-lg transition-all group" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{client?.company_name || 'Unknown'}</p>
                      </div>
                      <StatusBadge label={cfg.label} className={cfg.className} dot={cfg.dot} />
                    </div>
                    <div className="text-sm space-y-0.5 mb-3">
                      <div className="flex justify-between text-muted-foreground"><span>Issued</span><span>{formatDate(inv.issue_date)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Due</span><span>{formatDate(inv.due_date)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatINR(Number(inv.total))}</span></div>
                      {paid > 0 && <div className="flex justify-between text-emerald-500"><span>Paid</span><span>{formatINR(paid)}</span></div>}
                      {balance > 0 && inv.status !== 'draft' && <div className="flex justify-between text-orange-500 font-medium"><span>Balance Due</span><span>{formatINR(balance)}</span></div>}
                      {balance === 0 && inv.status === 'paid' && <div className="flex justify-between text-emerald-500 font-medium"><span>Balance Due</span><span>₹0.00</span></div>}
                    </div>
                    {balance > 0 && inv.status !== 'draft' && (
                      <Button variant="default" size="sm" className="gap-1.5 w-full mb-2" onClick={() => setLogPaymentInv(inv)}><Wallet className="w-3.5 h-3.5" /> Log Payment</Button>
                    )}
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="gap-1 flex-1" onClick={() => setViewInvoice(inv)}><Eye className="w-3.5 h-3.5" /> View</Button>
                      <Button variant="outline" size="sm" className="gap-1 px-2" onClick={() => { setEditingInvoice(inv); setBuilderOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="outline" size="sm" className="gap-1 px-2 hover:text-destructive" onClick={() => remove(inv)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                    <div className="mt-2">
                      <Select value={inv.status} onValueChange={(v) => updateStatus(inv, v as InvoiceStatus)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(invoiceStatusConfig).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {builderOpen && <InvoiceBuilder editing={editingInvoice} onClose={() => { setBuilderOpen(false); setEditingInvoice(null); refresh(); }} />}
      {viewInvoice && <InvoiceViewDialog invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
      {logPaymentInv && (
        <LogPartialPaymentDialog
          invoice={logPaymentInv}
          paidAmount={paidFor(logPaymentInv.id)}
          balance={Math.max(0, Number(logPaymentInv.total) - paidFor(logPaymentInv.id))}
          onClose={() => setLogPaymentInv(null)}
          onDone={() => { setLogPaymentInv(null); refresh(); }}
        />
      )}
    </div>
  );
}

function InvoiceBuilder({ editing, onClose }: { editing: Invoice | null; onClose: () => void }) {
  const { clients, addInvoice } = useData();
  const { settings } = useSettings();
  const { toast } = useToast();
  const prefill = !editing ? consumeInvoicePrefill() : null;
  const [clientId, setClientId] = useState(editing?.client_id || prefill?.clientId || '');
  const [projectId, setProjectId] = useState(editing?.project_id || prefill?.projectId || null);
  const [issueDate, setIssueDate] = useState(editing?.issue_date || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(editing?.due_date || '');
  const [items, setItems] = useState<LineItem[]>(() => {
    if (prefill?.projectName) {
      return [{ description: prefill.projectName + (prefill.description ? ` — ${prefill.description}` : ''), quantity: 1, rate: prefill.budget || 0, amount: prefill.budget || 0 }];
    }
    return [{ description: '', quantity: 1, rate: 0, amount: 0 }];
  });
  const [discount, setDiscount] = useState(editing ? Number(editing.discount) : 0);
  const [discountType, setDiscountType] = useState<DiscountType>(editing?.discount_type || 'flat');
  const [taxType, setTaxType] = useState<TaxType>(editing?.tax_type || settings.defaultTaxType);
  const [notes, setNotes] = useState(editing?.notes || '');
  const [paymentAccountId, setPaymentAccountId] = useState(editing?.payment_account_id || (() => {
    const def = settings.paymentAccounts.find((a) => a.isDefault);
    return def?.id || settings.paymentAccounts[0]?.id || '';
  })());
  const [terms, setTerms] = useState<string[]>(editing?.terms ? JSON.parse(editing.terms) : [...settings.defaultTerms]);
  const [existingItems, setExistingItems] = useState<string[]>([]);

  useEffect(() => {
    if (editing) {
      supabase.from('invoice_items').select('*').eq('invoice_id', editing.id).then(({ data }) => {
        if (data && data.length > 0) {
          setItems(data.map((it) => ({ id: it.id, description: it.description, quantity: Number(it.quantity), rate: Number(it.rate), amount: Number(it.amount) })));
          setExistingItems(data.map((it) => it.id));
        }
      });
    }
  }, [editing]);

  const rates = { gst: settings.gstRate, cgst: settings.cgstRate, sgst: settings.sgstRate };
  const totals = useMemo(() => calcTotals(items, discount, discountType, taxType, rates), [items, discount, discountType, taxType, rates]);

  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: field === 'description' ? String(value) : Number(value) || 0 };
      updated.amount = Math.round(updated.quantity * updated.rate * 100) / 100;
      return updated;
    }));
  };
  const addItem = () => setItems((prev) => [...prev, { description: '', quantity: 1, rate: 0, amount: 0 }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    if (!clientId) { toast({ title: 'Select a client', variant: 'destructive' }); return; }
    if (items.some((it) => !it.description.trim())) { toast({ title: 'Fill all descriptions', variant: 'destructive' }); return; }
    const validItems = items.filter((it) => it.description.trim());

    if (editing) {
      const { error } = await supabase.from('invoices').update({
        client_id: clientId, issue_date: issueDate, due_date: dueDate || null,
        subtotal: totals.subtotal, discount, discount_type: discountType, tax_type: taxType,
        cgst: totals.cgst, sgst: totals.sgst, igst: totals.igst, total: totals.total, notes: notes || null,
        payment_account_id: paymentAccountId || null, terms: JSON.stringify(terms.filter((t) => t.trim())),
        project_id: projectId || null,
      }).eq('id', editing.id);
      if (error) { console.error('[Supabase] Failed to update invoice:', error); toast({ title: 'Failed to update', description: error.message, variant: 'destructive' }); return; }
      // Replace items
      if (existingItems.length > 0) await supabase.from('invoice_items').delete().in('id', existingItems);
      if (validItems.length > 0) await supabase.from('invoice_items').insert(validItems.map((it) => ({ invoice_id: editing.id, description: it.description, quantity: it.quantity, rate: it.rate, amount: it.amount })));
      toast({ title: 'Invoice updated' });
    } else {
      const invoiceNumber = genNumber('INV');
      const inv = await addInvoice({
        client_id: clientId, invoice_number: invoiceNumber, issue_date: issueDate, due_date: dueDate || null,
        status: 'draft', subtotal: totals.subtotal, discount, discount_type: discountType, tax_type: taxType,
        cgst: totals.cgst, sgst: totals.sgst, igst: totals.igst, total: totals.total, notes: notes || null,
        payment_account_id: paymentAccountId || null, terms: JSON.stringify(terms.filter((t) => t.trim())),
        project_id: projectId || null,
      }, validItems);
      if (!inv) return;
      toast({ title: 'Invoice created', description: invoiceNumber });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto scrollbar-thin animate-scale-in">
        <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-bold text-lg">{editing ? `Edit ${editing.invoice_number}` : 'New Invoice'}</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} className="gap-1.5"><Save className="w-4 h-4" /> Save</Button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tax Type</Label>
              <Select value={taxType} onValueChange={(v) => setTaxType(v as TaxType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Tax</SelectItem>
                  <SelectItem value="intra">Intra-State (CGST+SGST)</SelectItem>
                  <SelectItem value="inter">Inter-State (IGST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Issue Date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Line Items</Label>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 h-7 text-xs"><Plus className="w-3.5 h-3.5" /> Add</Button>
            </div>
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] text-muted-foreground uppercase font-medium px-2">
                <span className="col-span-6">Description</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">Rate</span>
                <span className="col-span-2 text-right">Amount</span>
              </div>
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <Input className="col-span-12 sm:col-span-6" placeholder="Service description" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                  <Input className="col-span-4 sm:col-span-2 text-right" type="number" min="0" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                  <Input className="col-span-4 sm:col-span-2 text-right" type="number" min="0" value={it.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} />
                  <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1 h-9">
                    <span className="text-sm font-medium">{formatINR(it.amount)}</span>
                    {items.length > 1 && <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Discount</Label>
              <div className="flex gap-2">
                <Input type="number" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="flat">₹ Flat</SelectItem><SelectItem value="percent">% Percent</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms..." />
            </div>
          </div>

          {/* Payment Account Selector */}
          <div>
            <Label className="text-xs">Payment Account (for PDF)</Label>
            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account to display" /></SelectTrigger>
              <SelectContent>
                {settings.paymentAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.label || a.bankName || a.upiId || 'Unnamed'}{a.isDefault ? ' (Default)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">This bank/UPI info will appear in the PDF footer.</p>
          </div>

          {/* Terms & Conditions editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs flex items-center gap-1.5"><ListPlus className="w-3.5 h-3.5" /> Terms & Conditions</Label>
              <Button variant="outline" size="sm" onClick={() => setTerms([...terms, ''])} className="gap-1.5 h-7 text-xs"><Plus className="w-3.5 h-3.5" /> Add Term</Button>
            </div>
            <div className="space-y-2">
              {terms.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={t} onChange={(e) => setTerms((prev) => prev.map((x, idx) => idx === i ? e.target.value : x))} placeholder={`Term ${i + 1}`} className="text-sm" />
                  <button onClick={() => setTerms((prev) => prev.filter((_, idx) => idx !== i))} className="p-2 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-medium">{formatINR(totals.subtotal)}</span></div>
            {totals.discountAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="font-medium">- {formatINR(totals.discountAmount)}</span></div>}
            <div className="flex justify-between text-muted-foreground text-xs"><span>Taxable</span><span>{formatINR(totals.taxable)}</span></div>
            {taxType === 'intra' && (<><div className="flex justify-between text-muted-foreground"><span>CGST ({rates.cgst}%)</span><span className="font-medium">{formatINR(totals.cgst)}</span></div><div className="flex justify-between text-muted-foreground"><span>SGST ({rates.sgst}%)</span><span className="font-medium">{formatINR(totals.sgst)}</span></div></>)}
            {taxType === 'inter' && <div className="flex justify-between text-muted-foreground"><span>IGST ({rates.gst}%)</span><span className="font-medium">{formatINR(totals.igst)}</span></div>}
            <div className="pt-2 border-t border-border flex justify-between items-center"><span className="font-semibold">Grand Total</span><span className="text-xl font-bold text-primary">{formatINR(totals.total)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceViewDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { clients, payments, refresh } = useData();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [items, setItems] = useState<LineItem[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id).then(({ data }) => setItems(data || []));
  }, [invoice.id]);

  const client = clients.find((c) => c.id === invoice.client_id);
  const invPayments = payments.filter((p) => p.invoice_id === invoice.id);
  const paidAmount = invPayments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(0, Number(invoice.total) - paidAmount);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      await downloadElementAsPDF(printRef.current, `Invoice-${invoice.invoice_number}.pdf`);
      toast({ title: 'PDF downloaded' });
    } catch {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
    setDownloading(false);
  };

  const [logPaymentOpen, setLogPaymentOpen] = useState(false);

  const markAsPaid = async () => {
    if (balance <= 0) return;
    const result = await syncPaymentAndAccounting({
      invoice,
      amount: balance,
      method: 'UPI',
      paymentDate: new Date().toISOString().slice(0, 10),
      reference: 'Full payment',
    });
    if (result.error) { toast({ title: result.error, variant: 'destructive' }); return; }
    toast({ title: 'Invoice marked as paid', description: 'Payment, receipt & accounting synced. Project created.' });
    refresh();
    onClose();
  };

  const accent = useAccent();
  const rates = { gst: settings.gstRate, cgst: settings.cgstRate, sgst: settings.sgstRate };
  const totalsRows: { label: string; value: string }[] = [
    { label: 'Subtotal', value: formatINR(Number(invoice.subtotal)) },
  ];
  if (Number(invoice.discount) > 0) totalsRows.push({ label: 'Discount', value: `- ${formatINR(Number(invoice.discount))}` });
  if (Number(invoice.cgst) > 0) totalsRows.push({ label: `CGST (${rates.cgst}%)`, value: formatINR(Number(invoice.cgst)) });
  if (Number(invoice.sgst) > 0) totalsRows.push({ label: `SGST (${rates.sgst}%)`, value: formatINR(Number(invoice.sgst)) });
  if (Number(invoice.igst) > 0) totalsRows.push({ label: `IGST (${rates.gst}%)`, value: formatINR(Number(invoice.igst)) });
  if (paidAmount > 0) totalsRows.push({ label: 'Paid', value: `- ${formatINR(paidAmount)}` });
  if (balance > 0) totalsRows.push({ label: 'Balance Due', value: formatINR(balance) });
  if (balance === 0 && invoice.status === 'paid') totalsRows.push({ label: 'Balance Due', value: '₹0.00' });

  const statusStamp = invoice.status === 'paid'
    ? { label: 'PAID', color: '#059669' }
    : invoice.status === 'overdue'
    ? { label: 'OVERDUE', color: '#dc2626' }
    : invoice.status === 'sent'
    ? { label: 'SENT', color: '#0ea5e9' }
    : invoice.status === 'pending'
    ? { label: 'PENDING', color: '#d97706' }
    : { label: 'DRAFT', color: '#6b7280' };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Invoice {invoice.invoice_number}</span>
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="bg-white text-gray-900 rounded-lg p-6 sm:p-8" style={{ width: '210mm', minHeight: '297mm', maxWidth: '100%' }}>
          <DocHeader title="INVOICE" docNumber={invoice.invoice_number} accent={accent} />
          <div className="grid grid-cols-2 gap-4 mb-5">
            <DocClientBox label="Bill To" client={client} accent={accent} />
            <DocMetaBox
              accent={accent}
              rows={[
                { label: 'Issue Date', value: formatDate(invoice.issue_date) },
                { label: 'Due Date', value: invoice.due_date ? formatDate(invoice.due_date) : 'N/A' },
              ]}
            />
          </div>
          <DocItemsTable items={items} accent={accent} />
          <DocTotals
            rows={totalsRows}
            total={formatINR(Number(invoice.total))}
            accent={accent}
            statusStamp={statusStamp}
          />

          {/* Payment history */}
          {invPayments.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: accent }}>Payment History</p>
              <div className="space-y-1">
                {invPayments.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs py-1.5 px-3 rounded-lg bg-gray-50">
                    <span className="text-gray-600">{p.payment_method} · {formatDate(p.payment_date)} {p.reference ? `· ${p.reference}` : ''}</span>
                    <span className="font-medium text-gray-800">{formatINR(Number(p.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DocFooter accent={accent} notes={invoice.notes || undefined} paymentAccount={settings.paymentAccounts.find((a) => a.id === invoice.payment_account_id) || null} terms={invoice.terms ? JSON.parse(invoice.terms) : null} />
        </div>

        <DialogFooter>
          {balance > 0 && invoice.status !== 'draft' && (
            <>
              <Button variant="outline" onClick={() => setLogPaymentOpen(true)} className="gap-1.5">
                <Wallet className="w-4 h-4" /> Log Payment
              </Button>
              <Button variant="outline" onClick={markAsPaid} className="gap-1.5">
                <Receipt className="w-4 h-4" /> Mark as Paid
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleDownload} className="gap-1.5" disabled={downloading}>
            <Download className="w-4 h-4" /> {downloading ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>

      </DialogContent>
      {logPaymentOpen && (
        <LogPartialPaymentDialog
          invoice={invoice}
          paidAmount={paidAmount}
          balance={balance}
          onClose={() => setLogPaymentOpen(false)}
          onDone={() => { refresh(); onClose(); }}
        />
      )}
    </Dialog>
  );
}

function LogPartialPaymentDialog({ invoice, paidAmount, balance, onClose, onDone }: {
  invoice: Invoice;
  paidAmount: number;
  balance: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    if (amt > balance) { toast({ title: `Amount exceeds balance of ${formatINR(balance)}`, variant: 'destructive' }); return; }
    setSaving(true);
    const result = await syncPaymentAndAccounting({
      invoice,
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
    onDone();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record Payment for {invoice.invoice_number}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice Total</span><span className="font-semibold">{formatINR(Number(invoice.total))}</span></div>
            <div className="flex justify-between text-emerald-500"><span>Received So Far</span><span className="font-semibold">{formatINR(paidAmount)}</span></div>
            <div className="flex justify-between text-orange-500 font-medium"><span>Balance Due</span><span className="font-bold">{formatINR(balance)}</span></div>
          </div>
          <div>
            <Label>Payment Amount (₹) *</Label>
            <Input type="number" min="0" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
            <p className="text-xs text-muted-foreground mt-1">Enter any partial amount (e.g. advance payment).</p>
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
