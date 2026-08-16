-- Ensure admin_profile has the password column (idempotent)
-- Fixes: "Could not find the password column of admin_profile in the schema cache"

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_profile' AND column_name = 'password'
  ) THEN
    ALTER TABLE admin_profile ADD COLUMN password text NOT NULL DEFAULT 'Zubkas@2036';
  END IF;
END $$;

-- Refresh PostgREST schema cache so the new column is immediately visible
NOTIFY pgrst, 'reload schema';
