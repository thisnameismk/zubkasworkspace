export type DiscountType = 'flat' | 'percent';
export type TaxType = 'none' | 'intra' | 'inter';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partially_paid' | 'pending' | 'overdue';
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted';
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer';
export type PaymentStatus = 'partial' | 'full';

export interface Client {
  id: string;
  company_name: string;
  contact_person: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  created_at: string;
}

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Quotation {
  id: string;
  client_id: string;
  quote_number: string;
  issue_date: string;
  expiry_date: string | null;
  status: QuotationStatus;
  subtotal: number;
  discount: number;
  discount_type: DiscountType;
  tax_type: TaxType;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  notes: string | null;
  payment_account_id: string | null;
  terms: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  quotation_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  discount_type: DiscountType;
  tax_type: TaxType;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  notes: string | null;
  payment_account_id: string | null;
  terms: string | null;
  project_id: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  client_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference: string | null;
  status: PaymentStatus;
  receipt_number: string | null;
  created_at: string;
}

export interface ClientWithStats extends Client {
  invoice_count: number;
  total_invoiced: number;
  total_paid: number;
  outstanding: number;
}

export interface InvoiceWithClient extends Invoice {
  client?: Client;
  payments?: Payment[];
  paid_amount?: number;
  items?: LineItem[];
}

export interface QuotationWithClient extends Quotation {
  client?: Client;
  items?: LineItem[];
}

export interface IncomeCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionPaymentStatus = 'paid' | 'pending';

export interface Transaction {
  id: string;
  type: TransactionType;
  category_id: string | null;
  category_name: string | null;
  amount: number;
  transaction_date: string;
  description: string | null;
  payment_method: string | null;
  vendor: string | null;
  client_id: string | null;
  invoice_id: string | null;
  reference: string | null;
  payment_status: TransactionPaymentStatus;
  tax_included: boolean;
  tax_amount: number;
  attachment_url: string | null;
  is_auto_synced: boolean;
  project_id: string | null;
  created_at: string;
}

export type BillingCycle = 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
export type SubscriptionStatus = 'Active' | 'Pending' | 'Overdue' | 'Cancelled';

export interface SubscriptionCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  client_id: string;
  client_name: string | null;
  quotation_id: string | null;
  category_id: string | null;
  plan_name: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  billing_cycle: BillingCycle;
  start_date: string;
  end_date: string | null;
  renewal_date: string;
  status: SubscriptionStatus;
  created_at: string;
}

export type ProjectStatus = 'not_started' | 'in_progress' | 'on_hold' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Project {
  id: string;
  name: string;
  client_id: string;
  status: ProjectStatus;
  budget: number;
  start_date: string | null;
  due_date: string | null;
  description: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  sort_order: number;
  created_at: string;
}
