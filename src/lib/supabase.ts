import { createClient } from '@supabase/supabase-js';

const url = 'https://xtznubjomzubmivbrgsd.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0em51YmpvbXp1Ym1pdmJyZ3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODEyMzAsImV4cCI6MjEwMTk1NzIzMH0.hjPLHjQjP0mYTSMrMt5wlC_xcSGr2oseZgsJhsASiKU';

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});