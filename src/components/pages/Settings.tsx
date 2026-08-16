import { useState, useRef, useCallback, useEffect } from 'react';
import { User, Percent, Palette, Save, Check, Moon, Sun, Building2, Upload, Globe, Phone, Mail, MapPin, FileText, Plus, Trash2, Star, ListPlus, X, Loader as Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useTheme, applyAccentColor } from '@/lib/theme';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SaveState = 'idle' | 'saving' | 'saved';

export interface PaymentAccount {
  id: string;
  accountName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  ifsc: string;
  swiftCode: string;
  upiId: string;
  isDefault: boolean;
}

function SaveButton({
  onClick,
  label,
  successMessage,
  fullWidth,
}: {
  onClick: () => void | Promise<void>;
  label: string;
  successMessage: string;
  fullWidth?: boolean;
}) {
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(async () => {
    if (state !== 'idle') return;
    setState('saving');
    try {
      await onClick();
    } catch {
      setState('idle');
      toast.error('Something went wrong. Please try again.');
      return;
    }
    setState('saved');
    toast.success(successMessage, { icon: <Check className="w-4 h-4 text-emerald-500" /> });
    timer.current = setTimeout(() => setState('idle'), 2000);
  }, [state, onClick, successMessage]);

  return (
    <Button
      onClick={handleClick}
      disabled={state !== 'idle'}
      className={cn('gap-2', fullWidth && 'w-full')}
    >
      {state === 'idle' && (<><Save className="w-4 h-4" /> {label}</>)}
      {state === 'saving' && (<><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>)}
      {state === 'saved' && (<><Check className="w-4 h-4 text-emerald-300" /> Saved!</>)}
    </Button>
  );
}

export function Settings() {
  const { theme, toggle } = useTheme();
  const [loading, setLoading] = useState(true);

  // Admin Profile
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Tax Settings
  const [gstRate, setGstRate] = useState('18');
  const [cgstRate, setCgstRate] = useState('9');
  const [sgstRate, setSgstRate] = useState('9');
  const [defaultTaxType, setDefaultTaxType] = useState('inter');

  // Theme & Styling
  const [customHex, setCustomHex] = useState('#9F0F0F');

  // Company Profile
  const [company, setCompany] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    gstin: '',
    logo: ''
  });

  // Payment Accounts
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);

  // Default Terms
  const [terms, setTerms] = useState<string[]>([]);

  // Fetch data from Supabase
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [compRes, accRes, termRes, adminRes, taxRes, themeRes] = await Promise.all([
        supabase.from('company_profile').select('*').maybeSingle(),
        supabase.from('payment_accounts').select('*').order('created_at', { ascending: true }),
        supabase.from('default_terms').select('*').order('sort_order', { ascending: true }),
        supabase.from('admin_profile').select('*').maybeSingle(),
        supabase.from('tax_settings').select('*').maybeSingle(),
        supabase.from('theme_settings').select('*').maybeSingle()
      ]);

      if (compRes.data) {
        setCompany({
          name: compRes.data.company_name || '',
          email: compRes.data.email || '',
          phone: compRes.data.phone || '',
          website: compRes.data.website || '',
          address: compRes.data.address || '',
          gstin: compRes.data.gstin || '',
          logo: compRes.data.logo_url || ''
        });
      }

      if (accRes.data) {
        setAccounts(accRes.data.map(a => ({
          id: a.id,
          accountName: a.account_name || '',
          bankName: a.bank_name || '',
          branchName: a.branch_name || '',
          accountNumber: a.account_number || '',
          ifsc: a.ifsc_code || '',
          swiftCode: a.swift_code || '',
          upiId: a.upi_id || '',
          isDefault: a.is_default || false
        })));
      }

      if (termRes.data) setTerms(termRes.data.map(t => t.term_text));
      if (adminRes.data) setAdminEmail(adminRes.data.admin_email || '');
      if (taxRes.data) {
        setGstRate(String(taxRes.data.gst_percentage || 18));
        setCgstRate(String(taxRes.data.cgst_percentage || 9));
        setSgstRate(String(taxRes.data.sgst_percentage || 9));
        setDefaultTaxType(taxRes.data.default_tax_type || 'inter');
      }

      if (themeRes.data && themeRes.data.accent_color) {
        setCustomHex(themeRes.data.accent_color);
        applyAccentColor(themeRes.data.accent_color);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Save Company Profile
  const saveCompany = async () => {
    const { error } = await supabase.from('company_profile').upsert({
      id: 'default',
      company_name: company.name,
      email: company.email,
      phone: company.phone,
      website: company.website,
      address: company.address,
      gstin: company.gstin,
      logo_url: company.logo,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  };

  // Save Payment Accounts
  const saveAccounts = async () => {
    const { error: delError } = await supabase.from('payment_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delError) throw delError;
    
    const formatted = accounts.map((a, i) => ({
      account_name: a.accountName,
      bank_name: a.bankName,
      branch_name: a.branchName,
      account_number: a.accountNumber,
      ifsc_code: a.ifsc,
      swift_code: a.swiftCode,
      upi_id: a.upiId,
      is_default: a.isDefault || (i === 0)
    }));

    if (formatted.length > 0) {
      const { error } = await supabase.from('payment_accounts').insert(formatted);
      if (error) throw error;
    }
    await fetchSettings();
  };

  // Save Default Terms
  const saveTerms = async () => {
    const { error: delError } = await supabase.from('default_terms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delError) throw delError;
    const cleaned = terms.filter(t => t.trim()).map((term_text, sort_order) => ({ term_text, sort_order }));
    if (cleaned.length > 0) {
      const { error } = await supabase.from('default_terms').insert(cleaned);
      if (error) throw error;
    }
  };

  // Save Admin Email Safely
  const saveCreds = async () => {
    if (!adminEmail) { 
      toast.error('Email is required'); 
      return; 
    }

    const { error } = await supabase.from('admin_profile').upsert({
      id: 'default',
      admin_email: adminEmail,
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error saving email:', error);
      throw error;
    }
  };

  // Change Password Safely
  const changePassword = async () => {
    if (!adminPassword || adminPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      // 1. Supabase Auth Password Update (only if a session is active)
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        const { error: authError } = await supabase.auth.updateUser({ password: adminPassword });
        if (authError) console.warn('Supabase Auth password update skipped:', authError.message);
      }

      // 2. Persist password directly in admin_profile (update only password column)
      const { error: dbError } = await supabase
        .from('admin_profile')
        .update({ password: adminPassword, updated_at: new Date().toISOString() })
        .eq('id', 'default');

      if (dbError) throw dbError;

      toast.success('Password updated successfully! Use the new password on your next login.');
      setAdminPassword('');
    } catch (err: any) {
      console.error('Error updating password:', err);
      toast.error('Failed to update password: ' + (err?.message || 'Unknown error'));
    } finally {
      setChangingPassword(false);
    }
  };

  // Save Tax Settings
  const saveTax = async () => {
    const { error } = await supabase.from('tax_settings').upsert({
      id: 'default',
      gst_percentage: Number(gstRate) || 0,
      cgst_percentage: Number(cgstRate) || 0,
      sgst_percentage: Number(sgstRate) || 0,
      default_tax_type: defaultTaxType,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  };

  // Save Theme
  const saveTheme = async () => {
    applyAccentColor(customHex);
    const { error } = await supabase.from('theme_settings').upsert({
      id: 'default',
      appearance_mode: theme,
      accent_color: customHex,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  };

  // Helpers
  const updateCompany = (field: string, value: string) => setCompany((prev) => ({ ...prev, [field]: value }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error('Logo too large (max 500KB)'); return; }
    const reader = new FileReader();
    reader.onload = () => updateCompany('logo', reader.result as string);
    reader.readAsDataURL(file);
  };

  const addAccount = () => {
    const newAcc: PaymentAccount = {
      id: `acc-${Date.now()}`,
      accountName: company.name,
      bankName: '',
      branchName: '',
      accountNumber: '',
      ifsc: '',
      swiftCode: '',
      upiId: '',
      isDefault: accounts.length === 0,
    };
    setAccounts([...accounts, newAcc]);
  };

  const updateAccount = (id: string, field: keyof PaymentAccount, value: string | boolean) => {
    setAccounts((prev) => prev.map((a) => {
      if (a.id === id) {
        const updated = { ...a, [field]: value };
        if (field === 'isDefault' && value === true) return { ...updated, isDefault: true };
        return updated;
      }
      if (field === 'isDefault' && value === true) return { ...a, isDefault: false };
      return a;
    }));
  };

  const removeAccount = (id: string) => setAccounts((prev) => prev.filter((a) => a.id !== id));
  const addTerm = () => setTerms([...terms, '']);
  const updateTerm = (i: number, value: string) => setTerms((prev) => prev.map((t, idx) => idx === i ? value : t));
  const removeTerm = (i: number) => setTerms((prev) => prev.filter((_, idx) => idx !== i));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your company profile, payment accounts, tax defaults, and appearance" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        {/* Company Profile */}
        <Card className="animate-slide-up lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <Building2 className="w-4 h-4" />
              </div>
              Company Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex flex-col items-center gap-2">
                <div className="w-28 h-28 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                  {company.logo ? (
                    <img src={company.logo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-10 h-10 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                      <Upload className="w-3.5 h-3.5" /> Upload
                    </span>
                  </label>
                  {company.logo && (
                    <button onClick={() => updateCompany('logo', '')} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive transition-colors">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 w-full">
                <Label>Logo URL (optional)</Label>
                <Input value={company.logo} onChange={(e) => updateCompany('logo', e.target.value)} placeholder="Paste image URL or upload above" className="mt-1.5" />
                <p className="text-xs text-muted-foreground mt-1">Upload a file or paste a URL. Logo appears on all quotations, invoices, and receipts.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <div className="relative mt-1.5">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={company.name} onChange={(e) => updateCompany('name', e.target.value)} className="pl-10" />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={company.email} onChange={(e) => updateCompany('email', e.target.value)} className="pl-10" />
                </div>
              </div>
              <div>
                <Label>Phone</Label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={company.phone} onChange={(e) => updateCompany('phone', e.target.value)} className="pl-10" />
                </div>
              </div>
              <div>
                <Label>Website</Label>
                <div className="relative mt-1.5">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={company.website} onChange={(e) => updateCompany('website', e.target.value)} className="pl-10" />
                </div>
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <div className="relative mt-1.5">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Textarea value={company.address} onChange={(e) => updateCompany('address', e.target.value)} className="pl-10 min-h-[60px]" />
              </div>
            </div>

            <div>
              <Label>GSTIN</Label>
              <Input value={company.gstin} onChange={(e) => updateCompany('gstin', e.target.value)} className="mt-1.5 font-mono" placeholder="27ABCDE1234F1Z5" />
            </div>

            <SaveButton onClick={saveCompany} label="Save Company Profile" successMessage="Company profile saved to Supabase!" fullWidth />
          </CardContent>
        </Card>

        {/* Payment Accounts */}
        <Card className="animate-slide-up lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-4 h-4" />
              </div>
              Payment Accounts (Bank & UPI)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No payment accounts yet. Add one to display on invoices and quotations.</p>
            )}
            {accounts.map((acc) => (
              <div key={acc.id} className="rounded-lg border border-border p-4 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateAccount(acc.id, 'isDefault', true)}
                      className={cn(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors',
                        acc.isDefault
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <Star className={cn('w-3 h-3', acc.isDefault && 'fill-current')} />
                      {acc.isDefault ? 'Default' : 'Set Default'}
                    </button>
                  </div>
                  <button onClick={() => removeAccount(acc.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Account Name</Label>
                    <Input value={acc.accountName} onChange={(e) => updateAccount(acc.id, 'accountName', e.target.value)} placeholder="Zubkas Technology Pvt Ltd" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Bank Name</Label>
                    <Input value={acc.bankName} onChange={(e) => updateAccount(acc.id, 'bankName', e.target.value)} placeholder="ICICI Bank" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Branch Name</Label>
                    <Input value={acc.branchName} onChange={(e) => updateAccount(acc.id, 'branchName', e.target.value)} placeholder="Chennai - Broadway" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Account Number</Label>
                    <Input value={acc.accountNumber} onChange={(e) => updateAccount(acc.id, 'accountNumber', e.target.value)} placeholder="412105000842" className="mt-1 font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs">IFSC Code</Label>
                    <Input value={acc.ifsc} onChange={(e) => updateAccount(acc.id, 'ifsc', e.target.value)} placeholder="ICIC0004121" className="mt-1 font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs">Swift Code</Label>
                    <Input value={acc.swiftCode} onChange={(e) => updateAccount(acc.id, 'swiftCode', e.target.value)} placeholder="ICICINBBXXX" className="mt-1 font-mono" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">UPI ID</Label>
                    <Input value={acc.upiId} onChange={(e) => updateAccount(acc.id, 'upiId', e.target.value)} placeholder="zubkastechnology@upi" className="mt-1" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addAccount} className="gap-2 w-full"><Plus className="w-4 h-4" /> Add Payment Account</Button>
            {accounts.length > 0 && (
              <SaveButton onClick={saveAccounts} label="Save Payment Accounts" successMessage="Payment accounts saved to Supabase!" fullWidth />
            )}
          </CardContent>
        </Card>

        {/* Default Terms */}
        <Card className="animate-slide-up lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <ListPlus className="w-4 h-4" />
              </div>
              Default Terms & Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">These pre-fill into every new quotation and invoice.</p>
            {terms.map((t, i) => (
              <div key={i} className="flex gap-2">
                <Input value={t} onChange={(e) => updateTerm(i, e.target.value)} placeholder={`Term ${i + 1}`} />
                <button onClick={() => removeTerm(i)} className="p-2.5 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" onClick={addTerm} className="gap-2"><Plus className="w-4 h-4" /> Add Term</Button>
            <SaveButton onClick={saveTerms} label="Save Default Terms" successMessage="Default terms saved to Supabase!" fullWidth />
          </CardContent>
        </Card>

        {/* Admin Credentials */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <User className="w-4 h-4" />
              </div>
              Admin Profile & Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Admin Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" className="pl-10" />
              </div>
            </div>
            <SaveButton onClick={saveCreds} label="Save Email" successMessage="Admin email saved to Supabase!" fullWidth />

            <div className="pt-2 border-t border-border">
              <Label className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> Change Password
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Updates your Supabase Auth password. Use this for both password login and Email OTP sign-in.</p>
              <Button
                onClick={changePassword}
                disabled={changingPassword || !adminPassword}
                className="w-full mt-3 gap-2"
              >
                {changingPassword ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                ) : (
                  <><Lock className="w-4 h-4" /> Update Password</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tax Settings */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <Percent className="w-4 h-4" />
              </div>
              Tax Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>GST %</Label>
                <Input type="number" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>CGST %</Label>
                <Input type="number" value={cgstRate} onChange={(e) => setCgstRate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>SGST %</Label>
                <Input type="number" value={sgstRate} onChange={(e) => setSgstRate(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Default Tax Type</Label>
              <Select value={defaultTaxType} onValueChange={(v) => setDefaultTaxType(v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Tax</SelectItem>
                  <SelectItem value="intra">Intra-State (CGST+SGST)</SelectItem>
                  <SelectItem value="inter">Inter-State (IGST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SaveButton onClick={saveTax} label="Save Tax Settings" successMessage="Tax settings saved to Supabase!" fullWidth />
          </CardContent>
        </Card>

        {/* Theme & Styling */}
        <Card className="animate-slide-up lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <Palette className="w-4 h-4" />
              </div>
              Theme & Styling
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>Appearance Mode</Label>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => theme !== 'light' && toggle()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all',
                    theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                  )}
                >
                  <Sun className="w-4 h-4" /> Light
                  {theme === 'light' && <Check className="w-4 h-4 text-primary" />}
                </button>
                <button
                  onClick={() => theme !== 'dark' && toggle()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all',
                    theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                  )}
                >
                  <Moon className="w-4 h-4" /> Dark
                  {theme === 'dark' && <Check className="w-4 h-4 text-primary" />}
                </button>
              </div>
            </div>

            <div>
              <Label>Custom Accent Color</Label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  className="w-12 h-10 rounded-lg border border-border cursor-pointer bg-card p-1"
                />
                <Input
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  placeholder="#9F0F0F"
                  className="font-mono max-w-[160px]"
                />
              </div>
            </div>

            <SaveButton onClick={saveTheme} label="Apply Theme" successMessage="Theme saved to Supabase!" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}