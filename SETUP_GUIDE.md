# 🚀 Nexadox Setup Guide

Complete step-by-step guide to set up and run the Nexadox platform.

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Initial Setup](#initial-setup)
3. [Supabase Configuration](#supabase-configuration)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [Creating Test Users](#creating-test-users)
8. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Required Software
- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher (comes with Node.js)
- **Git**: Latest version
- **Modern Browser**: Chrome, Firefox, or Edge (latest version)

### Recommended Tools
- **VS Code**: For development
- **Supabase CLI**: Optional, for advanced database management

---

## Initial Setup

### 1. Install Dependencies

```bash
# Navigate to project directory
cd "d:\Client Project\Nexadox"

# Install all npm packages
npm install
```

This will install:
- Next.js 14 and React
- TypeScript
- Tailwind CSS
- Supabase client libraries
- UI components (Radix UI)
- Form libraries (React Hook Form, Zod)
- Icons (Lucide React)

### 2. Verify Installation

```bash
# Check Node.js version
node --version  # Should be v18.x or higher

# Check npm version
npm --version   # Should be v9.x or higher
```

---

## Supabase Configuration

### 1. Create Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for a free account
3. Verify your email

### 2. Create New Project

1. Click "New Project"
2. Fill in project details:
   - **Name**: Nexadox (or your choice)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your location
   - **Pricing Plan**: Free
3. Click "Create new project"
4. Wait 2-3 minutes for project initialization

### 3. Get Project Credentials

1. Go to **Project Settings** (gear icon)
2. Navigate to **API** section
3. Copy the following:
   - **Project URL** (looks like: https://xxxxx.supabase.co)
   - **anon public** key
   - **service_role** key (⚠️ Keep this secret!)

---

## Environment Configuration

### 1. Create Environment File

```bash
# Copy the example file
copy .env.local.example .env.local

# Or create manually
# Create a new file named: .env.local
```

### 2. Add Your Credentials

Open `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ **Important**: Replace the placeholder values with your actual Supabase credentials.

---

## Database Setup

### 1. Open Supabase SQL Editor

1. In your Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**

### 2. Run Database Schema

1. Open the file: `supabase/schema.sql`
2. Copy **ALL** the contents
3. Paste into the Supabase SQL Editor
4. Click **Run** button

This will create:
- ✅ All database tables (users, doctors, patients, appointments, etc.)
- ✅ Custom types (enums)
- ✅ Functions for business logic
- ✅ Triggers for automation
- ✅ Row Level Security policies
- ✅ Indexes for performance
- ✅ Sample data (categories & specialties)

### 3. Verify Database Creation

1. Click **Table Editor** (left sidebar)
2. You should see tables like:
   - users
   - doctors
   - patients
   - agents
   - appointments
   - etc.

---

## Running the Application

### 1. Start Development Server

```bash
npm run dev
```

You should see:
```
▲ Next.js 14.1.0
- Local:        http://localhost:3000
- Ready in 2.3s
```

### 2. Open Application

Open your browser and navigate to:
- **Homepage**: [http://localhost:3000](http://localhost:3000)
- **Login**: [http://localhost:3000/auth/login](http://localhost:3000/auth/login)
- **Register**: [http://localhost:3000/auth/register](http://localhost:3000/auth/register)

---

## Creating Test Users

### Method 1: Via Registration Page

1. Go to [http://localhost:3000/auth/register](http://localhost:3000/auth/register)
2. Fill in the form:
   - Full Name: Test User
   - Email: test@example.com
   - Mobile: +1234567890
   - Password: Test123!
3. Click "Create account"
4. This creates a **Patient** user by default

### Method 2: Direct Database Insert (For Admin/Doctor/Agent)

Go to Supabase **SQL Editor** and run:

#### Create Admin User

```sql
-- First, get the auth user ID after signup, then:
INSERT INTO users (id, role, name, email, mobile, status)
VALUES (
  'auth-user-id-here',  -- Replace with actual Supabase Auth user ID
  'admin',
  'Admin User',
  'admin@nexadox.com',
  '+1234567890',
  'active'
);
```

#### Create Doctor User

```sql
-- After creating auth user and user record:
INSERT INTO doctors (user_id, specialty_id, experience, consultation_fee, is_accepting_patients)
VALUES (
  'user-id-here',
  (SELECT id FROM specialties WHERE name = 'General Physician' LIMIT 1),
  5,
  500.00,
  true
);
```

### Method 3: Using Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Click "Add user"
3. Enter email and password
4. Then manually add records in **Table Editor**:
   - Add user in `users` table
   - Add corresponding record in role-specific table (doctors, agents, etc.)

---

## Testing the Application

### 1. Register as Patient

```
URL: http://localhost:3000/auth/register
Email: patient@test.com
Password: Test123!
```

### 2. Login

```
URL: http://localhost:3000/auth/login
Email: patient@test.com
Password: Test123!
```

### 3. Role-Based Redirect

After login, you'll be redirected based on role:
- **Admin** → /admin
- **Doctor** → /doctor
- **Attendant** → /attendant
- **Agent** → /agent
- **Patient** → /patient

---

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Issue: Supabase connection error

**Solution**:
1. Check `.env.local` file exists and has correct values
2. Verify Supabase project is active
3. Check project URL starts with `https://`
4. Ensure no extra spaces in environment variables

### Issue: Database RLS policies blocking access

**Solution**:
1. Check if user role is set correctly in `users` table
2. Verify RLS is enabled on tables
3. Check policy conditions match your use case

### Issue: Next.js build errors

**Solution**:
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

### Issue: Port 3000 already in use

**Solution**:
```bash
# Run on different port
npm run dev -- -p 3001
```

Or find and kill process on port 3000 (Windows):
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: Supabase Auth not working

**Checklist**:
- [ ] Email auth is enabled in Supabase (Authentication → Providers)
- [ ] Site URL is configured (Authentication → URL Configuration)
- [ ] Email templates are configured
- [ ] Users table has RLS policies

---

## Next Steps

After successful setup:

1. ✅ **Create Admin User** (manually via Supabase)
2. ✅ **Add Doctors** (via Admin panel - to be built)
3. ✅ **Configure Specialties** (already seeded)
4. ✅ **Test Booking Flow**
5. ✅ **Set Up Agent Approval Workflow**

---

## Development Workflow

### Making Changes

```bash
# 1. Make code changes
# 2. Save file (auto-reload in dev mode)
# 3. Check browser for results
# 4. Check terminal for errors
```

### Adding New Dependencies

```bash
npm install <package-name>
```

### Database Changes

1. Modify `supabase/schema.sql`
2. Run migrations in Supabase SQL Editor
3. Update TypeScript types in `src/types/index.ts`

---

## Production Deployment

### 1. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts
```

### 2. Set Environment Variables

In Vercel dashboard:
1. Go to Project Settings
2. Navigate to Environment Variables
3. Add all variables from `.env.local`

### 3. Configure Supabase

In Supabase dashboard:
1. Update Site URL to your Vercel URL
2. Update Redirect URLs
3. Configure email templates

---

## Additional Resources

- **Next.js Docs**: [https://nextjs.org/docs](https://nextjs.org/docs)
- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **Tailwind CSS**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Shadcn UI**: [https://ui.shadcn.com](https://ui.shadcn.com)

---

## Support

For issues or questions:
- Check `README.md` for project overview
- Review Supabase logs (Project → Logs)
- Check browser console for errors
- Review Next.js terminal output

---

**Happy Coding! 🎉**
