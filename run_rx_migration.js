const { Client } = require('pg');
const fs = require('fs');

const sql = fs.readFileSync('PRESCRIPTION_LOOKUP_MIGRATION.sql', 'utf8');

const configs = [
  // Pooler with explicit params (no URL encoding issues)
  { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 6543, user: 'postgres.rvvdoibrrgulvfhomlnt', password: 'Nexadox@db2025', database: 'postgres' },
  { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 6543, user: 'postgres.rvvdoibrrgulvfhomlnt', password: 'nexadox@db2025', database: 'postgres' },
  { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 6543, user: 'postgres.rvvdoibrrgulvfhomlnt', password: 'Diptanjan#123', database: 'postgres' },
  { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 5432, user: 'postgres.rvvdoibrrgulvfhomlnt', password: 'Nexadox@db2025', database: 'postgres' },
  { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 5432, user: 'postgres.rvvdoibrrgulvfhomlnt', password: 'nexadox@db2025', database: 'postgres' },
  { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 5432, user: 'postgres.rvvdoibrrgulvfhomlnt', password: 'Diptanjan#123', database: 'postgres' },
];

(async () => {
  for (const cfg of configs) {
    console.log(`Trying: ${cfg.user}@${cfg.host}:${cfg.port} pw=${cfg.password.substring(0, 5)}***`);
    const client = new Client({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      console.log('Connected!');
      await client.query(sql);
      console.log('Migration completed!');
      
      const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'rx_%' ORDER BY table_name");
      console.log('Created tables:', res.rows.map(r => r.table_name));
      
      const col = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='prescriptions' AND column_name='complaint'");
      console.log('Complaint column:', col.rows.length > 0 ? 'EXISTS' : 'MISSING');
      
      await client.end();
      process.exit(0);
    } catch (e) {
      console.log('Failed:', e.message);
      try { await client.end(); } catch {}
    }
  }
  console.log('All passwords failed');
  process.exit(1);
})();
