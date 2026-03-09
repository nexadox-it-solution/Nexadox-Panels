-- Create patient record for Dip Ganguly (real data from appointments)
INSERT INTO patients (name, email, phone, status, created_at)
SELECT 'Dip Ganguly', 'dip2025@gmail.com', '9875558993', 'active', NOW()
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE phone = '9875558993' OR email = 'dip2025@gmail.com');

-- Link existing appointments to this patient
UPDATE appointments 
SET patient_id = (SELECT id FROM patients WHERE phone = '9875558993' LIMIT 1)
WHERE patient_name = 'Dip Ganguly' AND patient_id IS NULL;
