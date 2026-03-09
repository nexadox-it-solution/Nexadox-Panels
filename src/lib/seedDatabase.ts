import { supabase } from "@/lib/supabase";

export async function seedDatabase() {
  try {
    // 1. Insert Specialties
    const specialties = [
      {
        name: "Cardiology",
        description: "Heart and cardiovascular system",
        icon: "💓",
        doctors_count: 5,
        status: "active",
      },
      {
        name: "Neurology",
        description: "Brain and nervous system",
        icon: "🧠",
        doctors_count: 3,
        status: "active",
      },
      {
        name: "Pediatrics",
        description: "Children's health",
        icon: "👶",
        doctors_count: 7,
        status: "active",
      },
      {
        name: "Orthopedics",
        description: "Bones and musculoskeletal system",
        icon: "🦴",
        doctors_count: 4,
        status: "active",
      },
      {
        name: "Dermatology",
        description: "Skin disorders and treatment",
        icon: "🩹",
        doctors_count: 2,
        status: "active",
      },
    ];

    const { data: specialtiesData, error: specialtiesError } = await supabase
      .from("specialties")
      .insert(specialties);
    if (specialtiesError) console.error("Specialties error:", specialtiesError);
    else console.log("✅ Specialties inserted");

    // 2. Insert Degrees
    const degrees = [
      {
        name: "MBBS",
        description: "Bachelor of Medicine, Bachelor of Surgery",
        doctors_count: 12,
        status: "active",
      },
      {
        name: "MD",
        description: "Doctor of Medicine",
        doctors_count: 8,
        status: "active",
      },
      {
        name: "DNB",
        description: "Diplomate of National Board",
        doctors_count: 5,
        status: "active",
      },
      {
        name: "BDS",
        description: "Bachelor of Dental Surgery",
        doctors_count: 3,
        status: "active",
      },
    ];

    const { data: degreesData, error: degreesError } = await supabase
      .from("degrees")
      .insert(degrees);
    if (degreesError) console.error("Degrees error:", degreesError);
    else console.log("✅ Degrees inserted");

    // 3. Insert Locations
    const locations = [
      {
        name: "Kolkata Central Clinic",
        city: "Kolkata",
        state: "West Bengal",
        country: "India",
        address: "Salt Lake City",
        status: "active",
      },
      {
        name: "Siliguri Medical Center",
        city: "Siliguri",
        state: "West Bengal",
        country: "India",
        address: "Sevok Road",
        status: "active",
      },
      {
        name: "Malda Healthcare",
        city: "Malda",
        state: "West Bengal",
        country: "India",
        address: "Malda District",
        status: "active",
      },
    ];

    const { data: locationsData, error: locationsError } = await supabase
      .from("locations")
      .insert(locations);
    if (locationsError) console.error("Locations error:", locationsError);
    else console.log("✅ Locations inserted");

    // 4. Insert Clinics
    const clinics = [
      {
        name: "Kolkata Medical Center",
        title: "Premier Healthcare",
        contact_person: "Dr. Ravi Sharma",
        email: "contact@kolkatamedical.in",
        calling_code: "+91",
        mobile: "9876543210",
        latitude: 22.5726,
        longitude: 88.3639,
        building: "Building 1",
        area: "Salt Lake City",
        street: "AQ Block",
        landmark: "Near Metro Station",
        city: "Kolkata",
        state: "West Bengal",
        country: "India",
        pincode: "700091",
        doctors_count: 12,
        status: "active",
      },
      {
        name: "Siliguri Healthcare Clinic",
        title: "Health Plus Clinic",
        contact_person: "Dr. Priya Das",
        email: "contact@siligurihealthcare.in",
        calling_code: "+91",
        mobile: "9876543211",
        latitude: 26.7283,
        longitude: 88.4243,
        building: "Building 2",
        area: "Sevok Road",
        street: "Main Street",
        landmark: "City Center",
        city: "Siliguri",
        state: "West Bengal",
        country: "India",
        pincode: "734001",
        doctors_count: 8,
        status: "active",
      },
      {
        name: "Darjeeling Advanced Hospital",
        title: "Advanced Care Center",
        contact_person: "Dr. Arun Patel",
        email: "contact@darjeelingadvanced.in",
        calling_code: "+91",
        mobile: "9876543212",
        latitude: 27.033,
        longitude: 88.2627,
        building: "Building 3",
        area: "Darjeeling",
        street: "Hill Road",
        landmark: "Tourist Complex",
        city: "Darjeeling",
        state: "West Bengal",
        country: "India",
        pincode: "734101",
        doctors_count: 24,
        status: "active",
      },
    ];

    const { data: clinicsData, error: clinicsError } = await supabase
      .from("clinics")
      .insert(clinics);
    if (clinicsError) console.error("Clinics error:", clinicsError);
    else console.log("✅ Clinics inserted");

    // 5. Insert Appointments
    const appointments = [
      {
        appointment_id: "APT001",
        patient_name: "Rajesh Kumar",
        patient_email: "rajesh.kumar@gmail.com",
        specialty: "Cardiology",
        appointment_date: "2026-02-18",
        appointment_time: "10:00:00",
        status: "scheduled",
        notes: "Regular checkup",
      },
      {
        appointment_id: "APT002",
        patient_name: "Priya Sharma",
        patient_email: "priya.sharma@gmail.com",
        specialty: "Neurology",
        appointment_date: "2026-02-17",
        appointment_time: "14:30:00",
        status: "completed",
        notes: "Follow-up consultation",
      },
      {
        appointment_id: "APT003",
        patient_name: "Amit Patel",
        patient_email: "amit.patel@gmail.com",
        specialty: "Pediatrics",
        appointment_date: "2026-02-16",
        appointment_time: "09:00:00",
        status: "cancelled",
        notes: "Patient requested reschedule",
      },
      {
        appointment_id: "APT004",
        patient_name: "Vikram Singh",
        patient_email: "vikram.singh@gmail.com",
        specialty: "Orthopedics",
        appointment_date: "2026-02-20",
        appointment_time: "15:00:00",
        status: "scheduled",
        notes: "Joint pain consultation",
      },
    ];

    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from("appointments")
      .insert(appointments);
    if (appointmentsError)
      console.error("Appointments error:", appointmentsError);
    else console.log("✅ Appointments inserted");

    // 6. Insert Patient Transactions
    const patientTransactions = [
      {
        txn_id: "TXN_PAT001",
        booking_id: "BOOK001",
        user_id: "USR001",
        user_name: "PRIYA SHARMA",
        user_email: "priya.sharma@gmail.com",
        reason: "Appointment Booking",
        amount: 450,
        balance: 450,
        status: "completed",
        started_on: "2026-02-18",
      },
      {
        txn_id: "TXN_PAT002",
        booking_id: "BOOK002",
        user_id: "USR002",
        user_name: "RAJESH KUMAR",
        user_email: "rajesh.kumar@gmail.com",
        reason: "Consultation Fee",
        amount: 750,
        balance: 750,
        status: "completed",
        started_on: "2026-02-17",
      },
      {
        txn_id: "TXN_PAT003",
        booking_id: "BOOK003",
        user_id: "USR001",
        user_name: "PRIYA SHARMA",
        user_email: "priya.sharma@gmail.com",
        reason: "Follow-up Appointment",
        amount: 1200,
        balance: 1650,
        status: "completed",
        started_on: "2026-02-16",
      },
      {
        txn_id: "TXN_PAT004",
        booking_id: "BOOK004",
        user_id: "USR003",
        user_name: "AMIT PATEL",
        user_email: "amit.patel@gmail.com",
        reason: "Regular Checkup",
        amount: 600,
        balance: 600,
        status: "completed",
        started_on: "2026-02-15",
      },
    ];

    const { data: patientTxnData, error: patientTxnError } = await supabase
      .from("patient_transactions")
      .insert(patientTransactions);
    if (patientTxnError) console.error("Patient Txn error:", patientTxnError);
    else console.log("✅ Patient Transactions inserted");

    // 7. Insert Agent Transactions
    const agentTransactions = [
      {
        txn_id: "TXN_AGT001",
        booking_id: "BOOK005",
        user_id: "AGT001",
        user_name: "VIKRAM SINGH",
        user_email: "vikram.singh@nexadox.app",
        reason: "Booking Charge",
        amount: -300,
        balance: 15300,
        status: "completed",
        started_on: "2026-02-18",
      },
      {
        txn_id: "TXN_AGT002",
        booking_id: "BOOK006",
        user_id: "AGT001",
        user_name: "VIKRAM SINGH",
        user_email: "vikram.singh@nexadox.app",
        reason: "Balance Addition",
        amount: 10000,
        balance: 15300,
        status: "completed",
        started_on: "2026-02-18",
      },
    ];

    const { data: agentTxnData, error: agentTxnError } = await supabase
      .from("agent_transactions")
      .insert(agentTransactions);
    if (agentTxnError) console.error("Agent Txn error:", agentTxnError);
    else console.log("✅ Agent Transactions inserted");

    // 8. Insert Attendant Transactions
    const attendantTransactions = [
      {
        txn_id: "TXN_ATT001",
        booking_id: "BOOK007",
        user_id: "ATT001",
        user_name: "NEHA GUPTA",
        user_email: "neha.gupta@nexadox.app",
        reason: "Service Fee",
        amount: 250,
        balance: 250,
        status: "completed",
        started_on: "2026-02-18",
      },
      {
        txn_id: "TXN_ATT002",
        booking_id: "BOOK008",
        user_id: "ATT001",
        user_name: "NEHA GUPTA",
        user_email: "neha.gupta@nexadox.app",
        reason: "Attendance Bonus",
        amount: 600,
        balance: 850,
        status: "completed",
        started_on: "2026-02-17",
      },
      {
        txn_id: "TXN_ATT003",
        booking_id: "BOOK009",
        user_id: "ATT002",
        user_name: "DIPALI CHATTERJEE",
        user_email: "dipali.chatterjee@nexadox.app",
        reason: "Service Fee",
        amount: 450,
        balance: 450,
        status: "completed",
        started_on: "2026-02-16",
      },
      {
        txn_id: "TXN_ATT004",
        booking_id: "BOOK010",
        user_id: "ATT002",
        user_name: "DIPALI CHATTERJEE",
        user_email: "dipali.chatterjee@nexadox.app",
        reason: "Attendance Bonus",
        amount: 550,
        balance: 1000,
        status: "completed",
        started_on: "2026-02-15",
      },
    ];

    const { data: attTxnData, error: attTxnError } = await supabase
      .from("attendant_transactions")
      .insert(attendantTransactions);
    if (attTxnError) console.error("Attendant Txn error:", attTxnError);
    else console.log("✅ Attendant Transactions inserted");

    // 9. Insert Invoices
    const invoices = [
      {
        txn_id: "TXN_PAT001",
        booking_id: "BOOK001",
        user_id: "USR001",
        user_name: "VIKRAM SINGH",
        user_email: "vikram.singh@nexadox.app",
        invoice_number: "INV/2026/0001",
        invoice_date: "2026-02-18",
        taxable_amount: 1016.95,
        gst_amount: 183.05,
        total_amount: 1200,
        gst_percentage: 18,
        status: "issued",
      },
    ];

    const { data: invoicesData, error: invoicesError } = await supabase
      .from("invoices")
      .insert(invoices);
    if (invoicesError) console.error("Invoices error:", invoicesError);
    else console.log("✅ Invoices inserted");

    console.log("✅ Database seeding completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    return false;
  }
}
