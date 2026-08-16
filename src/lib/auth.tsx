import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  sendOtp: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  email: null,
  login: async () => false,
  sendOtp: async () => ({ ok: false }),
  verifyOtp: async () => ({ ok: false }),
  logout: () => {},
});

const STORAGE_KEY = 'zt-auth-session';

export async function getStoredCredentials(): Promise<{ email: string; password: string }> {
  const { data } = await supabase.from('admin_profile').select('admin_email, password').maybeSingle();
  if (data) return { email: data.admin_email, password: data.password };
  return { email: 'zubkastechnology@gmail.com', password: 'Zubkas@2036' };
}

export async function saveCredentials(email: string, password: string): Promise<void> {
  await supabase.from('admin_profile').upsert({
    id: 'default',
    admin_email: email,
    password,
    updated_at: new Date().toISOString(),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const session = localStorage.getItem(STORAGE_KEY);
    if (session) {
      try {
        const parsed = JSON.parse(session);
        setIsAuthenticated(true);
        setEmail(parsed.email);
      } catch { /* ignore */ }
    }
  }, []);

  const login = useCallback(async (inputEmail: string, inputPassword: string): Promise<boolean> => {
    const creds = await getStoredCredentials();
    if (inputEmail === creds.email && inputPassword === creds.password) {
      setIsAuthenticated(true);
      setEmail(inputEmail);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: inputEmail, ts: Date.now() }));
      return true;
    }
    return false;
  }, []);

  const sendOtp = useCallback(async (otpEmail: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { data: adminRow } = await supabase
        .from('admin_profile')
        .select('admin_email')
        .maybeSingle();

      const registeredEmail = adminRow?.admin_email || 'zubkastechnology@gmail.com';
      if (registeredEmail.toLowerCase() !== otpEmail.toLowerCase().trim()) {
        return { ok: false, error: 'This email is not registered. Please enter a valid admin email.' };
      }

      const { error } = await supabase.auth.signInWithOtp({ email: otpEmail });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to send OTP. Please try again.' };
    }
  }, []);

  const verifyOtp = useCallback(async (otpEmail: string, token: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: otpEmail, token, type: 'email' });
      if (error) return { ok: false, error: error.message };
      const sessionEmail = data?.user?.email || otpEmail;
      setIsAuthenticated(true);
      setEmail(sessionEmail);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: sessionEmail, ts: Date.now() }));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Invalid verification code. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setEmail(null);
    localStorage.removeItem(STORAGE_KEY);
    void supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, email, login, sendOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
