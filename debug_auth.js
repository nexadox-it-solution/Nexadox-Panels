const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://rvvdoibrrgulvfhomlnt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dmRvaWJycmd1bHZmaG9tbG50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MDc2NiwiZXhwIjoyMDg2NzQ2NzY2fQ.mDTHB8xXi3t3LHBkFx-9z3hm3g88ofQHqe7FIMZLPMg'
);

(async () => {
  // 1. Check profiles table
  const { data: profiles, error: pErr } = await sb.from('profiles').select('*');
  console.log('=== PROFILES TABLE ===');
  console.log('Count:', profiles?.length || 0);
  if (profiles?.length > 0) profiles.forEach(p => console.log(JSON.stringify(p)));
  if (pErr) console.log('Error:', pErr.message);

  // 2. Check users table for admin
  const { data: users, error: uErr } = await sb.from('users').select('id, name, email, role, auth_user_id, status').eq('email', 'diptanjan@gmail.com');
  console.log('\n=== USERS TABLE (admin) ===');
  if (users) users.forEach(u => console.log(JSON.stringify(u)));
  if (uErr) console.log('Error:', uErr.message);

  // 3. Check auth.users
  const { data: authData } = await sb.auth.admin.listUsers();
  console.log('\n=== AUTH.USERS ===');
  const adminAuth = authData?.users?.find(u => u.email === 'diptanjan@gmail.com');
  if (adminAuth) {
    console.log('Auth ID:', adminAuth.id);
    console.log('Email:', adminAuth.email);
    console.log('Meta:', JSON.stringify(adminAuth.user_metadata));
  } else {
    console.log('NOT FOUND in auth.users!');
    console.log('All auth emails:', authData?.users?.map(u => u.email).join(', '));
  }

  process.exit(0);
})();
