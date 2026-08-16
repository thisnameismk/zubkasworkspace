import { supabase } from '@/lib/supabase';
import { genNumber } from '@/lib/calc';
import type { Invoice, PaymentMethod } from '@/lib/types';

export interface SyncResult {
  paymentId?: string;
  receiptNumber?: string;
  projectId?: string;
  balanceDue?: number;
  invoiceStatus?: string;
  error?: string;
}

export async function ensureIncomeCategory(name: string): Promise<string | null> {
  const { data: existing } = await supabase.from('income_categories').select('id, name').eq('name', name).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('income_categories').insert({ name, color: '#10b981' }).select().single();
  if (error || !created) return null;
  return created.id;
}

function genReceiptNumber(): string {
  return genNumber('RCP');
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function syncPaymentAndAccounting(params: {
  invoice: Invoice;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
}): Promise<SyncResult> {
  const { invoice, amount, method, paymentDate, reference } = params;
  const receiptNumber = genReceiptNumber();

  // 1. Insert payment record with receipt number
  const { data: payment, error: payErr } = await supabase.from('payments').insert({
    invoice_id: invoice.id,
    client_id: invoice.client_id,
    amount,
    payment_method: method,
    payment_date: paymentDate,
    reference: reference || null,
    status: 'partial',
    receipt_number: receiptNumber,
  }).select().single();
  if (payErr || !payment) return { error: 'Failed to create payment' };

  // 2. Fetch all payments for this invoice to compute cumulative totals
  const { data: allPayments } = await supabase.from('payments').select('amount').eq('invoice_id', invoice.id);
  const totalReceived = (allPayments || []).reduce((s, p) => s + Number(p.amount), 0);
  const invoiceTotal = Number(invoice.total);
  const balanceDue = Math.max(0, invoiceTotal - totalReceived);
  const isFull = balanceDue <= 0;
  const invoiceStatus = isFull ? 'paid' : 'partially_paid';

  // Update the payment record status to 'full' if the invoice is now fully paid
  if (isFull) {
    await supabase.from('payments').update({ status: 'full' }).eq('id', payment.id);
  }

  // 3. Update invoice status
  await supabase.from('invoices').update({ status: invoiceStatus }).eq('id', invoice.id);

  // 3. Auto-sync income entry in accounting
  const catId = await ensureIncomeCategory('Invoice Payment');
  if (catId) {
    await supabase.from('transactions').insert({
      type: 'income',
      category_id: catId,
      category_name: 'Invoice Payment',
      amount,
      transaction_date: paymentDate,
      description: `Payment for invoice ${invoice.invoice_number}`,
      payment_method: method,
      client_id: invoice.client_id,
      invoice_id: invoice.id,
      reference: invoice.invoice_number,
      payment_status: 'paid',
      is_auto_synced: true,
    });
  }

  // 4. Auto-create project (on any payment including advance, avoid duplicates)
  let projectId: string | undefined;
  const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id);
  const { data: client } = await supabase.from('clients').select('company_name').eq('id', invoice.client_id).single();
  const primaryItem = items && items.length > 0 ? items[0].description : invoice.invoice_number;
  const clientName = client?.company_name || 'Unknown Client';
  const projectTitle = `${primaryItem} - ${clientName}`;
  const { data: existingProj } = await supabase.from('projects')
    .select('id').eq('client_id', invoice.client_id).eq('name', projectTitle).maybeSingle();
  if (existingProj) {
    projectId = existingProj.id;
  } else {
    const dueDate = addDays(paymentDate, 30);
    const { data: proj, error: projErr } = await supabase.from('projects').insert({
      name: projectTitle,
      client_id: invoice.client_id,
      status: 'in_progress',
      budget: Number(invoice.total),
      start_date: paymentDate,
      due_date: dueDate,
      description: `Auto-created from invoice ${invoice.invoice_number}`,
    }).select().single();
    if (!projErr && proj) {
      projectId = proj.id;
      await supabase.from('invoices').update({ project_id: proj.id }).eq('id', invoice.id);
      if (items && items.length > 0) {
        await supabase.from('tasks').insert(items.map((it, idx) => ({
          project_id: proj.id,
          title: it.description,
          status: 'completed',
          priority: 'medium',
          sort_order: idx,
        })));
      }
    }
  }

  return { paymentId: payment.id, receiptNumber, projectId, balanceDue, invoiceStatus };
}
