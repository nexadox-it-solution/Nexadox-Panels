-- Fix: invoices.appointment_id FK missing ON DELETE SET NULL
-- This caused "violates foreign key constraint" when bulk deleting appointments
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_appointment_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
