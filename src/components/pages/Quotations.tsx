import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, FileText, Trash2, Eye, Save, X, Receipt, Download, ListPlus, Repeat } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { useSettings, type PaymentAccount } from '@/lib/settings';
import { supabase } from '@/lib/supabase';
import { calcTotals, formatINR, formatDate, genNumber } from '@/lib/calc';
import { downloadElementAsPDF } from '@/lib/pdf';
import { DocHeader, DocClientBox, DocMetaBox, DocItemsTable, DocTotals, DocFooter, useAccent } from '@/components/doc-layout';
import type { LineItem, DiscountType, TaxType, Quotation, BillingCycle } from '@/lib/types';
import { computeRenewalDate } from '@/lib/subscription-sync';
import { PageHeader, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { quoteStatusConfig } from '@/lib/status';
import { cn } from '@/lib/utils';

import { setInvoicePreview } from '@/lib/prefill';
import type { Page } from '@/components/layout/Sidebar';

export function Quotations({ onNavigate }: { onNavigate?: (p: Page) => void }) {
  const { quotations, clients, refresh, addInvoice } = useData();
  const { toast } = useToast();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);

  const convertToInvoice = async (q: Quotation) => {
    const { data: items } = await supabase.from('quotation_items').select('*').eq('quotation_id', q.id);
    const invoiceNumber = genNumber('INV');
    const inv = await addInvoice({
      client_id: q.client_id,
      quotation_id: q.id,
      invoice_number: invoiceNumber,
      issue_date: q.issue_date,
      due_date: null,
      status: 'draft',
      subtotal: q.subtotal,
      discount: q.discount,
      discount_type: q.discount_type,
      tax_type: q.tax_type,
      cgst: q.cgst,
      sgst: q.sgst,
      igst: q.igst,
      total: q.total,
      notes: q.notes,
    }, (items || []).map((it) => ({ description: it.description, quantity: it.quantity, rate: it.rate, amount: it.amount })));
    if (!inv) return;
    await supabase.from('quotations').update({ status: 'converted' }).eq('id', q.id);

    // If a subscription entry already exists for this quotation, keep it linked.
    // Otherwise, check if this was a subscription-type quote by looking for existing subscription.
    toast({ title: 'Quotation converted to invoice', description: invoiceNumber });
    refresh();
    setInvoicePreview(inv.id);
    if (onNavigate) onNavigate('invoices');
  };

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Create professional estimates with GST and convert them to invoices"
        action={
          <Button onClick={() => setBuilderOpen(true)} className="gap-2" disabled={clients.length === 0}>
            <Plus className="w-4 h-4" /> New Quotation
          </Button>
        }
      />

      {clients.length === 0 ? (
        <EmptyState icon={<FileText className="w-8 h-8" />} title="No clients to quote" description="Add a client first before creating a quotation." />
      ) : quotations.length === 0 ? (
        <EmptyState icon={<FileText className="w-8 h-8" />} title="No quotations yet" description="Create your first quotation with line items, GST, and discounts." action={<Button onClick={() => setBuilderOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> New Quotation</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quotations.map((q, i) => {
            const client = clients.find((c) => c.id === q.client_id);
            const cfg = quoteStatusConfig[q.status];
            return (
              <div key={q.id} className="rounded-xl border border-border bg-card p-5 animate-slide-up hover:shadow-lg transition-all" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{q.quote_number}</p>
                    <p className="text-xs text-muted-foreground">{client?.company_name || 'Unknown'}</p>
                  </div>
                  <StatusBadge label={cfg.label} className={cfg.className} dot={cfg.dot} />
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>Issued: {formatDate(q.issue_date)}</p>
                  {q.expiry_date && <p>Expires: {formatDate(q.expiry_date)}</p>}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-lg font-bold">{formatINR(Number(q.total))}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => setPreviewQuote(q)}>
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </Button>
                  <Button size="sm" className="gap-1.5 flex-1" onClick={() => convertToInvoice(q)}>
                    <Receipt className="w-3.5 h-3.5" /> Convert
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {builderOpen && <QuotationBuilder onClose={() => { setBuilderOpen(false); refresh(); }} />}
      {previewQuote && <PreviewDialog quote={previewQuote} onClose={() => setPreviewQuote(null)} />}
    </div>
  );
}

function QuotationBuilder({ onClose }: { onClose: () => void }) {
  const { clients, addQuotation, subscriptionCategories } = useData();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [quotationType, setQuotationType] = useState<'service' | 'subscription'>('service');
  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<DiscountType>('flat');
  const [taxType, setTaxType] = useState<TaxType>(settings.defaultTaxType);
  const [notes, setNotes] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState(() => {
    const def = settings.paymentAccounts.find((a) => a.isDefault);
    return def?.id || settings.paymentAccounts[0]?.id || '';
  });
  const [terms, setTerms] = useState<string[]>([...settings.defaultTerms]);
  const [showPreview, setShowPreview] = useState(false);

  // Subscription-specific fields
  const [subCategoryId, setSubCategoryId] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('Monthly');
  const [subStartDate, setSubStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [subEndDate, setSubEndDate] = useState('');
  const subRenewalDate = useMemo(() => {
    if (!subStartDate) return '';
    return computeRenewalDate(subStartDate, billingCycle);
  }, [subStartDate, billingCycle]);

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
    if (items.some((it) => !it.description.trim())) { toast({ title: 'Fill all line item descriptions', variant: 'destructive' }); return; }
    if (quotationType === 'subscription' && !subCategoryId) { toast({ title: 'Select a subscription category', variant: 'destructive' }); return; }
    const quoteNumber = genNumber('QT');
    const validItems = items.filter((it) => it.description.trim());
    const quote = await addQuotation({
      client_id: clientId,
      quote_number: quoteNumber,
      issue_date: issueDate,
      expiry_date: expiryDate || null,
      status: 'draft',
      subtotal: totals.subtotal,
      discount,
      discount_type: discountType,
      tax_type: taxType,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      total: totals.total,
      notes: notes || null,
      payment_account_id: paymentAccountId || null,
      terms: JSON.stringify(terms.filter((t) => t.trim())),
    }, validItems);
    if (!quote) return;

    // If subscription type, auto-create subscription entry
    if (quotationType === 'subscription') {
      const client = clients.find((c) => c.id === clientId);
      const cat = subscriptionCategories.find((c) => c.id === subCategoryId);
      const { error: subErr } = await supabase.from('subscriptions').insert({
        client_id: clientId,
        client_name: client?.company_name || null,
        quotation_id: quote.id,
        category_id: subCategoryId,
        plan_name: cat?.name || validItems[0]?.description || 'Subscription',
        amount: totals.subtotal - totals.discountAmount,
        tax_amount: totals.cgst + totals.sgst + totals.igst,
        total_amount: totals.total,
        billing_cycle: billingCycle,
        start_date: subStartDate,
        end_date: subEndDate || null,
        renewal_date: subRenewalDate,
        status: 'Pending',
      });
      if (subErr) {
        toast({ title: 'Quotation created, but subscription entry failed', description: subErr.message, variant: 'destructive' });
      } else {
        toast({ title: 'Subscription quotation created', description: `${quoteNumber} — ${billingCycle} subscription added` });
      }
    } else {
      toast({ title: 'Quotation created', description: quoteNumber });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto scrollbar-thin animate-scale-in">
        <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-bold text-lg">Quotation Builder</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-1.5">
              <Eye className="w-4 h-4" /> {showPreview ? 'Edit' : 'Preview'}
            </Button>
            <Button size="sm" onClick={save} className="gap-1.5"><Save className="w-4 h-4" /> Save</Button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-0">
          {/* Form */}
          <div className={cn('lg:col-span-3 p-5 space-y-4', showPreview && 'hidden lg:block')}>
            {/* Quotation Type Toggle */}
            <div>
              <Label className="text-xs mb-2 block">Quotation Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setQuotationType('service')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 transition-all text-sm font-medium',
                    quotationType === 'service' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted text-muted-foreground',
                  )}
                >
                  <FileText className="w-4 h-4" /> Service (One-time)
                </button>
                <button
                  onClick={() => setQuotationType('subscription')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 transition-all text-sm font-medium',
                    quotationType === 'subscription' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted text-muted-foreground',
                  )}
                >
                  <Repeat className="w-4 h-4" /> Subscription (Recurring)
                </button>
              </div>
            </div>

            {/* Subscription-specific fields */}
            {quotationType === 'subscription' && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 animate-fade-in">
                <Label className="text-xs font-semibold text-primary uppercase tracking-wide">Subscription Details</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Category *</Label>
                    <Select value={subCategoryId} onValueChange={setSubCategoryId}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {subscriptionCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Billing Cycle</Label>
                    <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                        <SelectItem value="Half-Yearly">Half-Yearly</SelectItem>
                        <SelectItem value="Yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" value={subStartDate} onChange={(e) => setSubStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">End Date (optional)</Label>
                    <Input type="date" value={subEndDate} onChange={(e) => setSubEndDate(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Next Renewal Date (auto-calculated)</Label>
                    <Input type="date" value={subRenewalDate} readOnly className="bg-muted/50" />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Issue Date</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Expiry Date</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
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
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Line Items</Label>
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 h-7 text-xs"><Plus className="w-3.5 h-3.5" /> Add Item</Button>
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
                    <Input className="col-span-12 sm:col-span-6" placeholder="Web development services" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                    <Input className="col-span-4 sm:col-span-2 text-right" type="number" min="0" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                    <Input className="col-span-4 sm:col-span-2 text-right" type="number" min="0" value={it.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} />
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1 h-9">
                      <span className="text-sm font-medium">{formatINR(it.amount)}</span>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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

            {/* Discount + Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Discount</Label>
                <div className="flex gap-2">
                  <Input type="number" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">₹ Flat</SelectItem>
                      <SelectItem value="percent">% Percent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, validity..." />
              </div>
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

            {/* Totals */}
            <TotalsBox totals={totals} discount={discount} discountType={discountType} taxType={taxType} rates={rates} />
          </div>

          {/* Preview */}
          <div className={cn('lg:col-span-2 bg-muted/30 border-l border-border p-5', !showPreview && 'hidden lg:block')}>
            <PreviewContent
              client={clients.find((c) => c.id === clientId)}
              items={items}
              totals={totals}
              issueDate={issueDate}
              expiryDate={expiryDate}
              quoteNumber="QT/Preview"
              notes={notes}
              rates={rates}
              taxType={taxType}
              paymentAccount={settings.paymentAccounts.find((a) => a.id === paymentAccountId) || null}
              terms={terms}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalsBox({ totals, discount, discountType, taxType, rates }: { totals: ReturnType<typeof calcTotals>; discount: number; discountType: DiscountType; taxType: TaxType; rates: { gst: number; cgst: number; sgst: number } }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
      <Row label="Subtotal" value={formatINR(totals.subtotal)} />
      {totals.discountAmount > 0 && (
        <Row label={`Discount${discountType === 'percent' ? ` (${discount}%)` : ''}`} value={`- ${formatINR(totals.discountAmount)}`} />
      )}
      <Row label="Taxable Amount" value={formatINR(totals.taxable)} muted />
      {taxType === 'intra' && (
        <>
          <Row label={`CGST (${rates.cgst}%)`} value={formatINR(totals.cgst)} />
          <Row label={`SGST (${rates.sgst}%)`} value={formatINR(totals.sgst)} />
        </>
      )}
      {taxType === 'inter' && <Row label={`IGST (${rates.gst}%)`} value={formatINR(totals.igst)} />}
      <div className="pt-2 border-t border-border flex items-center justify-between">
        <span className="font-semibold">Grand Total</span>
        <span className="text-xl font-bold text-primary">{formatINR(totals.total)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(muted ? 'text-muted-foreground text-xs' : 'text-muted-foreground')}>{label}</span>
      <span className={cn('font-medium', muted && 'text-muted-foreground')}>{value}</span>
    </div>
  );
}

function PreviewContent({ client, items, totals, issueDate, expiryDate, quoteNumber, notes, rates, taxType, paymentAccount, terms }: {
  client?: { company_name: string; contact_person: string; email: string | null; gstin: string | null; address: string | null; phone?: string | null };
  items: LineItem[];
  totals: ReturnType<typeof calcTotals>;
  issueDate: string;
  expiryDate: string;
  quoteNumber: string;
  notes: string;
  rates?: { gst: number; cgst: number; sgst: number };
  taxType?: TaxType;
  paymentAccount?: PaymentAccount | null;
  terms?: string[] | null;
}) {
  const accent = useAccent();
  const rows: { label: string; value: string }[] = [
    { label: 'Subtotal', value: formatINR(totals.subtotal) },
  ];
  if (totals.discountAmount > 0) rows.push({ label: 'Discount', value: `- ${formatINR(totals.discountAmount)}` });
  if (totals.cgst > 0) rows.push({ label: `CGST${rates ? ` (${rates.cgst}%)` : ''}`, value: formatINR(totals.cgst) });
  if (totals.sgst > 0) rows.push({ label: `SGST${rates ? ` (${rates.sgst}%)` : ''}`, value: formatINR(totals.sgst) });
  if (totals.igst > 0) rows.push({ label: `IGST${rates ? ` (${rates.gst}%)` : ''}`, value: formatINR(totals.igst) });

  return (
    <div className="bg-white text-gray-900 rounded-lg p-6 sm:p-8" style={{ width: '210mm', minHeight: '297mm', maxWidth: '100%' }}>
      <DocHeader title="QUOTATION" docNumber={quoteNumber} accent={accent} />
      <div className="grid grid-cols-2 gap-4 mb-5">
        <DocClientBox label="Issued To" client={client as never} accent={accent} />
        <DocMetaBox
          accent={accent}
          rows={[
            { label: 'Quote Date', value: formatDate(issueDate) },
            { label: 'Valid Until', value: expiryDate ? formatDate(expiryDate) : 'N/A' },
          ]}
        />
      </div>
      <DocItemsTable items={items} accent={accent} />
      <DocTotals
        rows={rows}
        total={formatINR(totals.total)}
        accent={accent}
      />
      <DocFooter accent={accent} notes={notes} paymentAccount={paymentAccount} terms={terms} />
    </div>
  );
}

function PreviewDialog({ quote, onClose }: { quote: Quotation; onClose: () => void }) {
  const { clients, addQuotation } = useData();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [items, setItems] = useState<LineItem[]>([]);
  const [downloading, setDownloading] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const client = clients.find((c) => c.id === quote.client_id);
  const totals = { subtotal: Number(quote.subtotal), discountAmount: 0, taxable: 0, cgst: Number(quote.cgst), sgst: Number(quote.sgst), igst: Number(quote.igst), total: Number(quote.total) };
  const rates = { gst: settings.gstRate, cgst: settings.cgstRate, sgst: settings.sgstRate };

  useEffect(() => {
    supabase.from('quotation_items').select('*').eq('quotation_id', quote.id).then(({ data }) => setItems(data || []));
  }, [quote.id]);

  const handleDownload = async () => {
    if (!pdfRef.current) return;
    setDownloading(true);
    try {
      await downloadElementAsPDF(pdfRef.current, `Quotation-${quote.quote_number}.pdf`);
      toast({ title: 'PDF downloaded' });
    } catch {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
    setDownloading(false);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Quotation — {quote.quote_number}</span>
          </DialogTitle>
        </DialogHeader>
        <div ref={pdfRef}>
          <PreviewContent
            client={client}
            items={items}
            totals={totals}
            issueDate={quote.issue_date}
            expiryDate={quote.expiry_date || ''}
            quoteNumber={quote.quote_number}
            notes={quote.notes || ''}
            rates={rates}
            taxType={quote.tax_type}
            paymentAccount={settings.paymentAccounts.find((a) => a.id === quote.payment_account_id) || null}
            terms={quote.terms ? JSON.parse(quote.terms) : null}
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={handleDownload} className="gap-2" disabled={downloading}>
            <Download className="w-4 h-4" /> {downloading ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
