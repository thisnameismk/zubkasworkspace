import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
interface ThemeCtx { theme: Theme; toggle: () => void; }

const Ctx = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {} });

// 1. நாம் வரையறுத்த 5 பிரத்யேக வண்ணங்களின் துல்லியமான HSL குறியீடுகள்
export const THEME_PRESETS: Record<string, { hsl: string; hex: string }> = {
  '#9F0F0F': { hsl: '0 83% 34%', hex: '#9F0F0F' },     // Maroon Red (Default)
  '#2563EB': { hsl: '221 83% 53%', hex: '#2563EB' },   // Royal Blue
  '#059669': { hsl: '160 84% 39%', hex: '#059669' },   // Emerald Green
  '#4F46E5': { hsl: '243 75% 59%', hex: '#4F46E5' },   // Deep Indigo
  '#0891B2': { hsl: '189 94% 43%', hex: '#0891B2' },   // Midnight Cyan
};

// 2. HEX Color-ஐ HSL CSS மதிப்பாக மாற்றும் உதவி பங்க்ஷன்
export function hexToHsl(hex: string): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// 3. CSS Variables-இல் Accent Color-ஐ அப்ளை செய்யும் பங்க்ஷன்
export function applyAccentColor(hexColor: string) {
  if (!hexColor) return;
  const upperHex = hexColor.toUpperCase();
  const hsl = THEME_PRESETS[upperHex]?.hsl || hexToHsl(hexColor);

  const root = document.documentElement;
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--primary-hover', hsl);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--accent', hsl);

  localStorage.setItem('app_theme_color', upperHex);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('zt-theme') as Theme | null;
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('zt-theme', theme);

    // ஆப் லோட் ஆகும்போதே சேமிக்கப்பட்ட Accent Color-ஐ அப்ளை செய்தல்
    const savedColor = localStorage.getItem('app_theme_color') || '#9F0F0F';
    applyAccentColor(savedColor);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);