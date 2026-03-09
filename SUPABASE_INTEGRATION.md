# Supabase Integration Guide

## ✅ Setup Steps Completed

### 1. **Environment Configuration**
- ✅ Created `.env.local` with Supabase credentials
- ✅ `NEXT_PUBLIC_SUPABASE_URL` configured
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured
- ✅ Installed `@supabase/supabase-js` package

### 2. **Supabase Client Setup**
- ✅ Created `/src/lib/supabase.ts` - Reusable Supabase client
- ✅ Ready for all API calls

### 3. **Database Schema**
Created `/schema.sql` with 11 tables:
```
✅ users
✅ specialties (with icon storage)
✅ degrees
✅ locations
✅ clinics (with logo storage)
✅ doctors
✅ appointments
✅ patient_transactions
✅ agent_transactions
✅ attendant_transactions
✅ invoices
```

### 4. **Data Seeding**
- ✅ Created `/src/lib/seedDatabase.ts` with mock data
- ✅ Includes all Indian marketplace data (names, locations, currency)

### 5. **Specialties Page Integration**
- ✅ Connected to Supabase
- ✅ Fetch from DB on load
- ✅ Add new specialties (INSERT)
- ✅ Edit specialties (UPDATE)
- ✅ Delete specialties (DELETE)
- ✅ Icon upload & storage

---

## 🚀 NEXT STEPS - Manual Setup Required

### Step 1: Create Tables in Supabase

1. Go to https://app.supabase.com/project/rvvdoibrrgulvfhomlnt/sql/new
2. Copy the entire SQL from `/schema.sql`
3. Paste into Supabase SQL Editor
4. Click "Run"

### Step 2: Seed Database with Mock Data

Option A - Via Seed Page (Recommended):
```
http://localhost:3000/seed
Click "Seed Database" button
```

Option B - Via Node Script:
```bash
cd "d:\Client Project\Nexadox"
node -e "require('./src/lib/seedDatabase.ts').seedDatabase().then(r => process.exit(r ? 0 : 1))"
```

### Step 3: Connect Other Admin Pages

Pages ready for Supabase integration (follow Specialties pattern):
- [ ] Locations page
- [ ] Degrees page  
- [ ] Clinics page
- [ ] Appointments page
- [ ] Patient Transactions page
- [ ] Agent Transactions page
- [ ] Attendant Transactions page
- [ ] Invoices list page
- [ ] Invoice detail page

---

## 📝 Technology Stack

**Package**: `@supabase/supabase-js@2.x`
**Database**: PostgreSQL (Supabase managed)
**Client**: Next.js 14 (App Router)
**Storage**: Base64 for icons/logos (can migrate to Supabase Storage later)

---

## 🔄 Data Flow

```
├─ Admin Page (React Component)
│  ├─ useEffect → fetchData()
│  ├─ handleAdd() → supabase.insert()
│  ├─ handleEdit() → supabase.update()
│  └─ handleDelete() → supabase.delete()
├─ Supabase Client (/src/lib/supabase.ts)
└─ Remote PostgreSQL Database
```

---

## 📚 Code Example Pattern

```tsx
// 1. Import
import { supabase } from "@/lib/supabase";

// 2. Fetch
const { data, error } = await supabase
  .from("table_name")
  .select("*");

// 3. Insert
const { data, error } = await supabase
  .from("table_name")
  .insert([{ name: "value" }])
  .select();

// 4. Update
const { error } = await supabase
  .from("table_name")
  .update({ name: "new_value" })
  .eq("id", id);

// 5. Delete
const { error } = await supabase
  .from("table_name")
  .delete()
  .eq("id", id);
```

---

## ✅ Checklist for Completion

- [ ] Run SQL schema in Supabase dashboard
- [ ] Run seed database script
- [ ] Test Specialties page (Add/Edit/Delete)
- [ ] Connect Locations page
- [ ] Connect Degrees page
- [ ] Connect Clinics page
- [ ] Connect Appointments page
- [ ] Connect Transaction pages (3 tables)
- [ ] Connect Invoices pages (2 pages)
- [ ] Test all CRUD operations
- [ ] Verify data appears in Supabase portal

---

## 🐛 Troubleshooting

**Error: "Cannot connect to Supabase"**
- Check `.env.local` has correct URL and API key
- Restart Next.js dev server: `npm run dev`

**Error: "Table not found"**
- Verify SQL schema was run in Supabase dashboard
- Check table names match exactly (case-sensitive)

**Error: "Permission denied"**
- Verify ANON_KEY has query permissions in Supabase
- Check Row Level Security (RLS) policies

**Icons not displaying**
- Base64 stored in icon column (text field)
- To migrate to Supabase Storage, update seedDatabase.ts

---

## 📞 Status

**Last Updated**: February 16, 2026
**State**: Ready for Supabase Dashboard Configuration
**Next Action**: Run SQL schema, then seed database

