# Nexadox - Wallet & Commission System Documentation

## Overview

Nexadox implements a comprehensive wallet and commission system for managing payments, refunds, and agent commissions. The system is built on **Supabase PostgreSQL** with **atomic transactions** and **triggers** to ensure data consistency.

---

## Architecture

### Database Tables

1. **users** - Stores `wallet_balance` for all users
2. **wallet_transactions** - Logs all wallet activity (credit/debit)
3. **commission_logs** - Tracks agent commission payments
4. **appointments** - Links bookings to payments and commissions
5. **agents** - Stores `commission_rate` and `wallet_earnings`

### Stored Procedures

#### `update_wallet_balance()`
```sql
CREATE OR REPLACE FUNCTION update_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL,
  p_transaction_type VARCHAR,
  p_description TEXT,
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS UUID
```
- Updates user's wallet balance atomically
- Creates transaction record
- Returns transaction ID
- Prevents negative balances (constraint)

#### `log_commission()`
```sql
CREATE OR REPLACE FUNCTION log_commission(
  p_agent_id UUID,
  p_appointment_id UUID,
  p_commission_amount DECIMAL
) RETURNS UUID
```
- Logs commission in `commission_logs`
- Updates `agents.wallet_earnings`
- Returns commission log ID

#### `get_next_token_number()`
```sql
CREATE OR REPLACE FUNCTION get_next_token_number(
  p_date DATE
) RETURNS INTEGER
```
- Generates sequential token numbers per day
- Thread-safe with row locking

---

## Business Logic Services

### Wallet Service (`src/lib/services/wallet.service.ts`)

#### Core Functions

**Check Balance**
```typescript
hasSufficientBalance(userId: string, requiredAmount: number): Promise<boolean>
```

**Deduct Appointment Fee**
```typescript
deductAppointmentFee(
  patientId: string,
  appointmentId: string,
  consultationFee: number,
  doctorName: string
): Promise<{ success: boolean; transaction?: any; error?: string }>
```
- Checks balance first
- Creates debit transaction
- Links to appointment

**Refund Appointment**
```typescript
refundAppointmentFee(
  patientId: string,
  appointmentId: string,
  consultationFee: number,
  reason: string
): Promise<{ success: boolean; transaction?: any; error?: string }>
```
- Creates credit transaction
- Logs refund reason

**Top-Up Wallet**
```typescript
topUpWallet(
  userId: string,
  amount: number,
  paymentMethod: string,
  transactionId?: string
): Promise<{ success: boolean; transaction?: any; error?: string }>
```
- Adds funds to wallet
- In production, verify payment gateway first

**Credit Agent Commission**
```typescript
creditAgentCommission(
  agentId: string,
  commissionAmount: number,
  appointmentId: string
): Promise<{ success: boolean; transaction?: any; error?: string }>
```
- Credits agent's wallet
- Updates `agents.wallet_earnings`

**Get Wallet Summary**
```typescript
getWalletSummary(userId: string): Promise<{
  balance: number;
  totalCredits: number;
  totalDebits: number;
  monthlySpending: number;
  transactionCount: number;
  lastTransaction: any;
}>
```

### Commission Service (`src/lib/services/commission.service.ts`)

#### Core Functions

**Calculate Commission**
```typescript
calculateAgentCommission(
  agentId: string,
  consultationFee: number
): Promise<{ rate: number; amount: number }>
```
- Fetches agent's commission rate
- Calculates commission amount

**Process Commission**
```typescript
processAppointmentCommission(
  appointmentId: string,
  agentId: string,
  consultationFee: number
): Promise<{ success: boolean; commission?: any; error?: string }>
```
- Logs commission
- Credits agent wallet
- Returns full commission object

**Get Commission Summary**
```typescript
getAgentCommissionSummary(agentId: string): Promise<{
  totalEarnings: number;
  monthlyEarnings: number;
  weeklyEarnings: number;
  todayEarnings: number;
  commissionRate: number;
  walletBalance: number;
  totalBookings: number;
  transactionCount: number;
  averageCommission: number;
}>
```

**Get Pending Commissions**
```typescript
getPendingCommissions(agentId: string): Promise<{
  count: number;
  totalAmount: number;
  commissions: Array<{
    appointmentId: string;
    consultationFee: number;
    commissionAmount: number;
    appointmentDate: string;
    patientName: string;
    doctorName: string;
  }>;
}>
```

**Generate Commission Report**
```typescript
generateCommissionReport(
  agentId: string,
  startDate: string,
  endDate: string
): Promise<{
  period: { startDate: string; endDate: string };
  totalEarnings: number;
  transactionCount: number;
  averageCommission: number;
  dailyBreakdown: { [date: string]: number };
  doctorBreakdown: { [doctor: string]: { count: number; total: number } };
  transactions: any[];
}>
```

### Booking Service (`src/lib/services/booking.service.ts`)

#### Complete Booking Workflow

**Create Booking with Payment**
```typescript
createBookingWithPayment(booking: BookingRequest): Promise<BookingResult>
```

**Workflow Steps:**
1. Fetch doctor details and consultation fee
2. Create appointment record (status: `scheduled`, payment_status: `pending`)
3. Deduct consultation fee from patient wallet
4. Update appointment payment_status to `paid`
5. Process agent commission (if booked via agent)
6. Send notifications to patient and doctor
7. Return complete booking result

**Cancel Booking with Refund**
```typescript
cancelBookingWithRefund(
  appointmentId: string,
  cancelReason: string,
  refundAmount?: number
): Promise<BookingResult>
```

**Workflow Steps:**
1. Fetch appointment details
2. Validate cancellation (not already cancelled/completed)
3. Calculate refund amount
4. Process refund to patient wallet
5. Update appointment status to `cancelled`
6. Send cancellation notifications
7. Return result

**Reschedule Booking**
```typescript
rescheduleBooking(
  appointmentId: string,
  newDate: string,
  newTime: string
): Promise<BookingResult>
```

**Complete Appointment**
```typescript
completeAppointment(
  appointmentId: string,
  diagnosis?: string,
  prescription?: string,
  notes?: string
): Promise<BookingResult>
```

**Workflow Steps:**
1. Update appointment status to `completed`
2. Create health record (if diagnosis/prescription provided)
3. Process agent commission (if not already processed)
4. Mark `commission_paid` as true
5. Return result

---

## API Endpoints

### Booking API (`/api/bookings`)

**POST** - Create/Cancel/Reschedule/Complete booking

```typescript
// Create booking
POST /api/bookings
{
  "action": "create",
  "patientId": "uuid",
  "doctorId": "uuid",
  "agentId": "uuid", // optional
  "appointmentDate": "2024-02-15",
  "appointmentTime": "10:00:00",
  "consultationType": "in_person",
  "symptoms": "Chest pain",
  "notes": "Patient has history of hypertension"
}

// Response
{
  "success": true,
  "appointment": { ... },
  "walletTransaction": { ... },
  "commission": { ... }
}
```

```typescript
// Cancel booking
POST /api/bookings
{
  "action": "cancel",
  "appointmentId": "uuid",
  "cancelReason": "Patient not available",
  "refundAmount": 500 // optional, defaults to full fee
}
```

```typescript
// Reschedule booking
POST /api/bookings
{
  "action": "reschedule",
  "appointmentId": "uuid",
  "newDate": "2024-02-16",
  "newTime": "11:00:00"
}
```

```typescript
// Complete appointment
POST /api/bookings
{
  "action": "complete",
  "appointmentId": "uuid",
  "diagnosis": "Hypertension",
  "prescription": "Amlodipine 5mg once daily",
  "notes": "Follow-up in 2 weeks"
}
```

### Wallet API (`/api/wallet`)

**GET** - Fetch wallet data
```typescript
// Get balance only
GET /api/wallet?action=balance

// Get transactions only
GET /api/wallet?action=transactions&limit=50

// Get both
GET /api/wallet
```

**POST** - Create transaction
```typescript
POST /api/wallet
{
  "amount": 1000,
  "type": "credit", // or "debit"
  "description": "Wallet top-up via UPI",
  "reference_type": "top_up",
  "reference_id": "payment_gateway_txn_id"
}
```

### Commission API (`/api/commissions`)

**GET** - Fetch commissions
```typescript
GET /api/commissions?startDate=2024-02-01&endDate=2024-02-15
```

**POST** - Calculate and log commission
```typescript
POST /api/commissions
{
  "appointmentId": "uuid",
  "agentId": "uuid",
  "consultationFee": 500
}
```

### Queue API (`/api/queue`)

**GET** - Fetch queue
```typescript
GET /api/queue?doctorId=uuid&date=2024-02-15
```

**POST** - Check-in patient
```typescript
POST /api/queue
{
  "appointmentId": "uuid",
  "date": "2024-02-15"
}

// Response includes generated token number
{
  "id": "uuid",
  "token_number": 15,
  "status": "waiting",
  ...
}
```

---

## Real-time Features

### React Hooks (`src/hooks/useRealtimeData.ts`)

**Queue Real-time Updates**
```typescript
const { queue, loading, error, refetch } = useQueueRealtime(doctorId);
```
- Subscribes to `appointments` table changes
- Auto-refreshes queue when status changes
- Filters by doctor ID

**Wallet Balance Real-time**
```typescript
const { balance, loading } = useWalletBalance();
```
- Subscribes to `wallet_transactions` table
- Updates balance immediately on new transaction

**Notifications Real-time**
```typescript
const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
```
- Subscribes to `notifications` table
- Updates count on new notification
- Provides mark as read functions

---

## Payment Flow Diagrams

### Patient Booking Flow
```
Patient → Select Doctor → Choose Date/Time
    ↓
Check Wallet Balance
    ↓
[Sufficient?] → NO → Show "Insufficient Balance" + Top-up Button
    ↓ YES
Deduct Consultation Fee
    ↓
Create Appointment (status: scheduled, payment_status: paid)
    ↓
[Agent Involved?] → YES → Calculate & Credit Commission
    ↓
Send Notifications (Patient, Doctor, Agent)
    ↓
Return Booking Confirmation
```

### Cancellation & Refund Flow
```
Cancel Request → Fetch Appointment
    ↓
[Can Cancel?] → NO → Return Error
    ↓ YES
Calculate Refund Amount
    ↓
Credit Patient Wallet
    ↓
Update Appointment (status: cancelled)
    ↓
Send Cancellation Notifications
    ↓
Return Confirmation
```

### Commission Processing Flow
```
Appointment Completed
    ↓
[Agent Involved?] → NO → Skip Commission
    ↓ YES
Fetch Agent Commission Rate
    ↓
Calculate Commission Amount
    ↓
Log Commission in commission_logs
    ↓
Credit Agent Wallet
    ↓
Update agents.wallet_earnings
    ↓
Mark appointment.commission_paid = true
```

---

## Error Handling

### Wallet Errors
- **Insufficient Balance**: Prevent booking, suggest top-up
- **Transaction Failed**: Rollback appointment creation
- **Negative Balance**: Database constraint prevents (CHECK balance >= 0)

### Commission Errors
- **Agent Not Found**: Log error, don't rollback appointment
- **Commission Already Processed**: Check `commission_paid` flag
- **Rate Not Set**: Default to 10% or admin-configured rate

### Booking Errors
- **Doctor Unavailable**: Check schedule before booking
- **Duplicate Booking**: Prevent double-booking same slot
- **Payment Failed**: Rollback entire transaction

---

## Testing

### Test Scenarios

**Wallet Operations**
```typescript
// Test insufficient balance
await deductAppointmentFee(patientId, appointmentId, 5000, "Dr. Smith");
// Expected: { success: false, error: "Insufficient wallet balance" }

// Test successful deduction
await topUpWallet(patientId, 10000, "UPI");
await deductAppointmentFee(patientId, appointmentId, 500, "Dr. Smith");
// Expected: { success: true, transaction: {...} }
```

**Commission Calculation**
```typescript
// Test commission calculation
const { rate, amount } = await calculateAgentCommission(agentId, 500);
// Expected: { rate: 10, amount: 50 } (if commission_rate = 10%)
```

**Booking Flow**
```typescript
// Test complete booking flow
const result = await createBookingWithPayment({
  patientId,
  doctorId,
  agentId,
  appointmentDate: "2024-02-15",
  appointmentTime: "10:00:00",
  consultationType: "in_person",
});
// Expected: { success: true, appointment: {...}, walletTransaction: {...}, commission: {...} }
```

---

## Production Considerations

### Payment Gateway Integration
```typescript
// In topUpWallet(), add payment verification:
const paymentVerified = await verifyPaymentGateway(transactionId);
if (!paymentVerified) {
  return { success: false, error: "Payment verification failed" };
}
```

### Notification Channels
- **Email**: SendGrid / AWS SES
- **SMS**: Twilio / AWS SNS
- **Push**: Firebase Cloud Messaging (for Flutter app)

### Low Balance Alerts
```typescript
// After each debit, check balance
await checkAndNotifyLowBalance(userId, threshold: 100);
```

### Commission Payout
```typescript
// Admin can trigger bulk payout
async function bulkCommissionPayout(agentIds: string[]) {
  for (const agentId of agentIds) {
    const pending = await getPendingCommissions(agentId);
    // Transfer to bank account via payment gateway
    // Mark commissions as paid
  }
}
```

---

## Future Enhancements

1. **Wallet Withdrawal**: Allow agents to withdraw earnings
2. **Multi-currency**: Support international payments
3. **Payment Plans**: Installment payments for expensive procedures
4. **Reward Points**: Loyalty program with points earning
5. **Insurance Integration**: Direct insurance claims processing
6. **Escrow System**: Hold payment until appointment completion

---

## Support & Troubleshooting

### Common Issues

**Issue**: Agent commission not credited
- **Check**: `appointment.commission_paid` flag
- **Solution**: Manually trigger `processAppointmentCommission()`

**Issue**: Wallet balance mismatch
- **Check**: Sum of wallet_transactions vs users.wallet_balance
- **Solution**: Run reconciliation script

**Issue**: Token number conflicts
- **Check**: Multiple check-ins at exact same time
- **Solution**: `get_next_token_number()` uses row locking to prevent

---

## Contact

For technical support or questions about the wallet/commission system:
- Email: dev@nexadox.com
- Slack: #nexadox-backend
- Documentation: https://docs.nexadox.com
