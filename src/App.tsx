import { useState } from 'react';
import { ThemeProvider } from '@/lib/theme';
import { SettingsProvider } from '@/lib/settings';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/data-context';
import { Sidebar, MobileTopBar, MobileBottomNav, type Page } from '@/components/layout/Sidebar';
import { Login } from '@/components/pages/Login';
import { Dashboard } from '@/components/pages/Dashboard';
import { Clients } from '@/components/pages/Clients';
import { Quotations } from '@/components/pages/Quotations';
import { Invoices } from '@/components/pages/Invoices';
import { Payments } from '@/components/pages/Payments';
import { Accounting } from '@/components/pages/Accounting';
import { Projects } from '@/components/pages/Projects';
import { Subscriptions } from '@/components/pages/Subscriptions';
import { Reports } from '@/components/pages/Reports';
import { Settings } from '@/components/pages/Settings';
import { Toaster } from '@/components/ui/sonner';

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  quotations: 'Quotations',
  invoices: 'Invoices',
  payments: 'Payments',
  accounting: 'Accounting',
  projects: 'Projects',
  subscriptions: 'Subscriptions',
  reports: 'Reports',
  settings: 'Settings',
};

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState<Page>(() => {
    const saved = localStorage.getItem('zt-active-tab') as Page | null;
    const validPages: Page[] = ['dashboard', 'clients', 'quotations', 'invoices', 'payments', 'accounting', 'projects', 'subscriptions', 'reports', 'settings'];
    if (saved && validPages.includes(saved)) return saved;
    return 'dashboard';
  });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSetPage = (p: Page) => {
    setPage(p);
    localStorage.setItem('zt-active-tab', p);
  };

  if (!isAuthenticated) return <Login />;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        page={page}
        setPage={handleSetPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar setMobileOpen={setMobileOpen} title={pageTitles[page]} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-[1600px] w-full mx-auto">
          {page === 'dashboard' && <Dashboard />}
          {page === 'clients' && <Clients />}
          {page === 'quotations' && <Quotations onNavigate={handleSetPage} />}
          {page === 'invoices' && <Invoices />}
          {page === 'payments' && <Payments />}
          {page === 'accounting' && <Accounting />}
          {page === 'projects' && <Projects onNavigate={handleSetPage} />}
          {page === 'subscriptions' && <Subscriptions />}
          {page === 'reports' && <Reports />}
          {page === 'settings' && <Settings />}
        </main>
        <footer className="hidden lg:block pb-5 pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Zubkas Workspace.
          </p>
        </footer>
        <MobileBottomNav page={page} setPage={handleSetPage} />
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <DataProvider>
            <AppContent />
            <Toaster />
          </DataProvider>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
