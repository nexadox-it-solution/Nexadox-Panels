const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://rvvdoibrrgulvfhomlnt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dmRvaWJycmd1bHZmaG9tbG50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MDc2NiwiZXhwIjoyMDg2NzQ2NzY2fQ.mDTHB8xXi3t3LHBkFx-9z3hm3g88ofQHqe7FIMZLPMg'
);

(async () => {
  console.log('Fixing RLS infinite recursion...');
  
  const { error } = await sb.rpc('exec_sql', { sql: `
    -- Create security-definer function to avoid infinite recursion
    CREATE OR REPLACE FUNCTION is_admin()
    RETURNS BOOLEAN AS $$
      SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER;

    -- Drop the broken policies
    DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
    DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
    DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;

    -- Recreate with is_admin() function (no recursion)
    CREATE POLICY "profiles_select_admin" ON profiles
      FOR SELECT TO authenticated
      USING (is_admin());

    CREATE POLICY "profiles_update_admin" ON profiles
      FOR UPDATE TO authenticated
      USING (is_admin());

    CREATE POLICY "profiles_delete_admin" ON profiles
      FOR DELETE TO authenticated
      USING (is_admin());

    -- Fix admin_details too
    DROP POLICY IF EXISTS "admin_details_select" ON admin_details;
    DROP POLICY IF EXISTS "admin_details_update" ON admin_details;

    CREATE POLICY "admin_details_select" ON admin_details
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR is_admin());

    CREATE POLICY "admin_details_update" ON admin_details
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid() OR is_admin());
  `});

  if (error) {
    console.log('rpc exec_sql not available, trying direct SQL statements...');
    // The rpc approach won't work. Use the REST approach instead - just output the SQL
    console.log('\n=== RUN THIS SQL IN SUPABASE SQL EDITOR ===\n');
    console.log(`
-- Fix RLS infinite recursion on profiles table
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;

CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_details_select" ON admin_details;
DROP POLICY IF EXISTS "admin_details_update" ON admin_details;

CREATE POLICY "admin_details_select" ON admin_details
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "admin_details_update" ON admin_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin());
    `);
  } else {
    console.log('Fixed successfully!');
  }

  // Test login after fix
  console.log('\n--- Testing login flow ---');
  const anonClient = createClient(
    'https://rvvdoibrrgulvfhomlnt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dmRvaWJycmd1bHZmaG9tbG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzA3NjYsImV4cCI6MjA4Njc0Njc2Nn0.Zbe2HZ1mfFh731WrjX750tVH5IJqybtCyR68Bz9R2iA'
  );

  const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
    email: 'diptanjan@gmail.com',
    password: '123456',
  });
  if (authErr) {
    console.log('Auth FAILED:', authErr.message);
    process.exit(1);
  }

  const { data: profile, error: profileErr } = await anonClient
    .from('profiles')
    .select('role, status')
    .eq('id', authData.user.id)
    .single();

  console.log('Profile:', profile);
  console.log('Error:', profileErr);

  if (profile) {
    console.log('\n✅ LOGIN WORKS! Role:', profile.role);
  } else {
    console.log('\n❌ Still failing. Need to run the SQL manually in Supabase SQL Editor.');
  }

  process.exit(0);
})();
