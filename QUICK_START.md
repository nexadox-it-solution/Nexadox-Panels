# 🚀 Nexadox Quick Start Guide

Get up and running in 10 minutes!

## ⚡ Prerequisites Check

Before starting, ensure you have:
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm 9+ installed (`npm --version`)
- [ ] Supabase account created
- [ ] Git installed (optional)

---

## 📦 Step 1: Install Dependencies (2 minutes)

```powershell
# Navigate to project folder
cd "d:\Client Project\Nexadox"

# Install all packages
npm install
```

**Wait for installation to complete (~2 minutes)**

---

## 🗄️ Step 2: Setup Supabase (3 minutes)

### A. Create Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Name it "Nexadox"
4. Choose region closest to you
5. Set a strong password
6. Click "Create"
7. **Wait 2-3 minutes** for initialization

### B. Get Credentials
1. Go to **Project Settings** (gear icon)
2. Click **API** tab
3. Copy these values:
   - **Project URL**
   - **anon public key**
   - **service_role key**

---

## 🔐 Step 3: Configure Environment (1 minute)

### Create `.env.local` file:

```powershell
# In project root, create .env.local
New-Item -Path ".env.local" -ItemType File
```

### Add your credentials:

Open `.env.local` and paste:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ **Replace the values with your actual Supabase credentials!**

---

## 🗃️ Step 4: Setup Database (2 minutes)

### Run SQL Schema:

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open file: `supabase/schema.sql`
4. **Copy ALL contents** (Ctrl+A, Ctrl+C)
5. **Paste** into SQL Editor
6. Click **Run** button
7. Wait for "Success" message

✅ **Verify**: Click **Table Editor** - you should see 14+ tables

---

## 🎬 Step 5: Run Application (1 minute)

```powershell
npm run dev
```

**Expected output:**
```
▲ Next.js 14.1.0
- Local: http://localhost:3000
✓ Ready in 2.3s
```

---

## 🎉 Step 6: Test the App (1 minute)

### Open Browser:
1. Go to [http://localhost:3000](http://localhost:3000)
2. You should see the Nexadox landing page

### Test Registration:
1. Click "Get Started" or go to `/auth/register`
2. Fill in the form:
   - Name: Test User
   - Email: test@example.com
   - Mobile: +1234567890
   - Password: Test123!
3. Click "Create account"
4. You'll be redirected to login

### Test Login:
1. Go to `/auth/login`
2. Enter:
   - Email: test@example.com
   - Password: Test123!
3. Click "Sign in"
4. You'll be redirected to patient dashboard (coming soon)

---

## 🎯 Quick Access URLs

Once running, access:

| Page | URL |
|------|-----|
| Homepage | http://localhost:3000 |
| Login | http://localhost:3000/auth/login |
| Register | http://localhost:3000/auth/register |
| Admin Dashboard | http://localhost:3000/admin |
| Doctor Portal | http://localhost:3000/doctor |
| Agent Portal | http://localhost:3000/agent |
| Attendant Portal | http://localhost:3000/attendant |

---

## 👤 Create Admin User (Optional)

To test admin panel:

### Method 1: Via Supabase Dashboard

1. Register a user normally
2. Go to Supabase **SQL Editor**
3. Run this query (replace email with your registered email):

```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

4. Logout and login again
5. You'll be redirected to `/admin`

### Method 2: Manual Insert

```sql
-- First, sign up via the app to create auth user
-- Then update the role in SQL Editor:
UPDATE users SET role = 'admin' WHERE email = 'admin@nexadox.com';
```

---

## 🔍 Verify Everything Works

### ✅ Checklist:

- [ ] App loads at localhost:3000
- [ ] Homepage displays correctly
- [ ] Can navigate to login page
- [ ] Can navigate to register page
- [ ] Registration creates user
- [ ] Login works with credentials
- [ ] Redirects based on role
- [ ] Admin dashboard loads (if admin user created)

---

## 🐛 Troubleshooting

### Issue: npm install fails
```powershell
# Clear cache and retry
npm cache clean --force
rm -rf node_modules
rm package-lock.json
npm install
```

### Issue: "Cannot find module"
```powershell
# Restart dev server
# Press Ctrl+C to stop
npm run dev
```

### Issue: Supabase connection error
- Check `.env.local` file exists
- Verify credentials are correct
- Ensure no extra spaces in values
- Restart dev server

### Issue: Database error
- Verify SQL schema ran successfully
- Check Supabase project is active
- Review Supabase logs in dashboard

### Issue: Port 3000 in use
```powershell
# Use different port
npm run dev -- -p 3001
```

Or kill the process:
```powershell
netstat -ano | findstr :3000
# Note the PID number
taskkill /PID <PID> /F
```

---

## 📚 Next Steps

### Explore the Admin Panel:
1. Create admin user (see above)
2. Login as admin
3. Navigate through:
   - Dashboard (stats overview)
   - Users management
   - Doctors management
   - Agents management

### Add Sample Data:
```sql
-- Add a doctor
INSERT INTO specialties (name, description) 
VALUES ('General Medicine', 'General physician services');

-- Add more via SQL Editor or wait for admin panel integration
```

### Start Development:
- Review `PROJECT_STATUS.md` to see what's complete
- Check `README.md` for architecture overview
- Read `SETUP_GUIDE.md` for detailed documentation

---

## 📞 Getting Help

If you encounter issues:

1. **Check Files:**
   - `README.md` - Project overview
   - `SETUP_GUIDE.md` - Detailed setup
   - `PROJECT_STATUS.md` - Current progress

2. **Check Logs:**
   - Browser console (F12)
   - Terminal output
   - Supabase dashboard logs

3. **Common Solutions:**
   - Restart dev server
   - Clear browser cache
   - Check environment variables
   - Verify database schema

---

## 🎊 Success!

You now have:
- ✅ Next.js 14 app running
- ✅ Supabase database configured
- ✅ Authentication working
- ✅ Admin panel accessible
- ✅ Modern UI with Tailwind CSS

**Ready to build the remaining features!** 🚀

---

## 📊 What's Built So Far:

| Feature | Status |
|---------|--------|
| Project Setup | ✅ Complete |
| Database Schema | ✅ Complete |
| Authentication | ✅ Complete |
| Admin Dashboard | ✅ Complete |
| User Management | ✅ Complete |
| Doctor Management UI | ✅ Complete |
| Agent Management UI | ✅ Complete |
| Doctor Portal | ⏳ Coming Next |
| Attendant Portal | ⏳ Coming Next |
| Agent Portal | ⏳ Coming Next |

---

**Development Time So Far:** ~4 hours
**Estimated Remaining:** ~20-30 hours
**Current Version:** 0.1.0 (Foundation)

---

Happy Coding! 🎉
