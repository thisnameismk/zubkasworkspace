import { useState, useMemo } from 'react';
import { Plus, Users, Mail, Phone, Building2, MapPin, Pencil, Trash2, FileText, Receipt, Wallet } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDate } from '@/lib/calc';
import type { Client } from '@/lib/types';
import { PageHeader, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function Clients() {
  const { clients, invoices, payments, refresh, addClient } = useData();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ company_name: '', contact_person: '', email: '', phone: '', gstin: '', address: '' });

  const openNew = () => {
    setEditing(null);
    setForm({ company_name: '', contact_person: '', email: '', phone: '', gstin: '', address: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      company_name: c.company_name,
      contact_person: c.contact_person,
      email: c.email || '',
      phone: c.phone || '',
      gstin: c.gstin || '',
      address: c.address || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.company_name || !form.contact_person) {
      toast({ title: 'Company name and contact person are required', variant: 'destructive' });
      return;
    }
    const payload = { ...form, email: form.email || null, phone: form.phone || null, gstin: form.gstin || null, address: form.address || null };
    if (editing) {
      const { error } = await supabase.from('clients').update(payload).eq('id', editing.id);
      if (error) { console.error('[Supabase] Failed to update client:', error); toast({ title: 'Failed to update client', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Client updated' });
    } else {
      const res = await addClient(payload);
      if (!res) return;
      toast({ title: 'Client created' });
    }
    setDialogOpen(false);
    refresh();
  };

  const remove = async (c: Client) => {
    if (!confirm(`Delete ${c.company_name}? This also deletes their invoices and payments.`)) return;
    const { error } = await supabase.from('clients').delete().eq('id', c.id);
    if (error) { console.error('[Supabase] Failed to delete client:', error); toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Client deleted' });
    refresh();
  };

  const stats = useMemo(() => {
    const map: Record<string, { invoiced: number; paid: number; outstanding: number; count: number }> = {};
    clients.forEach((c) => (map[c.id] = { invoiced: 0, paid: 0, outstanding: 0, count: 0 }));
    invoices.forEach((inv) => {
      if (map[inv.client_id]) {
        map[inv.client_id].invoiced += Number(inv.total);
        map[inv.client_id].count += 1;
      }
    });
    payments.forEach((p) => {
      if (map[p.client_id]) map[p.client_id].paid += Number(p.amount);
    });
    Object.keys(map).forEach((k) => {
      map[k].outstanding = Math.max(0, map[k].invoiced - map[k].paid);
    });
    return map;
  }, [clients, invoices, payments]);

  const filtered = clients.filter((c) =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_person.toLowerCase().includes(search.toLowerCase()) ||
    (c.gstin || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Manage your client relationships and track outstanding balances"
        action={
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Add Client
          </Button>
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search by company, contact, or GSTIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="No clients yet"
          description="Add your first client to start creating quotations and invoices."
          action={<Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Add Client</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const s = stats[c.id] || { invoiced: 0, paid: 0, outstanding: 0 };
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-card p-5 animate-slide-up hover:shadow-lg transition-all group"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-blue-400 text-white shadow-md shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{c.company_name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{c.contact_person}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(c)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  {c.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{c.email}</span></div>}
                  {c.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5 shrink-0" /><span>{c.phone}</span></div>}
                  {c.gstin && <div className="flex items-center gap-2 text-muted-foreground"><FileText className="w-3.5 h-3.5 shrink-0" /><span className="font-mono text-xs">{c.gstin}</span></div>}
                  {c.address && <div className="flex items-start gap-2 text-muted-foreground"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span className="text-xs">{c.address}</span></div>}
                </div>

                <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Invoiced</p>
                    <p className="text-sm font-semibold">{formatINR(s.invoiced)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid</p>
                    <p className="text-sm font-semibold text-emerald-500">{formatINR(s.paid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Outstanding</p>
                    <p className={cn('text-sm font-semibold', s.outstanding > 0 ? 'text-amber-500' : 'text-emerald-500')}>{formatINR(s.outstanding)}</p>
                  </div>
                </div>

                <button
                  onClick={() => setHistoryClient(c)}
                  className="w-full mt-3 text-xs font-medium text-primary hover:underline"
                >
                  View history & details
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Company Name *</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Acme Corp" />
            </div>
            <div>
              <Label>Contact Person *</Label>
              <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="John Doe" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@acme.com" />
            </div>
            <div className="col-span-2">
              <Label>GSTIN</Label>
              <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="27ABCDE1234F1Z5" className="font-mono" />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Business Park, City, State - 400001" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyClient} onOpenChange={(v) => !v && setHistoryClient(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {historyClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  {historyClient.company_name}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm py-2">
                <Info label="Contact" value={historyClient.contact_person} />
                <Info label="Phone" value={historyClient.phone || '-'} />
                <Info label="Email" value={historyClient.email || '-'} />
                <Info label="GSTIN" value={historyClient.gstin || '-'} mono />
                <div className="col-span-2"><Info label="Address" value={historyClient.address || '-'} /></div>
              </div>
              <ClientHistory clientId={historyClient.id} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn('text-sm font-medium', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function ClientHistory({ clientId }: { clientId: string }) {
  const { invoices, payments } = useData();
  const clientInvoices = invoices.filter((i) => i.client_id === clientId);
  const clientPayments = payments.filter((p) => p.client_id === clientId);

  return (
    <div className="mt-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Receipt className="w-4 h-4" /> Invoices ({clientInvoices.length})</h4>
        {clientInvoices.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">No invoices yet.</p>
        ) : (
          <div className="space-y-1.5">
            {clientInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 text-sm">
                <div>
                  <p className="font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(inv.issue_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge label={inv.status} className="bg-muted text-muted-foreground" />
                  <span className="font-semibold">{formatINR(Number(inv.total))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Wallet className="w-4 h-4" /> Payments ({clientPayments.length})</h4>
        {clientPayments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">No payments yet.</p>
        ) : (
          <div className="space-y-1.5">
            {clientPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 text-sm">
                <div>
                  <p className="font-medium">{formatINR(Number(p.amount))}</p>
                  <p className="text-xs text-muted-foreground">{p.payment_method} · {formatDate(p.payment_date)}</p>
                </div>
                <StatusBadge label={p.status} className={p.status === 'full' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}