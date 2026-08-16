import type { InvoiceStatus, PaymentMethod, PaymentStatus, QuotationStatus } from './types';

export const invoiceStatusConfig: Record<InvoiceStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', dot: 'bg-blue-500' },
  paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  partially_paid: { label: 'Partially Paid', className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', dot: 'bg-orange-500' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', dot: 'bg-red-500' },
};

export const quoteStatusConfig: Record<QuotationStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', dot: 'bg-blue-500' },
  accepted: { label: 'Accepted', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', dot: 'bg-red-500' },
  converted: { label: 'Converted', className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', dot: 'bg-violet-500' },
};

export const paymentStatusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  partial: { label: 'Partial', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  full: { label: 'Full', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
};

export const paymentMethodConfig: Record<PaymentMethod, { label: string; icon: string }> = {
  Cash: { label: 'Cash', icon: 'banknote' },
  UPI: { label: 'UPI', icon: 'smartphone' },
  'Bank Transfer': { label: 'Bank Transfer', icon: 'building-2' },
};
