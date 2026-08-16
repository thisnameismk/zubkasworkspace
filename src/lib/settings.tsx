import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface PaymentAccount {
  id: string;
  label: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  isDefault: boolean;
}

export interface CompanyProfile {
  logo: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  gstin: string;
}

export interface AppSettings {
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  defaultTaxType: 'none' | 'intra' | 'inter';
  accent: AccentKey;
  customAccent: string;
  company: CompanyProfile;
  paymentAccounts: PaymentAccount[];
  defaultTerms: string[];
}

export type AccentKey = 'blue' | 'teal' | 'emerald' | 'indigo' | 'custom';

export const accentPresets: Record<Exclude<AccentKey, 'custom'>, { label: string; h: string; s: string; l: string; swatch: string }> = {
  blue: { label: 'Electric Blue', h: '199', s: '89', l: '48', swatch: '#0ea5e9' },
  teal: { label: 'Ocean Teal', h: '173', s: '80', l: '40', swatch: '#0d9488' },
  emerald: { label: 'Emerald Green', h: '152', s: '76', l: '40', swatch: '#059669' },
  indigo: { label: 'Indigo', h: '243', s: '75', l: '59', swatch: '#4f46e5' },
};

export function getAccentHex(accent: AccentKey, customAccent?: string): string {
  if (accent === 'custom') return customAccent || '#0ea5e9';
  const map: Record<string, string> = {
    blue: '#0ea5e9', teal: '#0d9488', emerald: '#059669', indigo: '#4f46e5',
  };
  return map[accent] || '#0ea5e9';
}

export function hexToHsl(hex: string): { h: string; s: string; l: string } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h /= 6;
  }
  return {
    h: String(Math.round(h * 360)),
    s: String(Math.round(s * 100)),
    l: String(Math.round(l * 100)),
  };
}

const defaultCompany: CompanyProfile = {
  logo: '',
  name: 'Zubkas Technology Private Limited',
  email: 'zubkastechnology@gmail.com',
  phone: '+91 98765 43210',
  website: 'www.zubkastechnology.com',
  address: 'Plot No. 24, IT Park, Hinjewadi Phase 2, Pune, Maharashtra 411057',
  gstin: '27ABCDE1234F1Z5',
};

const defaultPaymentAccounts: PaymentAccount[] = [
  { id: 'acc-1', label: 'HDFC Primary', accountName: 'Zubkas Technology Pvt Ltd', bankName: 'HDFC Bank', accountNumber: '50200012345678', ifsc: 'HDFC0001234', upiId: 'zubkastechnology@upi', isDefault: true },
];

const defaultTerms = [
  'Payment is due within 15 days from the date of issue.',
  'Goods/services once sold are non-refundable.',
  'Subject to local jurisdiction laws.',
];

const defaultSettings: AppSettings = {
  gstRate: 18,
  cgstRate: 9,
  sgstRate: 9,
  defaultTaxType: 'intra',
  accent: 'blue',
  customAccent: '#0ea5e9',
  company: defaultCompany,
  paymentAccounts: defaultPaymentAccounts,
  defaultTerms,
};

const STORAGE_KEY = 'zt-app-settings';

interface SettingsCtx {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const Ctx = createContext<SettingsCtx>({ settings: defaultSettings, updateSettings: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...defaultSettings,
          ...parsed,
          company: { ...defaultCompany, ...(parsed.company || {}) },
          paymentAccounts: parsed.paymentAccounts?.length ? parsed.paymentAccounts : defaultPaymentAccounts,
          defaultTerms: parsed.defaultTerms?.length ? parsed.defaultTerms : defaultTerms,
        };
      } catch { /* ignore */ }
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    const hex = getAccentHex(settings.accent, settings.customAccent);
    const { h, s, l } = hexToHsl(hex);
    const root = document.documentElement;
    root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
    root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
    root.style.setProperty('--accent', `${h} ${s}% ${l}%`);
    root.style.setProperty('--chart-1', `${h} ${s}% ${l}%`);
  }, [settings]);

  const updateSettings = (patch: Partial<AppSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

  return <Ctx.Provider value={{ settings, updateSettings }}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
