import { supabase } from '@/lib/supabase';
import { genNumber, parseDateLocal } from '@/lib/calc';
import type { Subscription, PaymentMethod } from '@/lib/types';

export interface SubSyncResult {
  receiptNumber?: string;
  newRenewalDate?: string;
  error?: string;
}

export async function ensureIncomeCategory(name: string): Promise<string | null> {
  const { data: existing } = await supabase.from('income_categories').select('id, name').eq('name', name).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('income_categories').insert({ name, color: '#0891b2' }).select().single();
  if (error || !created) return null;
  return created.id;
}

function genReceiptNumber(): string {
  return genNumber('RCP');
}

export function computeNextRenewalDate(currentRenewal: string, cycle: string): string {
  const d = parseDateLocal(currentRenewal);
  switch (cycle) {
    case 'Monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'Quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'Half-Yearly':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'Yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

export function computeRenewalDate(startDate: string, cycle: string): string {
  return computeNextRenewalDate(startDate, cycle);
}

export async function syncSubscriptionPayment(params: {
  subscription: Subscription;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
}): Promise<SubSyncResult> {
  const { subscription, amount, method, paymentDate, reference } = params;
  const receiptNumber = genReceiptNumber();
  const newRenewalDate = computeNextRenewalDate(subscription.renewal_date, subscription.billing_cycle);

  // 1. Record payment in payments table (linked to subscription via reference)
  const { error: payErr } = await supabase.from('payments').insert({
    client_id: subscription.client_id,
    amount,
    payment_method: method,
    payment_date: paymentDate,
    reference: reference || `SUB-${subscription.plan_name}`,
    status: 'full',
    receipt_number: receiptNumber,
  });
  if (payErr) return { error: 'Failed to record payment: ' + payErr.message };

  // 2. Sync income entry into accounting with category "Subscription Income"
  const catId = await ensureIncomeCategory('Subscription Income');
  if (catId) {
    await supabase.from('transactions').insert({
      type: 'income',
      category_id: catId,
      category_name: 'Subscription Income',
      amount,
      transaction_date: paymentDate,
      description: `Subscription payment — ${subscription.plan_name} (${subscription.billing_cycle})`,
      payment_method: method,
      client_id: subscription.client_id,
      reference: receiptNumber,
      payment_status: 'paid',
      is_auto_synced: true,
    });
  }

  // 3. Update subscription: shift renewal date, set status to Active
  const { error: updErr } = await supabase
    .from('subscriptions')
    .update({ renewal_date: newRenewalDate, status: 'Active' })
    .eq('id', subscription.id);
  if (updErr) return { error: 'Payment recorded but failed to update renewal: ' + updErr.message };

  return { receiptNumber, newRenewalDate };
}
