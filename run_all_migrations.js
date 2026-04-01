const fs = require('fs');

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dmRvaWJycmd1bHZmaG9tbG50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MDc2NiwiZXhwIjoyMDg2NzQ2NzY2fQ.mDTHB8xXi3t3LHBkFx-9z3hm3g88ofQHqe7FIMZLPMg';
const SUPABASE_URL = 'https://rvvdoibrrgulvfhomlnt.supabase.co';

async function runSQL(label, sql) {
  console.log(`Running ${label}...`);
  const resp = await fetch(`${SUPABASE_URL}/pg/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (resp.ok) {
    const result = await resp.json();
    console.log(`${label} done:`, JSON.stringify(result).substring(0, 200));
    return true;
  } else {
    const text = await resp.text();
    console.error(`${label} FAILED (${resp.status}):`, text.substring(0, 300));
    return false;
  }
}

async function run() {
  // Migration 1: Prescription lookup tables + complaint column
  const sql1 = fs.readFileSync('PRESCRIPTION_LOOKUP_MIGRATION.sql', 'utf8');
  const ok1 = await runSQL('PRESCRIPTION_LOOKUP_MIGRATION', sql1);

  // Migration 2: Prescription number + patient_id
  const sql2 = fs.readFileSync('PRESCRIPTION_NUMBER_UHID_MIGRATION.sql', 'utf8');
  const ok2 = await runSQL('PRESCRIPTION_NUMBER_UHID_MIGRATION', sql2);

  if (ok1 && ok2) {
    // Verify columns
    const ok3 = await runSQL('VERIFY_COLUMNS', "SELECT column_name FROM information_schema.columns WHERE table_name = 'prescriptions' ORDER BY ordinal_position");
    console.log('\nAll migrations complete!');
  } else {
    console.error('\nSome migrations failed. Please run the SQL manually in Supabase SQL Editor.');
  }
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
