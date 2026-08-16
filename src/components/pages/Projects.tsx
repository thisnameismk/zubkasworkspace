import { useState, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, Pencil, FolderKanban, ArrowLeft, Calendar, Wallet, TrendingUp, TrendingDown,
  GripVertical, X, Receipt, ListChecks, KanbanSquare, Link2, FileText,
} from 'lucide-react';
import { useData } from '@/lib/data-context';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDate } from '@/lib/calc';
import { setInvoicePrefill } from '@/lib/prefill';
import type { Project, ProjectStatus, Task, TaskStatus, TaskPriority, Transaction } from '@/lib/types';
import type { Page } from '@/components/layout/Sidebar';
import { PageHeader, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const projectStatusConfig: Record<ProjectStatus, { label: string; className: string; dot: string }> = {
  not_started: { label: 'Not Started', className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', dot: 'bg-blue-500' },
  on_hold: { label: 'On Hold', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
};

const taskStatusConfig: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: 'To Do', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800/50' },
  in_progress: { label: 'In Progress', color: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  review: { label: 'Review', color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  completed: { label: 'Completed', color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
};

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  high: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
};

const KANBAN_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'review', 'completed'];

export function Projects({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { projects, clients, tasks, transactions, invoices, payments, refresh } = useData();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const selected = projects.find((p) => p.id === selectedId) || null;

  const projectTasks = useMemo(() => tasks.filter((t) => t.project_id === selectedId), [tasks, selectedId]);

  const projectFinance = useMemo(() => {
    if (!selected) return { income: 0, expense: 0, profit: 0, budget: 0, linkedTx: [], linkedInvoices: [] };
    const linkedTx = transactions.filter((t) => t.project_id === selected.id);
    const linkedInvoices = invoices.filter((i) => i.project_id === selected.id);
    const invoiceIds = linkedInvoices.map((i) => i.id);
    const invoicePayments = payments.filter((p) => invoiceIds.includes(p.invoice_id));
    const invoiceIncome = invoicePayments.reduce((s, p) => s + Number(p.amount), 0);
    const manualIncome = linkedTx.filter((t) => t.type === 'income' && t.payment_status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
    const income = invoiceIncome + manualIncome;
    const expense = linkedTx.filter((t) => t.type === 'expense' && t.payment_status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
    return { income, expense, profit: income - expense, budget: Number(selected.budget), linkedTx, linkedInvoices };
  }, [selected, transactions, invoices, payments]);

  const removeProject = async (id: string) => {
    if (!confirm('Delete this project and all its tasks?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { console.error('[Supabase] Failed to delete project:', error); toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Project deleted' });
    if (selectedId === id) setSelectedId(null);
    refresh();
  };

  const createInvoiceFromProject = () => {
    if (!selected) return;
    const client = clients.find((c) => c.id === selected.client_id);
    setInvoicePrefill({
      clientId: selected.client_id,
      projectId: selected.id,
      projectName: selected.name,
      budget: Number(selected.budget),
      description: selected.description || undefined,
    });
    onNavigate('invoices');
    toast({ title: `Invoice builder pre-filled for ${client?.company_name || 'project'}` });
  };

  // === Detail View ===
  if (selected) {
    return (
      <ProjectDetail
        project={selected}
        tasks={projectTasks}
        finance={projectFinance}
        clients={clients}
        onBack={() => setSelectedId(null)}
        onEdit={() => { setEditing(selected); setAddOpen(true); }}
        onDelete={() => removeProject(selected.id)}
        onCreateInvoice={createInvoiceFromProject}
        onRefresh={refresh}
      />
    );
  }

  // === List View ===
  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Manage projects, track tasks, and monitor profitability"
        action={<Button onClick={() => { setEditing(null); setAddOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> New Project</Button>}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-8 h-8" />}
          title="No projects yet"
          description="Create a project linked to a client to start tracking tasks and profitability."
          action={<Button onClick={() => { setEditing(null); setAddOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> New Project</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p, i) => {
            const client = clients.find((c) => c.id === p.client_id);
            const pTasks = tasks.filter((t) => t.project_id === p.id);
            const done = pTasks.filter((t) => t.status === 'completed').length;
            const progress = pTasks.length > 0 ? (done / pTasks.length) * 100 : 0;
            const cfg = projectStatusConfig[p.status as ProjectStatus] || projectStatusConfig.not_started;
            return (
              <Card key={p.id} className="animate-slide-up cursor-pointer hover:shadow-lg transition-shadow" style={{ animationDelay: `${i * 40}ms` }} onClick={() => setSelectedId(p.id)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{client?.company_name || 'No client'}</p>
                    </div>
                    <StatusBadge label={cfg.label} className={cfg.className} dot={cfg.dot} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {p.due_date ? formatDate(p.due_date) : 'No due date'}</span>
                    <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> {formatINR(Number(p.budget))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{done}/{pTasks.length}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {addOpen && (
        <ProjectDialog
          editing={editing}
          onClose={() => { setAddOpen(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ===================== Project Detail =====================

function ProjectDetail({
  project, tasks, finance, clients, onBack, onEdit, onDelete, onCreateInvoice, onRefresh,
}: {
  project: Project;
  tasks: Task[];
  finance: { income: number; expense: number; profit: number; budget: number; linkedTx: Transaction[]; linkedInvoices: any[] };
  clients: any[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateInvoice: () => void;
  onRefresh: () => void;
}) {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const { toast } = useToast();
  const { expenseCategories } = useData();

  const client = clients.find((c) => c.id === project.client_id);
  const cfg = projectStatusConfig[project.status as ProjectStatus] || projectStatusConfig.not_started;
  const done = tasks.filter((t) => t.status === 'completed').length;
  const progress = tasks.length > 0 ? (done / tasks.length) * 100 : 0;

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);
    if (error) { console.error('[Supabase] Failed to update task:', error); toast({ title: 'Failed to update task', description: error.message, variant: 'destructive' }); return; }
    onRefresh();
  };

  const removeTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) { console.error('[Supabase] Failed to delete task:', error); toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    onRefresh();
  };

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const onDrop = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) updateTaskStatus(taskId, status);
  }, [project.id]);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </button>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <StatusBadge label={cfg.label} className={cfg.className} dot={cfg.dot} />
            </div>
            <p className="text-sm text-muted-foreground">{client?.company_name || 'No client'}{project.description ? ` — ${project.description}` : ''}</p>
            <div className="flex items-center gap-5 mt-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Start: {project.start_date ? formatDate(project.start_date) : '-'}</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Due: {project.due_date ? formatDate(project.due_date) : '-'}</span>
              <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Budget: {formatINR(finance.budget)}</span>
            </div>
            <div className="flex items-center gap-2 mt-4 max-w-xs">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{done}/{tasks.length} tasks</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={onCreateInvoice} className="gap-2"><Receipt className="w-4 h-4" /> Create Invoice</Button>
            <Button variant="outline" onClick={onEdit} className="gap-2"><Pencil className="w-4 h-4" /> Edit</Button>
            <Button variant="outline" onClick={() => setLinkDialogOpen(true)} className="gap-2"><Link2 className="w-4 h-4" /> Link Expense</Button>
            <Button variant="outline" onClick={onDelete} className="gap-2 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <FinanceCard label="Project Budget" value={formatINR(finance.budget)} icon={Wallet} color="from-blue-500 to-cyan-600" />
        <FinanceCard label="Project Income" value={formatINR(finance.income)} icon={TrendingUp} color="from-emerald-500 to-green-600" />
        <FinanceCard label="Project Expenses" value={formatINR(finance.expense)} icon={TrendingDown} color="from-red-500 to-rose-600" />
        <FinanceCard label="Net Profit / Loss" value={formatINR(finance.profit)} icon={Wallet} color={finance.profit >= 0 ? 'from-violet-500 to-purple-600' : 'from-orange-500 to-red-600'} />
      </div>

      {/* Tasks Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <div className="flex gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as 'kanban' | 'list')}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-1.5"><KanbanSquare className="w-4 h-4" /> Kanban</TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5"><ListChecks className="w-4 h-4" /> List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => { setEditingTask(null); setTaskDialogOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add Task</Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col);
            const colCfg = taskStatusConfig[col];
            return (
              <div
                key={col}
                className={cn('rounded-xl border border-border p-3 min-h-[200px]', colCfg.bg)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, col)}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className={cn('text-sm font-semibold', colCfg.color)}>{colCfg.label}</span>
                  <span className="text-xs text-muted-foreground bg-card rounded-full px-2 py-0.5">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((t) => {
                    const pCfg = priorityConfig[t.priority as TaskPriority] || priorityConfig.medium;
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, t.id)}
                        className="rounded-lg bg-card border border-border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium flex-1">{t.title}</p>
                          <GripVertical className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                        </div>
                        {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', pCfg.className)}>{pCfg.label}</span>
                          {t.due_date && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Calendar className="w-3 h-3" />{formatDate(t.due_date)}</span>}
                          {t.assigned_to && <span className="text-[10px] text-muted-foreground">{t.assigned_to}</span>}
                        </div>
                        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => removeTask(t.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 text-center py-4">Drop tasks here</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Title</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Priority</th>
                  <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Due Date</th>
                  <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Assigned To</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No tasks yet</td></tr>
                ) : tasks.map((t) => {
                  const sCfg = taskStatusConfig[t.status as TaskStatus] || taskStatusConfig.todo;
                  const pCfg = priorityConfig[t.priority as TaskPriority] || priorityConfig.medium;
                  return (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{t.title}</td>
                      <td className="py-3 px-4">
                        <Select value={t.status} onValueChange={(v) => updateTaskStatus(t.id, v as TaskStatus)}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {KANBAN_COLUMNS.map((s) => <SelectItem key={s} value={s}>{taskStatusConfig[s].label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-4"><span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', pCfg.className)}>{pCfg.label}</span></td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{t.due_date ? formatDate(t.due_date) : '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{t.assigned_to || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => removeTask(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Linked Transactions */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Link2 className="w-4 h-4" /> Linked Transactions</h3>
        {finance.linkedTx.length === 0 && finance.linkedInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No transactions linked. Use "Link Expense" to attach costs to this project.</p>
        ) : (
          <div className="space-y-2">
            {finance.linkedInvoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium">{inv.invoice_number}</span>
                  <span className="text-xs text-muted-foreground">Invoice</span>
                </div>
                <span className="text-sm font-semibold text-emerald-600">{formatINR(Number(inv.total))}</span>
              </div>
            ))}
            {finance.linkedTx.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  <span className={cn('w-6 h-6 rounded-full flex items-center justify-center', t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600')}>
                    {t.type === 'income' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  </span>
                  <span className="text-sm font-medium">{t.category_name || t.description || 'Transaction'}</span>
                </div>
                <span className={cn('text-sm font-semibold', t.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                  {t.type === 'income' ? '+' : '-'} {formatINR(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {taskDialogOpen && (
        <TaskDialog
          projectId={project.id}
          editing={editingTask}
          onClose={() => { setTaskDialogOpen(false); setEditingTask(null); onRefresh(); }}
        />
      )}

      {linkDialogOpen && (
        <LinkExpenseDialog
          projectId={project.id}
          onClose={() => { setLinkDialogOpen(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ===================== Sub-components =====================

function FinanceCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Wallet; color: string }) {
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

function ProjectDialog({ editing, onClose }: { editing: Project | null; onClose: () => void }) {
  const { clients } = useData();
  const { toast } = useToast();
  const [name, setName] = useState(editing?.name || '');
  const [clientId, setClientId] = useState(editing?.client_id || '');
  const [status, setStatus] = useState<ProjectStatus>(editing?.status as ProjectStatus || 'not_started');
  const [budget, setBudget] = useState(editing ? String(editing.budget) : '');
  const [startDate, setStartDate] = useState(editing?.start_date || '');
  const [dueDate, setDueDate] = useState(editing?.due_date || '');
  const [description, setDescription] = useState(editing?.description || '');

  const save = async () => {
    if (!name.trim() || !clientId) { toast({ title: 'Name and client are required', variant: 'destructive' }); return; }
    const payload = {
      name: name.trim(),
      client_id: clientId,
      status,
      budget: Number(budget) || 0,
      start_date: startDate || null,
      due_date: dueDate || null,
      description: description || null,
    };
    if (editing) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editing.id);
      if (error) { console.error('[Supabase] Failed to update project:', error); toast({ title: 'Failed to update', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Project updated' });
    } else {
      const { error } = await supabase.from('projects').insert(payload);
      if (error) { console.error('[Supabase] Failed to create project:', error); toast({ title: 'Failed to create', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Project created' });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Edit Project' : 'New Project'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Project Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Website Redesign" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Budget (₹)</Label>
              <Input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Project scope and notes..." className="mt-1 min-h-[70px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Create'} Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ projectId, editing, onClose }: { projectId: string; editing: Task | null; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [status, setStatus] = useState<TaskStatus>(editing?.status as TaskStatus || 'todo');
  const [priority, setPriority] = useState<TaskPriority>(editing?.priority as TaskPriority || 'medium');
  const [dueDate, setDueDate] = useState(editing?.due_date || '');
  const [assignedTo, setAssignedTo] = useState(editing?.assigned_to || '');

  const save = async () => {
    if (!title.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    const payload = {
      project_id: projectId,
      title: title.trim(),
      description: description || null,
      status,
      priority,
      due_date: dueDate || null,
      assigned_to: assignedTo || null,
      sort_order: editing?.sort_order || 0,
    };
    if (editing) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editing.id);
      if (error) { console.error('[Supabase] Failed to update task:', error); toast({ title: 'Failed to update', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Task updated' });
    } else {
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) { console.error('[Supabase] Failed to add task:', error); toast({ title: 'Failed to add', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Task added' });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? 'Edit Task' : 'Add Task'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Design homepage mockup" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details..." className="mt-1 min-h-[60px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KANBAN_COLUMNS.map((s) => <SelectItem key={s} value={s}>{taskStatusConfig[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Assigned To</Label>
              <Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Team member" className="mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Add'} Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkExpenseDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { transactions, expenseCategories } = useData();
  const { toast } = useToast();
  const [selectedTx, setSelectedTx] = useState('');

  // Unlinked expense transactions
  const unlinkedExpenses = transactions.filter((t) => t.type === 'expense' && !t.project_id);

  const link = async () => {
    if (!selectedTx) { toast({ title: 'Select a transaction', variant: 'destructive' }); return; }
    const { error } = await supabase.from('transactions').update({ project_id: projectId }).eq('id', selectedTx);
    if (error) { console.error('[Supabase] Failed to link expense:', error); toast({ title: 'Failed to link', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Expense linked to project' });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Link Expense to Project</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {unlinkedExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No unlinked expense transactions available. Add expenses in the Accounting module first.</p>
          ) : (
            <>
              <div>
                <Label className="text-xs">Select Expense Transaction</Label>
                <Select value={selectedTx} onValueChange={setSelectedTx}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose an expense" /></SelectTrigger>
                  <SelectContent>
                    {unlinkedExpenses.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {formatDate(t.transaction_date)} — {t.category_name || 'Uncategorized'} — {formatINR(Number(t.amount))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">The selected expense will be counted toward this project's costs for profitability calculation.</p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {unlinkedExpenses.length > 0 && <Button onClick={link} className="gap-2"><Link2 className="w-4 h-4" /> Link Expense</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
