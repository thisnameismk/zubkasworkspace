/*
# Create accounting schema: income categories, expense categories, transactions

Single-tenant app (no sign-in). All tables allow anon + authenticated CRUD.

1. New Tables
- `income_categories`: User-defined income categories (Invoice Payments, Software Consulting, etc.)
- `expense_categories`: User-defined expense categories (Office Rent, Server Hosting, etc.)
- `transactions`: Unified ledger for income and expense entries with category, vendor, tax, attachment

2. Relationships
- transactions.category_id -> income_categories OR expense_categories (soft FK via text, no constraint since one column references two tables)
- transactions.invoice_id -> invoices (SET NULL, optional link for auto-synced income)
- transactions.client_id -> clients (SET NULL, optional)

3. Security
- RLS enabled on all new tables.
- anon + authenticated full CRUD (single-tenant, intentionally shared data).

4. Notes
- `type` column on transactions: 'income' | 'expense'
- `payment_status` column: 'paid' | 'pending' — for tracking unpaid expenses
- `tax_included` boolean for expenses
- `attachment_url` text for receipt/invoice uploads (stored as URL)
- Default categories seeded via DO block
*/

CREATE TABLE IF NOT EXISTS income_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#10b981',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#ef4444',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'income',
  category_id uuid,
  category_name text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  payment_method text DEFAULT 'UPI',
  vendor text,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  reference text,
  payment_status text NOT NULL DEFAULT 'paid',
  tax_included boolean NOT NULL DEFAULT false,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  attachment_url text,
  is_auto_synced boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_id);

ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Income categories policies
DROP POLICY IF EXISTS "anon_select_income_categories" ON income_categories;
CREATE POLICY "anon_select_income_categories" ON income_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_income_categories" ON income_categories;
CREATE POLICY "anon_insert_income_categories" ON income_categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_income_categories" ON income_categories;
CREATE POLICY "anon_update_income_categories" ON income_categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_income_categories" ON income_categories;
CREATE POLICY "anon_delete_income_categories" ON income_categories FOR DELETE TO anon, authenticated USING (true);

-- Expense categories policies
DROP POLICY IF EXISTS "anon_select_expense_categories" ON expense_categories;
CREATE POLICY "anon_select_expense_categories" ON expense_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_expense_categories" ON expense_categories;
CREATE POLICY "anon_insert_expense_categories" ON expense_categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_expense_categories" ON expense_categories;
CREATE POLICY "anon_update_expense_categories" ON expense_categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_expense_categories" ON expense_categories;
CREATE POLICY "anon_delete_expense_categories" ON expense_categories FOR DELETE TO anon, authenticated USING (true);

-- Transactions policies
DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE TO anon, authenticated USING (true);

-- Seed default categories
DO $$ BEGIN
  INSERT INTO income_categories (name, color) VALUES
    ('Invoice Payments', '#10b981'),
    ('Software Consulting', '#3b82f6'),
    ('Affiliate Income', '#8b5cf6'),
    ('Custom Services', '#f59e0b')
  ON CONFLICT DO NOTHING;

  INSERT INTO expense_categories (name, color) VALUES
    ('Office Rent', '#ef4444'),
    ('Server Hosting', '#f97316'),
    ('Marketing', '#ec4899'),
    ('Salaries', '#6366f1'),
    ('Software Tools', '#14b8a6')
  ON CONFLICT DO NOTHING;
END $$;
