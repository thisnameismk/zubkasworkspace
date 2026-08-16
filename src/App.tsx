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
  reports: 'Reports',
  settings: 'Settings',
};

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!isAuthenticated) return <Login />;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        page={page}
        setPage={setPage}
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
          {page === 'quotations' && <Quotations onNavigate={setPage} />}
          {page === 'invoices' && <Invoices />}
          {page === 'payments' && <Payments />}
          {page === 'accounting' && <Accounting />}
          {page === 'projects' && <Projects onNavigate={setPage} />}
          {page === 'reports' && <Reports />}
          {page === 'settings' && <Settings />}
        </main>
        <footer className="hidden lg:block pb-5 pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Zubkas Workspace. Powered by Zubkas Technology Private Limited.
          </p>
        </footer>
        <MobileBottomNav page={page} setPage={setPage} />
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
