import { useState, useRef, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Receipt, TrendingUp, FolderKanban, Zap, KeyRound, Loader as Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Receipt,
    title: 'Smart Invoicing & GST Billing',
    desc: 'Create professional invoices with automatic GST calculations, partial payment tracking, and instant PDF export.',
  },
  {
    icon: TrendingUp,
    title: 'Real-time Expense & Profit Tracking',
    desc: 'Monitor cash flow, log expenses, and generate profit & loss statements with live accounting sync.',
  },
  {
    icon: FolderKanban,
    title: 'Automated Project & Task Management',
    desc: 'Projects auto-create from invoice payments. Track tasks, deadlines, and budgets in one unified workspace.',
  },
];

type Tab = 'password' | 'otp';

export function Login() {
  const { login, sendOtp, verifyOtp } = useAuth();
  const [tab, setTab] = useState<Tab>('password');

  // Shared
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password tab
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  // OTP tab
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otpSent && resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpSent, resendCooldown]);

  useEffect(() => {
    if (otpSent) otpInputRef.current?.focus();
  }, [otpSent]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
    setOtpSent(false);
    setOtpCode('');
    setResendCooldown(0);
  };

  // Safe Verification allowing configured emails or default admin email
  const verifyAdminEmail = async (inputEmail: string) => {
    const cleanInput = inputEmail.toLowerCase().trim();
    
    // Always allow the primary default email
    if (cleanInput === 'zubkastechnology@gmail.com') return true;

    try {
      const { data } = await supabase.from('admin_profile').select('admin_email').maybeSingle();
      if (!data) return cleanInput === 'zubkastechnology@gmail.com';

      const dbEmail = (data.admin_email || '').toLowerCase().trim();
      return dbEmail ? dbEmail === cleanInput : true;
    } catch {
      return true;
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Check Admin Profile for updated credentials (admin_email + password)
      const { data: adminData } = await supabase.from('admin_profile').select('admin_email, password').maybeSingle();
      const dbEmail = adminData?.admin_email || 'zubkastechnology@gmail.com';
      const dbPassword = adminData?.password || 'Zubkas@2036';

      // Allow login if email matches and password matches DB or default
      if (email.toLowerCase().trim() === dbEmail.toLowerCase() && (password === dbPassword || password === 'Zubkas@2036')) {
        await login(email, password);
        toast.success('Successfully signed in!');
        window.location.href = '/';
        return;
      }

      // 2. Try Supabase Auth Sign In
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData?.session) {
        toast.success('Successfully signed in!');
        window.location.href = '/';
        return;
      }

      setError('Invalid email or password. Please try again.');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isAdmin = await verifyAdminEmail(email);
      if (!isAdmin) {
        setError('This email is not registered. Please enter a valid admin email.');
        setLoading(false);
        return;
      }

      const result = await sendOtp(email);
      if (result.ok) {
        setOtpSent(true);
        setResendCooldown(30);
        toast.success('Verification code sent! Check your inbox.', { icon: <Mail className="w-4 h-4 text-emerald-500" /> });
      } else {
        setError(result.error || 'Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      setError('Error sending OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await verifyOtp(email, otpCode);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'Invalid verification code. Please try again.');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);
    const result = await sendOtp(email);
    setLoading(false);
    if (result.ok) {
      setResendCooldown(30);
      toast.success('A new code has been sent to your inbox.');
    } else {
      setError(result.error || 'Failed to resend code. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left showcase panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-sidebar">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-primary/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-0 -left-32 w-80 h-80 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 rounded-full bg-blue-500/10 blur-[80px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 h-full text-sidebar-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-400 shadow-2xl shadow-primary/30">
              <Zap className="w-6 h-6 text-white" fill="white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Zubkas Workspace</h1>
              <p className="text-xs text-sidebar-foreground/60 mt-0.5">All-in-One Business OS</p>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
              Run your entire business from one workspace.
            </h2>
            <p className="text-sm text-sidebar-foreground/60 mt-3 leading-relaxed">
              Invoicing, Accounting & Project Management — seamlessly integrated so every payment automatically syncs across your books, receipts, and projects.
            </p>
          </div>

          <div className="space-y-5 max-w-md">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-4 group">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-white/10 shrink-0 group-hover:bg-primary/20 group-hover:border-primary/30 transition-all duration-300">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{f.title}</p>
                    <p className="text-xs text-sidebar-foreground/50 mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/40">
            <ShieldCheck className="w-4 h-4" />
            <span>Powered by Zubkas Technology</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative overflow-hidden">
        <div className="absolute inset-0 lg:hidden bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-primary/5 blur-[80px] hidden lg:block" />

        <div className="relative z-10 w-full max-w-md animate-slide-up">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-400 shadow-2xl shadow-primary/30 mb-3">
              <Zap className="w-7 h-7 text-white" fill="white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Zubkas Workspace</h1>
            <p className="text-xs text-muted-foreground mt-1">All-in-One Business OS</p>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-black/5 p-7 sm:p-8">
            <div className="mb-6">
              <h2 className="font-bold text-xl tracking-tight">Welcome back</h2>
              <p className="text-sm text-muted-foreground mt-1">Sign in to your workspace to continue.</p>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/60 mb-6">
              <button
                type="button"
                onClick={() => switchTab('password')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                  tab === 'password' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Lock className="w-3.5 h-3.5" /> Password
              </button>
              <button
                type="button"
                onClick={() => switchTab('otp')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                  tab === 'otp' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <KeyRound className="w-3.5 h-3.5" /> Email OTP
              </button>
            </div>

            {/* Password tab */}
            {tab === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="zubkastechnology@gmail.com"
                      className="pl-10 h-11"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-10 pr-10 h-11"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-3.5 py-2.5 animate-fade-in border border-destructive/20">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                    <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">Remember me</Label>
                  </div>
                  <button type="button" className="text-sm text-primary hover:underline font-medium transition-colors">
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 gap-2 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                    </span>
                  ) : (
                    <>Sign In to Workspace <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </form>
            )}

            {/* OTP tab */}
            {tab === 'otp' && (
              <div className="space-y-5">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-5">
                    <div>
                      <Label htmlFor="otp-email" className="text-sm font-medium">Email Address</Label>
                      <div className="relative mt-2">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="otp-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email address"
                          className="pl-10 h-11"
                          autoComplete="email"
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">We'll send a 6-digit verification code to this email.</p>
                    </div>

                    {error && (
                      <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-3.5 py-2.5 animate-fade-in border border-destructive/20">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 gap-2 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                      disabled={loading || !email}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Sending code...
                        </span>
                      ) : (
                        <><KeyRound className="w-4 h-4" /> Send OTP Code</>
                      )}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 shrink-0">
                        <Mail className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Code sent to {email}</p>
                        <button
                          type="button"
                          onClick={() => { switchTab('otp'); setEmail(email); }}
                          className="text-xs text-primary hover:underline"
                        >
                          Use a different email
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="otp-code" className="text-sm font-medium">Enter 6-Digit Code</Label>
                      <Input
                        ref={otpInputRef}
                        id="otp-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="h-12 text-center text-2xl font-mono tracking-[0.5em] mt-2"
                        autoComplete="one-time-code"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-2">Enter the 6-digit code from your email.</p>
                    </div>

                    {error && (
                      <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-3.5 py-2.5 animate-fade-in border border-destructive/20">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 gap-2 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                      disabled={loading || otpCode.length !== 6}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                        </span>
                      ) : (
                        <><Check className="w-4 h-4" /> Verify & Sign In</>
                      )}
                    </Button>

                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendCooldown > 0 || loading}
                        className={cn(
                          'font-medium transition-colors',
                          resendCooldown > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:underline',
                        )}
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtpCode(''); setError(''); setResendCooldown(0); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Change email
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            &copy; {new Date().getFullYear()} Zubkas Workspace. Powered by Zubkas Technology Private Limited.
          </p>
        </div>
      </div>
    </div>
  );
}