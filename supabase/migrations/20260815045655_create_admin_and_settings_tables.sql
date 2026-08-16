-- Create admin_profile and settings tables for Zubkas Workspace

-- 1. admin_profile: stores admin credentials (single row, id='default')
CREATE TABLE IF NOT EXISTS admin_profile (
  id text PRIMARY KEY DEFAULT 'default',
  admin_email text NOT NULL DEFAULT 'zubkastechnology@gmail.com',
  password text NOT NULL DEFAULT 'Zubkas@2036',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_admin_profile" ON admin_profile;
CREATE POLICY "anon_select_admin_profile" ON admin_profile FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_admin_profile" ON admin_profile;
CREATE POLICY "anon_insert_admin_profile" ON admin_profile FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_admin_profile" ON admin_profile;
CREATE POLICY "anon_update_admin_profile" ON admin_profile FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_admin_profile" ON admin_profile;
CREATE POLICY "anon_delete_admin_profile" ON admin_profile FOR DELETE TO anon, authenticated USING (true);

-- Seed the default admin row if it doesn't exist
INSERT INTO admin_profile (id, admin_email, password)
VALUES ('default', 'zubkastechnology@gmail.com', 'Zubkas@2036')
ON CONFLICT (id) DO NOTHING;

-- 2. company_profile: single-tenant company info for documents (single row, id='default')
CREATE TABLE IF NOT EXISTS company_profile (
  id text PRIMARY KEY DEFAULT 'default',
  company_name text NOT NULL DEFAULT 'Zubkas Technology Private Limited',
  email text,
  phone text,
  website text,
  address text,
  gstin text,
  logo_url text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_company_profile" ON company_profile;
CREATE POLICY "anon_select_company_profile" ON company_profile FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_company_profile" ON company_profile;
CREATE POLICY "anon_insert_company_profile" ON company_profile FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_company_profile" ON company_profile;
CREATE POLICY "anon_update_company_profile" ON company_profile FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_company_profile" ON company_profile;
CREATE POLICY "anon_delete_company_profile" ON company_profile FOR DELETE TO anon, authenticated USING (true);

INSERT INTO company_profile (id, company_name, email, phone, website, address, gstin)
VALUES ('default', 'Zubkas Technology Private Limited', 'zubkastechnology@gmail.com', '+91 98765 43210', 'www.zubkastechnology.com', 'Plot No. 24, IT Park, Hinjewadi Phase 2, Pune, Maharashtra 411057', '27ABCDE1234F1Z5')
ON CONFLICT (id) DO NOTHING;

-- 3. payment_accounts: bank/UPI accounts shown on invoices and quotations
CREATE TABLE IF NOT EXISTS payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text,
  bank_name text,
  branch_name text,
  account_number text,
  ifsc_code text,
  swift_code text,
  upi_id text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_select_payment_accounts" ON payment_accounts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_insert_payment_accounts" ON payment_accounts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_update_payment_accounts" ON payment_accounts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_delete_payment_accounts" ON payment_accounts FOR DELETE TO anon, authenticated USING (true);

-- 4. default_terms: default T&C lines for invoices/quotations
CREATE TABLE IF NOT EXISTS default_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE default_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_default_terms" ON default_terms;
CREATE POLICY "anon_select_default_terms" ON default_terms FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_default_terms" ON default_terms;
CREATE POLICY "anon_insert_default_terms" ON default_terms FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_default_terms" ON default_terms;
CREATE POLICY "anon_update_default_terms" ON default_terms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_default_terms" ON default_terms;
CREATE POLICY "anon_delete_default_terms" ON default_terms FOR DELETE TO anon, authenticated USING (true);

INSERT INTO default_terms (term_text, sort_order) VALUES
  ('Payment is due within 15 days from the date of issue.', 0),
  ('Goods/services once sold are non-refundable.', 1),
  ('Subject to local jurisdiction laws.', 2)
ON CONFLICT DO NOTHING;

-- 5. tax_settings: GST/CGST/SGST rates and default tax type (single row, id='default')
CREATE TABLE IF NOT EXISTS tax_settings (
  id text PRIMARY KEY DEFAULT 'default',
  gst_percentage numeric(5,2) NOT NULL DEFAULT 18,
  cgst_percentage numeric(5,2) NOT NULL DEFAULT 9,
  sgst_percentage numeric(5,2) NOT NULL DEFAULT 9,
  default_tax_type text NOT NULL DEFAULT 'inter',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tax_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tax_settings" ON tax_settings;
CREATE POLICY "anon_select_tax_settings" ON tax_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tax_settings" ON tax_settings;
CREATE POLICY "anon_insert_tax_settings" ON tax_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tax_settings" ON tax_settings;
CREATE POLICY "anon_update_tax_settings" ON tax_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tax_settings" ON tax_settings;
CREATE POLICY "anon_delete_tax_settings" ON tax_settings FOR DELETE TO anon, authenticated USING (true);

INSERT INTO tax_settings (id, gst_percentage, cgst_percentage, sgst_percentage, default_tax_type)
VALUES ('default', 18, 9, 9, 'inter')
ON CONFLICT (id) DO NOTHING;

-- 6. theme_settings: accent color and appearance mode (single row, id='default')
CREATE TABLE IF NOT EXISTS theme_settings (
  id text PRIMARY KEY DEFAULT 'default',
  appearance_mode text NOT NULL DEFAULT 'dark',
  accent_color text NOT NULL DEFAULT '#0ea5e9',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE theme_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_theme_settings" ON theme_settings;
CREATE POLICY "anon_select_theme_settings" ON theme_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_theme_settings" ON theme_settings;
CREATE POLICY "anon_insert_theme_settings" ON theme_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_theme_settings" ON theme_settings;
CREATE POLICY "anon_update_theme_settings" ON theme_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_theme_settings" ON theme_settings;
CREATE POLICY "anon_delete_theme_settings" ON theme_settings FOR DELETE TO anon, authenticated USING (true);

INSERT INTO theme_settings (id, appearance_mode, accent_color)
VALUES ('default', 'dark', '#0ea5e9')
ON CONFLICT (id) DO NOTHING;
