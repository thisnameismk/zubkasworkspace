/*
# Create invoicing schema for Zubkas Technology

Single-tenant app (no sign-in). All tables allow anon + authenticated CRUD
because the data is intentionally shared/public within this workspace.

1. New Tables
- `clients`: CRM contacts (company, contact person, email, phone, gstin, address)
- `quotations`: Estimates with totals + GST breakdown
- `quotation_items`: Line items for quotations
- `invoices`: Invoices with totals + GST breakdown, optional link to quotation
- `invoice_items`: Line items for invoices
- `payments`: Payment logs against invoices (method, amount, reference, status)

2. Relationships
- quotations.client_id -> clients.id (CASCADE)
- quotation_items.quotation_id -> quotations.id (CASCADE)
- invoices.client_id -> clients.id (CASCADE)
- invoices.quotation_id -> quotations.id (SET NULL)
- invoice_items.invoice_id -> invoices.id (CASCADE)
- payments.invoice_id -> invoices.id (CASCADE)
- payments.client_id -> clients.id (CASCADE)

3. Security
- RLS enabled on every table.
- anon + authenticated full CRUD (single-tenant, intentionally shared data).

4. Notes
- GST columns stored as numeric(12,2) for money precision.
- status columns are text with app-enforced values.
- payment_method text values: Cash, UPI, Bank Transfer.
- payment status values: partial, full.
*/

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_person text NOT NULL,
  email text,
  phone text,
  gstin text,
  address text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  quote_number text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'flat',
  tax_type text NOT NULL DEFAULT 'none',
  cgst numeric(14,2) NOT NULL DEFAULT 0,
  sgst numeric(14,2) NOT NULL DEFAULT 0,
  igst numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  rate numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'flat',
  tax_type text NOT NULL DEFAULT 'none',
  cgst numeric(14,2) NOT NULL DEFAULT 0,
  sgst numeric(14,2) NOT NULL DEFAULT 0,
  igst numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  rate numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'UPI',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  status text NOT NULL DEFAULT 'full',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotations_client ON quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_clients" ON clients;
CREATE POLICY "anon_select_clients" ON clients FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_clients" ON clients;
CREATE POLICY "anon_insert_clients" ON clients FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_clients" ON clients;
CREATE POLICY "anon_update_clients" ON clients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_clients" ON clients;
CREATE POLICY "anon_delete_clients" ON clients FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_quotations" ON quotations;
CREATE POLICY "anon_select_quotations" ON quotations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quotations" ON quotations;
CREATE POLICY "anon_insert_quotations" ON quotations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quotations" ON quotations;
CREATE POLICY "anon_update_quotations" ON quotations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quotations" ON quotations;
CREATE POLICY "anon_delete_quotations" ON quotations FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_quotation_items" ON quotation_items;
CREATE POLICY "anon_select_quotation_items" ON quotation_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quotation_items" ON quotation_items;
CREATE POLICY "anon_insert_quotation_items" ON quotation_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quotation_items" ON quotation_items;
CREATE POLICY "anon_update_quotation_items" ON quotation_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quotation_items" ON quotation_items;
CREATE POLICY "anon_delete_quotation_items" ON quotation_items FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_invoices" ON invoices;
CREATE POLICY "anon_select_invoices" ON invoices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_invoices" ON invoices;
CREATE POLICY "anon_insert_invoices" ON invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
CREATE POLICY "anon_update_invoices" ON invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_invoices" ON invoices;
CREATE POLICY "anon_delete_invoices" ON invoices FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_invoice_items" ON invoice_items;
CREATE POLICY "anon_select_invoice_items" ON invoice_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_invoice_items" ON invoice_items;
CREATE POLICY "anon_insert_invoice_items" ON invoice_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_invoice_items" ON invoice_items;
CREATE POLICY "anon_update_invoice_items" ON invoice_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_invoice_items" ON invoice_items;
CREATE POLICY "anon_delete_invoice_items" ON invoice_items FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_payments" ON payments;
CREATE POLICY "anon_select_payments" ON payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_payments" ON payments;
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_payments" ON payments;
CREATE POLICY "anon_update_payments" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_payments" ON payments;
CREATE POLICY "anon_delete_payments" ON payments FOR DELETE TO anon, authenticated USING (true);