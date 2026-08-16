import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StatusBadge({ label, className, dot }: { label: string; className?: string; dot?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />}
      {label}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4 text-muted-foreground">
        {icon}
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
      <div className="h-4 w-24 bg-muted rounded mb-3" />
      <div className="h-8 w-32 bg-muted rounded" />
    </div>
  );
}
