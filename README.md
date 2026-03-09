# Nexadox - Doctor Booking & Clinic Management SaaS

<div align="center">
  <h3>🏥 Modern Healthcare Management Platform</h3>
  <p>Comprehensive clinic management system with multi-role access, real-time queue management, wallet system, and commission tracking</p>
</div>

---

## 🚀 Project Overview

**Nexadox** is a full-featured SaaS platform designed for modern healthcare clinics and hospitals. It provides complete management tools for administrators, doctors, attendants, and booking agents, with a focus on seamless patient experience through real-time updates and automated workflows.

### Key Features

- 🔐 **Multi-role Authentication** - Admin, Doctor, Attendant, Agent portals
- 💰 **Wallet System** - Patient wallet with top-up, deduction, refund capabilities
- 💸 **Commission Tracking** - Automated agent commission calculation and payout
- 📊 **Real-time Queue** - Live queue updates with Supabase Realtime
- 🎫 **Token Management** - Automated token generation for check-ins
- 📅 **Appointment Booking** - Complete booking workflow with payment processing
- 📱 **Responsive Design** - Mobile-first UI with Tailwind CSS
- 🔔 **Notifications** - Real-time notifications for all user roles
- 📈 **Analytics Dashboard** - Performance metrics for all roles

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling with custom design tokens
- **Shadcn UI** - Headless UI components
- **Lucide React** - Beautiful outline icons

### Backend
- **Supabase** - PostgreSQL database with Row Level Security
- **Supabase Auth** - JWT-based authentication
- **Supabase Realtime** - WebSocket subscriptions for live updates
- **PostgreSQL Functions** - Stored procedures for business logic
- **Database Triggers** - Automated data updates

### State Management & API
- **React Server Components** - Server-side data fetching
- **API Routes** - Next.js API endpoints
- **Custom Hooks** - Real-time data subscriptions

---

## 📁 Project Structure

```
nexadox/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Authentication routes
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── admin/               # Admin portal (4 pages)
│   │   ├── doctor/              # Doctor portal (7 pages)
│   │   ├── agent/               # Agent portal (9 pages)
│   │   ├── attendant/           # Attendant portal (6 pages)
│   │   └── api/                 # API routes
│   │       ├── appointments/
│   │       ├── bookings/
│   │       ├── queue/
│   │       ├── wallet/
│   │       ├── commissions/
│   │       └── stats/
│   ├── components/
│   │   └── ui/                  # Shadcn UI components
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   └── useRealtimeData.ts   # Real-time hooks
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser client
│   │   │   ├── server.ts        # Server client
│   │   │   └── queries.ts       # Database queries
│   │   ├── services/
│   │   │   ├── wallet.service.ts
│   │   │   ├── commission.service.ts
│   │   │   └── booking.service.ts
│   │   ├── api/
│   │   │   └── client.ts        # API client utilities
│   │   └── utils.ts
│   ├── middleware.ts            # Auth middleware
│   └── types/
│       └── index.ts             # TypeScript types
├── supabase/
│   └── schema.sql               # Database schema (16 tables)
├── public/
├── WALLET_COMMISSION_DOCS.md    # Detailed system docs
├── .env.example
└── README.md
```

---

## 🗄️ Database Schema

### Core Tables (16 total)

1. **users** - All user accounts with wallet_balance
2. **doctors** - Doctor profiles with specialization
3. **agents** - Booking agent profiles with commission rates
4. **attendants** - Front desk staff profiles
5. **patients** - Patient profiles with medical history
6. **specialties** - Medical specializations
7. **categories** - Service categories
8. **appointments** - Booking records with payment status
9. **doctor_schedules** - Weekly availability
10. **wallet_transactions** - All wallet activity logs
11. **commission_logs** - Agent commission records
12. **health_records** - Patient medical records
13. **notifications** - User notifications
14. **feedback** - Patient feedback
15. **agent_approvals** - Agent approval workflow
16. **system_settings** - Application configuration

### Key Features

- ✅ **Row Level Security (RLS)** - Multi-tenant data isolation
- ✅ **Stored Procedures** - `update_wallet_balance()`, `log_commission()`, `get_next_token_number()`
- ✅ **Triggers** - Automated token generation, wallet updates
- ✅ **Indexes** - Optimized queries for performance
- ✅ **Foreign Keys** - Referential integrity

---

## 🚦 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **Supabase Account** (free tier available)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/nexadox.git
cd nexadox
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**

- Create a new project at [supabase.com](https://supabase.com)
- Copy your project URL and anon key
- Run the database schema:
  ```bash
  # Copy the contents of supabase/schema.sql
  # Paste and execute in Supabase SQL Editor
  ```

4. **Configure environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. **Run the development server**
```bash
npm run dev
```

6. **Open your browser**
```
http://localhost:3000
```

---

## 👥 User Roles & Access

### Admin Portal (`/admin`)
- Dashboard with system overview
- User management (CRUD operations)
- Doctor management (approval, specialization)
- Agent management (commission rates, approval)
- System settings

### Doctor Portal (`/doctor`)
- Dashboard with today's stats
- Appointments management
- Real-time queue monitoring
- Patient records access
- Weekly schedule configuration
- Professional profile management
- Settings (consultation times, notifications)

### Agent Portal (`/agent`)
- Dashboard with earnings overview
- Wallet management (balance, transactions, top-up)
- 4-step booking wizard
- Booking history with filters
- Commission reports
- Performance analytics
- Earnings breakdown

### Attendant Portal (`/attendant`)
- Dashboard with queue overview
- Patient check-in (scheduled & walk-in)
- Real-time queue display
- Token management (print, cancel, modify)
- Check-in history
- Performance stats

---

## 💰 Wallet & Commission System

See [WALLET_COMMISSION_DOCS.md](./WALLET_COMMISSION_DOCS.md) for detailed documentation.

### Wallet Features

- ✅ Patient wallet for appointment payments
- ✅ Top-up via payment gateway
- ✅ Automatic deduction on booking
- ✅ Refund processing on cancellation
- ✅ Transaction history with filtering
- ✅ Low balance notifications
- ✅ Real-time balance updates

### Commission Features

- ✅ Configurable commission rates per agent
- ✅ Automatic commission calculation
- ✅ Commission logging with appointment linkage
- ✅ Agent wallet credit on completion
- ✅ Earnings reports (daily, weekly, monthly)
- ✅ Top earnings tracking
- ✅ Pending commission reports

### Booking Flow

```
1. Patient selects doctor & time
2. System checks wallet balance
3. Deducts consultation fee
4. Creates appointment (paid status)
5. Calculates & credits agent commission (if applicable)
6. Sends notifications to all parties
7. Generates check-in token on arrival
```

---

## 🔔 Real-time Features

### Supabase Realtime Subscriptions

**Queue Updates**
```typescript
const { queue, loading, error, refetch } = useQueueRealtime(doctorId);
// Auto-refreshes when:
// - Patient checks in
// - Doctor calls next patient
// - Appointment status changes
```

**Wallet Balance**
```typescript
const { balance, loading } = useWalletBalance();
// Auto-refreshes when:
// - Top-up successful
// - Appointment payment deducted
// - Refund processed
```

**Notifications**
```typescript
const { notifications, unreadCount, markAsRead } = useNotifications();
// Real-time notifications for:
// - New appointments
// - Cancellations
// - Queue position updates
// - Low balance alerts
```

---

## 📡 API Endpoints

### Booking API (`/api/bookings`)
- `POST /api/bookings` - Create/Cancel/Reschedule/Complete booking

### Wallet API (`/api/wallet`)
- `GET /api/wallet` - Fetch balance & transactions
- `POST /api/wallet` - Create transaction (top-up, deduct)

### Commission API (`/api/commissions`)
- `GET /api/commissions` - Get agent commissions
- `POST /api/commissions` - Calculate & log commission

### Queue API (`/api/queue`)
- `GET /api/queue` - Fetch current queue
- `POST /api/queue` - Check-in patient (generates token)
- `POST /api/queue/next` - Call next patient

### Appointments API (`/api/appointments`)
- `GET /api/appointments` - List with filters
- `POST /api/appointments` - Create appointment
- `PATCH /api/appointments` - Update appointment

### Stats API (`/api/stats`)
- `GET /api/stats` - Get dashboard stats by role

---

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

### Environment Variables (Production)

```env
NEXT_PUBLIC_SUPABASE_URL=your_production_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 🔒 Security Features

- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **Row Level Security** - Database-level authorization
- ✅ **Middleware Protection** - Route-based access control
- ✅ **CORS Configuration** - Restricted API access
- ✅ **SQL Injection Prevention** - Parameterized queries
- ✅ **XSS Protection** - Input sanitization

---

## 📱 Patient Flutter App

The patient-facing mobile application is built separately using **Flutter** and communicates with the same Supabase backend.

### Features
- Patient registration & profile
- Doctor search & filtering
- Appointment booking
- Wallet management
- Real-time queue tracking
- Medical records access
- Push notifications

---

## 🛣️ Development Status

### Phase 1 - Foundation ✅
- [x] Project setup & configuration
- [x] Database schema (16 tables)
- [x] Authentication system
- [x] Middleware & routing
- [x] Type definitions

### Phase 2 - Portals ✅
- [x] Admin panel (4 pages)
- [x] Agent portal (9 pages)
- [x] Doctor portal (7 pages)
- [x] Attendant portal (6 pages)

### Phase 3 - Integration ✅
- [x] API endpoints
- [x] Wallet & commission system
- [x] Booking workflow
- [x] Real-time subscriptions
- [x] Comprehensive documentation

### Phase 4 - Next Steps 🚧
- [ ] Payment gateway integration (Razorpay/Stripe)
- [ ] Email & SMS notifications
- [ ] Advanced analytics
- [ ] Testing & optimization
- [ ] Production deployment

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🆘 Support

For issues or questions:

- 📧 Email: support@nexadox.com
- 🐛 GitHub Issues: [Create an issue](https://github.com/yourusername/nexadox/issues)

---

<div align="center">
  <p>Made with ❤️ for better healthcare management</p>
  <p>© 2026 Nexadox. All rights reserved.</p>
</div>

---

**Built with ❤️ using Next.js 14 and Supabase**
