import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Client, Invoice, Payment, Quotation, IncomeCategory, ExpenseCategory, Transaction, Project, Task } from '@/lib/types';

export interface DataState {
  clients: Client[];
  quotations: Quotation[];
  invoices: Invoice[];
  payments: Payment[];
  incomeCategories: IncomeCategory[];
  expenseCategories: ExpenseCategory[];
  transactions: Transaction[];
  projects: Project[];
  tasks: Task[];
  loading: boolean;
  refresh: () => Promise<void>;
  addClient: (client: Partial<Client>) => Promise<any>;
  addInvoice: (invoice: Record<string, any>, items?: { description: string; quantity: number; rate: number; amount: number }[]) => Promise<any>;
  addQuotation: (quotation: Record<string, any>, items?: { description: string; quantity: number; rate: number; amount: number }[]) => Promise<any>;
}

export const DataContext = createContext<DataState>({
  clients: [],
  quotations: [],
  invoices: [],
  payments: [],
  incomeCategories: [],
  expenseCategories: [],
  transactions: [],
  projects: [],
  tasks: [],
  loading: true,
  refresh: async () => {},
  addClient: async () => {},
  addInvoice: async () => {},
  addQuotation: async () => {},
});

export function useData() {
  return useContext(DataContext);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const [c, q, i, p, ic, ec, t, pr, tk] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('quotations').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('income_categories').select('*').order('name', { ascending: true }),
      supabase.from('expense_categories').select('*').order('name', { ascending: true }),
      supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').order('sort_order', { ascending: true }),
    ]);

    setClients(c.data || []);
    setQuotations(q.data || []);
    setInvoices(i.data || []);
    setPayments(p.data || []);
    setIncomeCategories(ic.data || []);
    setExpenseCategories(ec.data || []);
    setTransactions(t.data || []);
    setProjects(pr.data || []);
    setTasks(tk.data || []);
    setLoading(false);
  };

  const addClient = async (clientData: Partial<Client>) => {
    const { data, error } = await supabase.from('clients').insert([clientData]).select();
    if (error) {
      alert('Supabase Error: ' + error.message);
      return null;
    }
    await refresh();
    return data;
  };

  const addInvoice = async (invoiceData: Record<string, any>, items?: { description: string; quantity: number; rate: number; amount: number }[]) => {
    const { data, error } = await supabase.from('invoices').insert([invoiceData]).select();
    if (error || !data?.length) {
      const message = error?.message || 'No invoice row was returned';
      alert('Supabase Error: ' + message);
      return null;
    }
    const inv = data[0];
    if (items && items.length > 0) {
      const { error: itemError } = await supabase.from('invoice_items').insert(items.map((it) => ({ invoice_id: inv.id, description: it.description, quantity: it.quantity, rate: it.rate, amount: it.amount })));
      if (itemError) alert('Supabase Error (items): ' + itemError.message);
    }
    await refresh();
    return inv;
  };

  const addQuotation = async (quotationData: Record<string, any>, items?: { description: string; quantity: number; rate: number; amount: number }[]) => {
    const { data, error } = await supabase.from('quotations').insert([quotationData]).select();
    if (error || !data?.length) {
      const message = error?.message || 'No quotation row was returned';
      alert('Supabase Error: ' + message);
      return null;
    }
    const quote = data[0];
    if (items && items.length > 0) {
      const { error: itemError } = await supabase.from('quotation_items').insert(items.map((it) => ({ quotation_id: quote.id, description: it.description, quantity: it.quantity, rate: it.rate, amount: it.amount })));
      if (itemError) alert('Supabase Error (items): ' + itemError.message);
    }
    await refresh();
    return quote;
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <DataContext.Provider value={{ clients, quotations, invoices, payments, incomeCategories, expenseCategories, transactions, projects, tasks, loading, refresh, addClient, addInvoice, addQuotation }}>
      {children}
    </DataContext.Provider>
  );
}
