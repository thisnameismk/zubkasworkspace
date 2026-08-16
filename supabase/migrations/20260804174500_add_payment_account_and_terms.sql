-- Add payment_account_id and terms columns to quotations
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS payment_account_id text,
  ADD COLUMN IF NOT EXISTS terms text;

-- Add payment_account_id and terms columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_account_id text,
  ADD COLUMN IF NOT EXISTS terms text;
