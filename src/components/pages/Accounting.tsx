import { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Wallet, Tag, Upload, X, Receipt as ReceiptIcon, CircleArrowDown as ArrowDownCircle, CircleArrowUp as ArrowUpCircle } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDate } from '@/lib/calc';
import type { Transaction, TransactionType, IncomeCategory, ExpenseCategory } from '@/lib/types';
import { PageHeader, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444', '#f97316', '#6366f1'];

export function Accounting() {
  const { transactions, incomeCategories, expenseCategories, clients, invoices, refresh } = useData();
  const { toast } = useToast();
  const [tab, setTab] = useState<'transactions' | 'categories'>('transactions');
  const [addOpen, setAddOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income' && t.payment_status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter((t) => t.type === 'expense' && t.payment_status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
    const pending = transactions.filter((t) => t.payment_status === 'pending').reduce((s, t) => s + Number(t.amount), 0);
    const net = income - expense;
    return { income, expense, net, pending };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        const client = clients.find((c) => c.id === t.client_id);
        return (
          (t.description || '').toLowerCase().includes(q) ||
          (t.vendor || '').toLowerCase().includes(q) ||
          (t.category_name || '').toLowerCase().includes(q) ||
          (client?.company_name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, filterType, search, clients]);

  const removeTx = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { console.error('[Supabase] Failed to delete transaction:', error); toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Transaction deleted' });
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Accounting"
        subtitle="Track income and expenses, manage categories, and monitor cash flow"
        action={
          <Button onClick={() => { setEditingTx(null); setAddOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Transaction
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Income" value={formatINR(stats.income)} icon={TrendingUp} color="from-emerald-500 to-green-600" />
        <SummaryCard label="Total Expense" value={formatINR(stats.expense)} icon={TrendingDown} color="from-red-500 to-rose-600" />
        <SummaryCard label="Net Profit / Loss" value={formatINR(stats.net)} icon={Wallet} color={stats.net >= 0 ? 'from-blue-500 to-cyan-600' : 'from-orange-500 to-red-600'} />
        <SummaryCard label="Pending Payments" value={formatINR(stats.pending)} icon={ReceiptIcon} color="from-amber-500 to-orange-600" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="transactions" className="gap-1.5"><ReceiptIcon className="w-4 h-4" /> Transactions</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Tag className="w-4 h-4" /> Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
            <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<ReceiptIcon className="w-8 h-8" />} title="No transactions yet" description="Add income or expense entries to start tracking your finances." action={<Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Add Transaction</Button>} />
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden animate-slide-up">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Type</th>
                      <th className="text-left py-3 px-4 font-medium">Category</th>
                      <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Description</th>
                      <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Vendor / Client</th>
                      <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Status</th>
                      <th className="text-right py-3 px-4 font-medium">Amount</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => {
                      const client = clients.find((c) => c.id === t.client_id);
                      const isIncome = t.type === 'income';
                      return (
                        <tr key={t.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                          <td className="py-3 px-4">
                            <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', isIncome ? 'text-emerald-600' : 'text-red-600')}>
                              {isIncome ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                              {isIncome ? 'Income' : 'Expense'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(t, incomeCategories, expenseCategories) }} />
                              {t.category_name || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4 hidden md:table-cell text-muted-foreground max-w-[200px] truncate">{t.description || '-'}</td>
                          <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">{t.vendor || client?.company_name || '-'}</td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <StatusBadge
                              label={t.payment_status === 'paid' ? 'Paid' : 'Pending'}
                              className={t.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}
                            />
                          </td>
                          <td className={cn('py-3 px-4 text-right font-semibold whitespace-nowrap', isIncome ? 'text-emerald-600' : 'text-red-600')}>
                            {isIncome ? '+' : '-'} {formatINR(Number(t.amount))}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {t.is_auto_synced && <span className="text-xs text-muted-foreground mr-1" title="Auto-synced from payment">auto</span>}
                              <button onClick={() => { setEditingTx(t); setAddOpen(true); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => removeTx(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
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

      {addOpen && (
        <TransactionDialog
          editing={editingTx}
          onClose={() => { setAddOpen(false); setEditingTx(null); refresh(); }}
        />
      )}
    </div>
  );
}

function getCategoryColor(t: Transaction, incomeCats: IncomeCategory[], expenseCats: ExpenseCategory[]) {
  const cats = t.type === 'income' ? incomeCats : expenseCats;
  const cat = cats.find((c) => c.id === t.category_id);
  return cat?.color || '#6b7280';
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof TrendingUp; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <div className={cn('flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br text-white shadow-lg', color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function TransactionDialog({ editing, onClose }: { editing: Transaction | null; onClose: () => void }) {
  const { incomeCategories, expenseCategories, clients, invoices } = useData();
  const { toast } = useToast();
  const [type, setType] = useState<TransactionType>(editing?.type || 'income');
  const [categoryId, setCategoryId] = useState(editing?.category_id || '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [date, setDate] = useState(editing?.transaction_date || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(editing?.description || '');
  const [paymentMethod, setPaymentMethod] = useState(editing?.payment_method || 'UPI');
  const [vendor, setVendor] = useState(editing?.vendor || '');
  const [clientId, setClientId] = useState(editing?.client_id || '');
  const [reference, setReference] = useState(editing?.reference || '');
  const [paymentStatus, setPaymentStatus] = useState(editing?.payment_status || 'paid');
  const [taxIncluded, setTaxIncluded] = useState(editing?.tax_included || false);
  const [taxAmount, setTaxAmount] = useState(editing ? String(editing.tax_amount) : '');
  const [attachmentUrl, setAttachmentUrl] = useState(editing?.attachment_url || '');

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast({ title: 'File too large (max 2MB)', variant: 'destructive' }); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachmentUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!amount || !categoryId) { toast({ title: 'Amount and category are required', variant: 'destructive' }); return; }
    const amt = Number(amount);
    if (amt <= 0) { toast({ title: 'Amount must be positive', variant: 'destructive' }); return; }
    const cat = categories.find((c) => c.id === categoryId);
    const payload = {
      type,
      category_id: categoryId,
      category_name: cat?.name || null,
      amount: amt,
      transaction_date: date,
      description: description || null,
      payment_method: paymentMethod,
      vendor: vendor || null,
      client_id: clientId || null,
      reference: reference || null,
      payment_status: paymentStatus,
      tax_included: taxIncluded,
      tax_amount: Number(taxAmount) || 0,
      attachment_url: attachmentUrl || null,
    };
    if (editing) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id);
      if (error) { console.error('[Supabase] Failed to update transaction:', error); toast({ title: 'Failed to update', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Transaction updated' });
    } else {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) { console.error('[Supabase] Failed to add transaction:', error); toast({ title: 'Failed to add', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Transaction added' });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setType('income'); setCategoryId(''); }} className={cn('flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 transition-all', type === 'income' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'border-border hover:bg-muted')}>
              <ArrowUpCircle className="w-4 h-4" /> Income
            </button>
            <button onClick={() => { setType('expense'); setCategoryId(''); }} className={cn('flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 transition-all', type === 'expense' ? 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-600' : 'border-border hover:bg-muted')}>
              <ArrowDownCircle className="w-4 h-4" /> Expense
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount (₹) *</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes..." className="mt-1 min-h-[60px]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{type === 'expense' ? 'Vendor / Payee' : 'Client'}</Label>
              {type === 'income' ? (
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor name" className="mt-1" />
              )}
            </div>
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Reference No.</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR, cheque no..." className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Payment Status</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as 'paid' | 'pending')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending / Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === 'expense' && (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tax-incl" checked={taxIncluded} onChange={(e) => setTaxIncluded(e.target.checked)} className="w-4 h-4 rounded" />
                <Label htmlFor="tax-incl" className="text-xs cursor-pointer">Tax Included</Label>
              </div>
              {taxIncluded && (
                <div>
                  <Label className="text-xs">Tax Amount (₹)</Label>
                  <Input type="number" min="0" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="0.00" className="mt-1" />
                </div>
              )}
            </div>
          )}

          {/* Attachment */}
          <div>
            <Label className="text-xs">Receipt / Invoice Attachment</Label>
            <div className="flex gap-2 mt-1">
              <Input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="URL or upload" className="flex-1" />
              <label className="cursor-pointer">
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors h-full">
                  <Upload className="w-3.5 h-3.5" /> Upload
                </span>
              </label>
            </div>
            {attachmentUrl && (
              <button onClick={() => setAttachmentUrl('')} className="text-xs text-destructive mt-1 flex items-center gap-1">
                <X className="w-3 h-3" /> Remove attachment
              </button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Add'} Transaction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryManager() {
  const { incomeCategories, expenseCategories, refresh } = useData();
  const { toast } = useToast();
  const [catTab, setCatTab] = useState<'income' | 'expense'>('income');
  const [addOpen, setAddOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<(IncomeCategory | ExpenseCategory) | null>(null);

  const cats = catTab === 'income' ? incomeCategories : expenseCategories;
  const table = catTab === 'income' ? 'income_categories' : 'expense_categories';

  const removeCat = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { console.error('[Supabase] Failed to delete category:', error); toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Category deleted' });
    refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Tabs value={catTab} onValueChange={(v) => setCatTab(v as 'income' | 'expense')}>
          <TabsList>
            <TabsTrigger value="income" className="gap-1.5"><TrendingUp className="w-4 h-4" /> Income</TabsTrigger>
            <TabsTrigger value="expense" className="gap-1.5"><TrendingDown className="w-4 h-4" /> Expense</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => { setEditingCat(null); setAddOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add Category</Button>
      </div>

      {cats.length === 0 ? (
        <EmptyState icon={<Tag className="w-8 h-8" />} title="No categories" description={`Add ${catTab} categories to organize your transactions.`} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cats.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between animate-slide-up">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg" style={{ backgroundColor: c.color }} />
                <span className="font-medium">{c.name}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditingCat(c); setAddOpen(true); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => removeCat(c.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <CategoryDialog
          type={catTab}
          editing={editingCat}
          onClose={() => { setAddOpen(false); setEditingCat(null); refresh(); }}
        />
      )}
    </div>
  );
}

function CategoryDialog({ type, editing, onClose }: { type: 'income' | 'expense'; editing: IncomeCategory | ExpenseCategory | null; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(editing?.name || '');
  const [color, setColor] = useState(editing?.color || CATEGORY_COLORS[0]);
  const table = type === 'income' ? 'income_categories' : 'expense_categories';

  const save = async () => {
    if (!name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    const payload = { name: name.trim(), color };
    if (editing) {
      const { error } = await supabase.from(table).update(payload).eq('id', editing.id);
      if (error) { console.error('[Supabase] Failed to update category:', error); toast({ title: 'Failed to update', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Category updated' });
    } else {
      const { error } = await supabase.from(table).insert(payload);
      if (error) { console.error('[Supabase] Failed to add category:', error); toast({ title: 'Failed to add', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Category added' });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office Rent" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Color</Label>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {CATEGORY_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={cn('w-8 h-8 rounded-lg transition-all', color === c ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110')} style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
