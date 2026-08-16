/*
# Create Subscriptions and Subscription Categories tables

1. New Tables
- `subscription_categories`: Admin-managed categories for subscription plans (e.g., "Hosting", "Maintenance").
  * id (uuid, PK)
  * name (text, not null)
  * description (text, nullable)
  * created_at (timestamptz, default now())
- `subscriptions`: Recurring billing entries linked to clients and optionally quotations.
  * id (uuid, PK)
  * client_id (uuid, FK to clients, not null)
  * client_name (text, nullable — denormalized for quick display)
  * quotation_id (uuid, FK to quotations, nullable)
  * category_id (uuid, FK to subscription_categories, nullable)
  * plan_name (text, not null)
  * amount (numeric, default 0)
  * tax_amount (numeric, default 0)
  * total_amount (numeric, default 0)
  * billing_cycle (text, check in Monthly/Quarterly/Half-Yearly/Yearly, not null)
  * start_date (date, not null)
  * end_date (date, nullable)
  * renewal_date (date, not null)
  * status (text, check in Active/Pending/Overdue/Cancelled, default Pending)
  * created_at (timestamptz, default now())

2. Security
- Enable RLS on both tables.
- Policies: anon + authenticated full CRUD (single-tenant workspace app with login but shared data model).

3. Indexes
- subscriptions.client_id for client-scoped lookups
- subscriptions.status for filtering active/overdue
- subscriptions.renewal_date for renewal-due queries
*/

CREATE TABLE IF NOT EXISTS subscription_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sub_cats" ON subscription_categories;
CREATE POLICY "anon_select_sub_cats" ON subscription_categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sub_cats" ON subscription_categories;
CREATE POLICY "anon_insert_sub_cats" ON subscription_categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sub_cats" ON subscription_categories;
CREATE POLICY "anon_update_sub_cats" ON subscription_categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sub_cats" ON subscription_categories;
CREATE POLICY "anon_delete_sub_cats" ON subscription_categories FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_name text,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  category_id uuid REFERENCES subscription_categories(id) ON DELETE SET NULL,
  plan_name text NOT NULL,
  amount numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly')),
  start_date date NOT NULL,
  end_date date,
  renewal_date date NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Active', 'Pending', 'Overdue', 'Cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_subs" ON subscriptions;
CREATE POLICY "anon_select_subs" ON subscriptions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_subs" ON subscriptions;
CREATE POLICY "anon_insert_subs" ON subscriptions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_subs" ON subscriptions;
CREATE POLICY "anon_update_subs" ON subscriptions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_subs" ON subscriptions;
CREATE POLICY "anon_delete_subs" ON subscriptions FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal_date ON subscriptions(renewal_date);
