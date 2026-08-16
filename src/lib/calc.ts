import type { DiscountType, LineItem, TaxType } from './types';

export function lineAmount(qty: number, rate: number): number {
  return Math.round(qty * rate * 100) / 100;
}

export function calcSubtotal(items: LineItem[]): number {
  return items.reduce((sum, it) => sum + lineAmount(it.quantity, it.rate), 0);
}

export function calcDiscountAmount(subtotal: number, discount: number, type: DiscountType): number {
  if (type === 'percent') return Math.round((subtotal * (discount || 0)) / 100 * 100) / 100;
  return Math.round((discount || 0) * 100) / 100;
}

export interface Totals {
  subtotal: number;
  discountAmount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export function calcTotals(
  items: LineItem[],
  discount: number,
  discountType: DiscountType,
  taxType: TaxType,
  rates?: { gst: number; cgst: number; sgst: number },
): Totals {
  const gst = rates?.gst ?? 18;
  const cgstRate = rates?.cgst ?? gst / 2;
  const sgstRate = rates?.sgst ?? gst / 2;
  const subtotal = calcSubtotal(items);
  const discountAmount = calcDiscountAmount(subtotal, discount, discountType);
  const taxable = Math.round((subtotal - discountAmount) * 100) / 100;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (taxType === 'intra') {
    cgst = Math.round(taxable * (cgstRate / 100) * 100) / 100;
    sgst = Math.round(taxable * (sgstRate / 100) * 100) / 100;
  } else if (taxType === 'inter') {
    igst = Math.round(taxable * (gst / 100) * 100) / 100;
  }
  const total = Math.round((taxable + cgst + sgst + igst) * 100) / 100;
  return { subtotal, discountAmount, taxable, cgst, sgst, igst, total };
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);
}

export function formatDate(d: string | null): string {
  if (!d) return '-';
  return parseDateLocal(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function parseDateLocal(d: string | Date): Date {
  if (d instanceof Date) return d;
  if (!d) return new Date(NaN);
  const s = d.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

export function genNumber(prefix: string): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}/${yy}${mm}/${rand}`;
}
