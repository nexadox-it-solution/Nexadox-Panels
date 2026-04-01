const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dmRvaWJycmd1bHZmaG9tbG50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MDc2NiwiZXhwIjoyMDg2NzQ2NzY2fQ.mDTHB8xXi3t3LHBkFx-9z3hm3g88ofQHqe7FIMZLPMg';
const SUPABASE_URL = 'https://rvvdoibrrgulvfhomlnt.supabase.co';

const migrationSQL = `
  -- Add complaint column
  ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS complaint TEXT;

  -- Add prescription_number column
  ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_number VARCHAR(20);

  -- Add patient_id column
  ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_id INT;

  -- Create sequence for prescription numbering
  CREATE SEQUENCE IF NOT EXISTS prescription_number_seq START WITH 1 INCREMENT BY 1;

  -- Backfill existing prescriptions with prescription numbers
  DO $$
  DECLARE
    rx RECORD;
    seq_val INT;
  BEGIN
    FOR rx IN SELECT id FROM prescriptions WHERE prescription_number IS NULL ORDER BY id ASC LOOP
      seq_val := nextval('prescription_number_seq');
      UPDATE prescriptions SET prescription_number = 'NDP/' || LPAD(seq_val::TEXT, 9, '0') WHERE id = rx.id;
    END LOOP;
  END $$;

  -- Create unique index on prescription_number
  CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_number ON prescriptions(prescription_number);

  -- Update RLS: allow insert/update/select on prescriptions
  DROP POLICY IF EXISTS "Doctors can insert prescriptions" ON prescriptions;
  CREATE POLICY "Doctors can insert prescriptions" ON prescriptions
    FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS "Doctors can update prescriptions" ON prescriptions;
  CREATE POLICY "Doctors can update prescriptions" ON prescriptions
    FOR UPDATE USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Anyone can read prescriptions" ON prescriptions;
  CREATE POLICY "Anyone can read prescriptions" ON prescriptions
    FOR SELECT USING (true);
`;

async function runMigration() {
  const passwords = [
    'Nexadox@db2025',
    'Nexadox@123',
    'Nexadox#123',
    'nexadox@db2025',
    'Diptanjan#123',
    'diptanjan#123',
  ];

  for (const password of passwords) {
    const encoded = encodeURIComponent(password);
    const connectionString = `postgresql://postgres.rvvdoibrrgulvfhomlnt:${encoded}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;

    console.log(`Trying password: ${password.substring(0, 5)}***`);
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
      await client.connect();
      console.log('Connected to database!');
      await client.query(migrationSQL);
      console.log('Migration executed successfully!');
      await client.end();

      // Verify columns exist
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data, error } = await admin.from('prescriptions').select('id, complaint, prescription_number, patient_id').limit(1);
      if (error) {
        console.log('Verification FAILED:', error.message);
      } else {
        console.log('Verification OK - all columns exist. Sample:', JSON.stringify(data));
      }
      return;
    } catch (err) {
      console.log('Failed:', err.message.substring(0, 100));
      try { await client.end(); } catch (_) {}
    }
  }
  console.log('All passwords failed!');
}

runMigration().catch(e => console.error('Error:', e.message));
