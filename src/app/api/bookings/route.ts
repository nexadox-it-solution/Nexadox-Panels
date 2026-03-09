import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  createBookingWithPayment,
  cancelBookingWithRefund,
  rescheduleBooking,
  completeAppointment,
} from "@/lib/services/booking.service";

// POST /api/bookings - Create new booking with payment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action;

    // Handle different booking actions
    if (action === "create") {
      const {
        patientId,
        doctorId,
        agentId,
        appointmentDate,
        appointmentTime,
        consultationType,
        symptoms,
        notes,
      } = body;

      if (!patientId || !doctorId || !appointmentDate || !appointmentTime) {
        return NextResponse.json(
          {
            error:
              "Patient ID, Doctor ID, appointment date, and time are required",
          },
          { status: 400 }
        );
      }

      const result = await createBookingWithPayment({
        patientId,
        doctorId,
        agentId,
        appointmentDate,
        appointmentTime,
        consultationType: consultationType || "in_person",
        symptoms,
        notes,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json(result, { status: 201 });
    }

    if (action === "cancel") {
      const { appointmentId, cancelReason, refundAmount } = body;

      if (!appointmentId || !cancelReason) {
        return NextResponse.json(
          { error: "Appointment ID and cancel reason are required" },
          { status: 400 }
        );
      }

      const result = await cancelBookingWithRefund(
        appointmentId,
        cancelReason,
        refundAmount
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json(result);
    }

    if (action === "reschedule") {
      const { appointmentId, newDate, newTime } = body;

      if (!appointmentId || !newDate || !newTime) {
        return NextResponse.json(
          { error: "Appointment ID, new date, and new time are required" },
          { status: 400 }
        );
      }

      const result = await rescheduleBooking(appointmentId, newDate, newTime);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json(result);
    }

    if (action === "complete") {
      const { appointmentId, diagnosis, prescription, notes } = body;

      if (!appointmentId) {
        return NextResponse.json(
          { error: "Appointment ID is required" },
          { status: 400 }
        );
      }

      const result = await completeAppointment(
        appointmentId,
        diagnosis,
        prescription,
        notes
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Invalid action. Use: create, cancel, reschedule, or complete" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Booking API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
