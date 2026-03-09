# API Testing Guide - Nexadox

This guide provides example API calls for testing the Nexadox wallet and commission system.

## Prerequisites

- Postman, Insomnia, or curl
- Valid authentication token (get from login)
- Supabase project running with seed data

---

## Authentication

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "agent@nexadox.com",
  "password": "password123"
}

# Response
{
  "user": { ... },
  "token": "eyJhbGc..."
}
```

Use the token in subsequent requests:
```
Authorization: Bearer eyJhbGc...
```

---

## Wallet API Testing

### 1. Get Wallet Balance
```bash
GET /api/wallet?action=balance

# Response
{
  "balance": 15000
}
```

### 2. Get Wallet Transactions
```bash
GET /api/wallet?action=transactions&limit=10

# Response
[
  {
    "id": "uuid",
    "amount": 500,
    "type": "debit",
    "description": "Appointment booking with Dr. Smith",
    "created_at": "2024-02-15T10:30:00Z"
  },
  ...
]
```

### 3. Get Both Balance & Transactions
```bash
GET /api/wallet

# Response
{
  "balance": 15000,
  "transactions": [...]
}
```

### 4. Top-Up Wallet (Credit)
```bash
POST /api/wallet
Content-Type: application/json

{
  "amount": 5000,
  "type": "credit",
  "description": "Wallet top-up via UPI",
  "reference_type": "top_up",
  "reference_id": "upi_txn_123456"
}

# Response
{
  "id": "uuid",
  "user_id": "uuid",
  "amount": 5000,
  "type": "credit",
  "description": "Wallet top-up via UPI",
  "balance_after": 20000,
  "created_at": "2024-02-15T10:30:00Z"
}
```

### 5. Deduct from Wallet (should fail if insufficient balance)
```bash
POST /api/wallet
Content-Type: application/json

{
  "amount": 100000,
  "type": "debit",
  "description": "Test deduction",
  "reference_type": "test"
}

# Response (Error)
{
  "error": "Insufficient wallet balance"
}
```

---

## Booking API Testing

### 1. Create Booking with Payment
```bash
POST /api/bookings
Content-Type: application/json

{
  "action": "create",
  "patientId": "patient-uuid",
  "doctorId": "doctor-uuid",
  "agentId": "agent-uuid",
  "appointmentDate": "2024-02-20",
  "appointmentTime": "10:00:00",
  "consultationType": "in_person",
  "symptoms": "Chest pain and shortness of breath",
  "notes": "First visit"
}

# Response (Success)
{
  "success": true,
  "appointment": {
    "id": "appointment-uuid",
    "patient_id": "patient-uuid",
    "doctor_id": "doctor-uuid",
    "agent_id": "agent-uuid",
    "appointment_date": "2024-02-20 10:00:00",
    "consultation_fee": 500,
    "status": "scheduled",
    "payment_status": "paid",
    "token_number": null
  },
  "walletTransaction": {
    "id": "transaction-uuid",
    "amount": 500,
    "type": "debit",
    "description": "Appointment booking with Dr. Smith"
  },
  "commission": {
    "id": "commission-uuid",
    "agent_id": "agent-uuid",
    "commission_amount": 50,
    "rate": 10
  }
}

# Response (Insufficient Balance)
{
  "success": false,
  "error": "Insufficient wallet balance"
}
```

### 2. Cancel Booking with Refund
```bash
POST /api/bookings
Content-Type: application/json

{
  "action": "cancel",
  "appointmentId": "appointment-uuid",
  "cancelReason": "Patient not available",
  "refundAmount": 500
}

# Response
{
  "success": true,
  "appointment": {
    "id": "appointment-uuid",
    "status": "cancelled",
    "cancellation_reason": "Patient not available",
    "cancelled_at": "2024-02-15T11:00:00Z"
  },
  "walletTransaction": {
    "id": "refund-transaction-uuid",
    "amount": 500,
    "type": "credit",
    "description": "Refund: Patient not available"
  }
}
```

### 3. Reschedule Booking
```bash
POST /api/bookings
Content-Type: application/json

{
  "action": "reschedule",
  "appointmentId": "appointment-uuid",
  "newDate": "2024-02-21",
  "newTime": "14:00:00"
}

# Response
{
  "success": true,
  "appointment": {
    "id": "appointment-uuid",
    "appointment_date": "2024-02-21 14:00:00",
    "status": "scheduled"
  }
}
```

### 4. Complete Appointment
```bash
POST /api/bookings
Content-Type: application/json

{
  "action": "complete",
  "appointmentId": "appointment-uuid",
  "diagnosis": "Hypertension Stage 1",
  "prescription": "Amlodipine 5mg once daily\nLifestyle modifications",
  "notes": "Patient advised to monitor BP daily. Follow-up in 2 weeks."
}

# Response
{
  "success": true,
  "appointment": {
    "id": "appointment-uuid",
    "status": "completed",
    "consultation_end": "2024-02-20T11:00:00Z"
  }
}
```

---

## Commission API Testing

### 1. Get Agent Commissions
```bash
GET /api/commissions

# Response
[
  {
    "id": "commission-uuid",
    "agent_id": "agent-uuid",
    "appointment_id": "appointment-uuid",
    "commission_amount": 50,
    "created_at": "2024-02-15T10:30:00Z",
    "appointments": {
      "appointment_date": "2024-02-20 10:00:00",
      "consultation_fee": 500,
      "patients": {
        "users": {
          "full_name": "John Doe"
        }
      },
      "doctors": {
        "users": {
          "full_name": "Dr. Sarah Smith"
        }
      }
    }
  },
  ...
]
```

### 2. Get Commissions with Date Filter
```bash
GET /api/commissions?startDate=2024-02-01&endDate=2024-02-15

# Response
[...filtered commissions...]
```

### 3. Manually Calculate & Log Commission
```bash
POST /api/commissions
Content-Type: application/json

{
  "appointmentId": "appointment-uuid",
  "agentId": "agent-uuid",
  "consultationFee": 500
}

# Response
{
  "id": "commission-uuid",
  "agent_id": "agent-uuid",
  "appointment_id": "appointment-uuid",
  "commission_amount": 50,
  "created_at": "2024-02-15T10:30:00Z"
}
```

---

## Queue API Testing

### 1. Get Current Queue
```bash
GET /api/queue?doctorId=doctor-uuid&date=2024-02-15

# Response
[
  {
    "id": "appointment-uuid",
    "token_number": 15,
    "status": "in_progress",
    "check_in_time": "2024-02-15T09:45:00Z",
    "patients": {
      "users": {
        "full_name": "Jane Smith",
        "mobile": "+1234567890"
      }
    }
  },
  {
    "id": "appointment-uuid-2",
    "token_number": 16,
    "status": "waiting",
    "check_in_time": "2024-02-15T10:00:00Z",
    "patients": {
      "users": {
        "full_name": "John Doe",
        "mobile": "+1234567891"
      }
    }
  }
]
```

### 2. Check-In Patient (Generate Token)
```bash
POST /api/queue
Content-Type: application/json

{
  "appointmentId": "appointment-uuid",
  "date": "2024-02-15"
}

# Response
{
  "id": "appointment-uuid",
  "token_number": 17,
  "status": "waiting",
  "check_in_time": "2024-02-15T10:15:00Z",
  "appointment_date": "2024-02-15 10:30:00"
}
```

### 3. Call Next Patient
```bash
POST /api/queue/next
Content-Type: application/json

{
  "doctorId": "doctor-uuid"
}

# Response
{
  "id": "appointment-uuid",
  "token_number": 16,
  "status": "in_progress",
  "consultation_start": "2024-02-15T10:20:00Z",
  "patients": {
    "users": {
      "full_name": "John Doe",
      "mobile": "+1234567891"
    }
  }
}
```

---

## Appointments API Testing

### 1. Get All Appointments
```bash
GET /api/appointments

# Response
[
  {
    "id": "appointment-uuid",
    "appointment_date": "2024-02-20 10:00:00",
    "status": "scheduled",
    "consultation_fee": 500,
    "patients": {...},
    "doctors": {...},
    "agents": {...}
  },
  ...
]
```

### 2. Get Appointments with Filters
```bash
# By Doctor
GET /api/appointments?doctorId=doctor-uuid

# By Patient
GET /api/appointments?patientId=patient-uuid

# By Agent
GET /api/appointments?agentId=agent-uuid

# By Status
GET /api/appointments?status=scheduled

# By Date
GET /api/appointments?date=2024-02-15

# Multiple Filters
GET /api/appointments?doctorId=doctor-uuid&status=scheduled&date=2024-02-15
```

### 3. Get Single Appointment
```bash
GET /api/appointments?id=appointment-uuid

# Response
{
  "id": "appointment-uuid",
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "appointment_date": "2024-02-20 10:00:00",
  "status": "scheduled",
  "consultation_fee": 500,
  "payment_status": "paid",
  "patients": {
    "id": "patient-uuid",
    "users": {
      "full_name": "John Doe",
      "email": "john@example.com",
      "mobile": "+1234567890"
    }
  },
  "doctors": {
    "id": "doctor-uuid",
    "users": {
      "full_name": "Dr. Sarah Smith"
    },
    "specialties": {
      "name": "Cardiology"
    }
  }
}
```

### 4. Create Appointment (Basic)
```bash
POST /api/appointments
Content-Type: application/json

{
  "patient_id": "patient-uuid",
  "doctor_id": "doctor-uuid",
  "agent_id": "agent-uuid",
  "appointment_date": "2024-02-20 10:00:00",
  "consultation_type": "in_person",
  "consultation_fee": 500,
  "symptoms": "Chest pain",
  "status": "scheduled",
  "payment_status": "pending"
}

# Response
{
  "id": "new-appointment-uuid",
  ...appointment data
}
```

### 5. Update Appointment Status
```bash
PATCH /api/appointments
Content-Type: application/json

{
  "id": "appointment-uuid",
  "status": "completed",
  "consultation_end": "2024-02-20T11:00:00Z"
}

# Response
{
  "id": "appointment-uuid",
  "status": "completed",
  "consultation_end": "2024-02-20T11:00:00Z"
}
```

---

## Dashboard Stats API Testing

### 1. Get User Stats (Role-based)
```bash
GET /api/stats

# Doctor Response
{
  "todayAppointments": 12,
  "queueCount": 5,
  "totalPatients": 234
}

# Agent Response
{
  "totalBookings": 45,
  "pendingBookings": 8,
  "monthlyEarnings": 2250,
  "walletBalance": 15000
}

# Attendant Response
{
  "todayCheckIns": 15,
  "queueCount": 8,
  "tokensIssued": 15
}
```

---

## Testing Workflow

### Complete Booking Flow Test

```bash
# 1. Top-up wallet
POST /api/wallet
{ "amount": 10000, "type": "credit", "description": "Initial top-up" }

# 2. Check balance
GET /api/wallet?action=balance
# Expected: { "balance": 10000 }

# 3. Create booking
POST /api/bookings
{ "action": "create", "patientId": "...", "doctorId": "...", "agentId": "...", ... }
# Expected: success, wallet deducted, commission credited

# 4. Check balance again
GET /api/wallet?action=balance
# Expected: { "balance": 9500 } (10000 - 500 fee)

# 5. Check agent commission
GET /api/commissions
# Expected: commission logged with amount 50 (10% of 500)

# 6. Check-in patient
POST /api/queue
{ "appointmentId": "...", "date": "2024-02-15" }
# Expected: token generated

# 7. View queue
GET /api/queue?doctorId=...&date=2024-02-15
# Expected: patient in queue with token number

# 8. Call next patient
POST /api/queue/next
{ "doctorId": "..." }
# Expected: patient status changed to "in_progress"

# 9. Complete appointment
POST /api/bookings
{ "action": "complete", "appointmentId": "...", "diagnosis": "...", "prescription": "..." }
# Expected: appointment marked completed

# 10. Cancel and refund (test cancellation)
POST /api/bookings
{ "action": "cancel", "appointmentId": "...", "cancelReason": "Test cancellation" }
# Expected: refund processed, balance restored
```

---

## Error Scenarios to Test

### 1. Insufficient Wallet Balance
```bash
POST /api/bookings
{ "action": "create", ..., consultation_fee: 50000 }
# Expected: { "success": false, "error": "Insufficient wallet balance" }
```

### 2. Double Check-In
```bash
POST /api/queue
{ "appointmentId": "already-checked-in-id" }
# Expected: Error or same token returned
```

### 3. Cancel Completed Appointment
```bash
POST /api/bookings
{ "action": "cancel", "appointmentId": "completed-appointment-id" }
# Expected: { "success": false, "error": "Cannot cancel completed appointment" }
```

### 4. Unauthorized Access
```bash
# Remove Authorization header
GET /api/wallet
# Expected: { "error": "Unauthorized" }, status: 401
```

---

## Notes

- All timestamps are in ISO 8601 format
- All monetary amounts are in smallest currency unit (e.g., paise for INR)
- Token numbers reset daily (start from 1 each day)
- Commission rates are percentage-based (10 = 10%)
- Real-time subscriptions require WebSocket connection

---

## Support

For API issues or questions:
- Check browser console for detailed errors
- Check Supabase logs for database errors
- Review [WALLET_COMMISSION_DOCS.md](./WALLET_COMMISSION_DOCS.md) for business logic

