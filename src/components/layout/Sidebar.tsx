import { useState } from 'react';
import { LayoutDashboard, Users, FileText, Receipt, Wallet, BarChart3, Menu, X, Moon, Sun, ChevronLeft, Zap, Settings, LogOut, Calculator, FolderKanban } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export type Page = 'dashboard' | 'clients' | 'quotations' | 'invoices' | 'payments' | 'accounting' | 'projects' | 'reports' | 'settings';

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'quotations', label: 'Quotations', icon: FileText },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'accounting', label: 'Accounting', icon: Calculator },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface Props {
  page: Page;
  setPage: (p: Page) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

export function Sidebar({ page, setPage, collapsed, setCollapsed, mobileOpen, setMobileOpen }: Props) {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();

  const go = (p: Page) => {
    setPage(p);
    setMobileOpen(false);
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={cn(
          'fixed lg:sticky top-0 z-40 h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
          'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-400 shrink-0 shadow-lg shadow-primary/30">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm leading-tight">Zubkas</p>
              <p className="text-[11px] text-sidebar-foreground/60 leading-tight">Workspace</p>
            </div>
          )}
          <button className="ml-auto lg:hidden text-sidebar-foreground/70" onClick={() => setMobileOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative',
                  active
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground',
                  collapsed && 'lg:justify-center',
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/10 space-y-1">
          <button
            onClick={toggle}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground transition-all',
              collapsed && 'lg:justify-center',
            )}
            title={collapsed ? 'Toggle theme' : undefined}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button
            onClick={logout}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300/80 hover:bg-red-500/10 hover:text-red-300 transition-all',
              collapsed && 'lg:justify-center',
            )}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground transition-all',
              collapsed && 'justify-center',
            )}
          >
            <ChevronLeft className={cn('w-5 h-5 shrink-0 transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && <span>Collapse</span>}
          </button>
          {!collapsed && (
            <p className="text-[10px] text-sidebar-foreground/40 text-center pt-2 leading-tight">
              &copy; {new Date().getFullYear()} Zubkas Workspace<br />Powered by Zubkas Technology Pvt. Ltd.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}

export function MobileTopBar({ setMobileOpen, title }: { setMobileOpen: (v: boolean) => void; title: string }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="lg:hidden sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 h-14">
      <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2">
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-blue-400 shadow-md shadow-primary/20">
          <Zap className="w-4 h-4 text-white" fill="white" />
        </div>
        <span className="font-bold text-sm">Zubkas Workspace</span>
      </div>
      <button onClick={toggle} className="p-2 -mr-2">
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </div>
  );
}

export function MobileBottomNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const bottomItems = navItems.slice(0, 5);
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-background/90 backdrop-blur-md border-t border-border">
      <div className="flex items-center justify-around h-16 px-2">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={cn(
                'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'scale-110')} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function useCollapsed() {
  return useState(false);
}
