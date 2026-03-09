const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://rvvdoibrrgulvfhomlnt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dmRvaWJycmd1bHZmaG9tbG50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MDc2NiwiZXhwIjoyMDg2NzQ2NzY2fQ.mDTHB8xXi3t3LHBkFx-9z3hm3g88ofQHqe7FIMZLPMg'
);

(async () => {
  try {
    // Test: sign in as admin, then try reading profiles with the anon key (like the browser does)
    const anonClient = createClient(
      'https://rvvdoibrrgulvfhomlnt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dmRvaWJycmd1bHZmaG9tbG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzA3NjYsImV4cCI6MjA4Njc0Njc2Nn0.Zbe2HZ1mfFh731WrjX750tVH5IJqybtCyR68Bz9R2iA'
    );

    // Sign in
    const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
      email: 'diptanjan@gmail.com',
      password: '123456',
    });
    console.log('Auth result:', authErr ? 'FAILED: ' + authErr.message : 'SUCCESS');
    if (authErr) { process.exit(1); }
    console.log('Auth user ID:', authData.user.id);

    // Now try to read profile (this is exactly what the login page does)
    const { data: profile, error: profileErr } = await anonClient
      .from('profiles')
      .select('role, status')
      .eq('id', authData.user.id)
      .single();

    console.log('Profile result:', profile);
    console.log('Profile error:', profileErr);

  } catch (e) {
    console.error('Exception:', e.message);
  }
  process.exit(0);
})();
