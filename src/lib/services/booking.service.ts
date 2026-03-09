// @ts-nocheck
import { createServerClient } from "@/lib/supabase/server";
import { createAppointment } from "@/lib/supabase/queries";
import { deductAppointmentFee, refundAppointmentFee } from "./wallet.service";
import { processAppointmentCommission } from "./commission.service";

/**
 * Booking Service
 * Handles the complete appointment booking workflow including
 * wallet deduction, commission processing, and notifications
 */

export interface BookingRequest {
  patientId: string;
  doctorId: string;
  agentId?: string;
  appointmentDate: string;
  appointmentTime: string;
  consultationType: "in_person" | "video" | "phone";
  symptoms?: string;
  notes?: string;
}

export interface BookingResult {
  success: boolean;
  appointment?: any;
  walletTransaction?: any;
  commission?: any;
  error?: string;
}

/**
 * Create a new appointment booking with complete workflow
 */
export async function createBookingWithPayment(
  booking: BookingRequest
): Promise<BookingResult> {
  const supabase = await createServerClient();

  try {
    // 1. Get doctor and consultation fee
    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select(`
        id,
        consultation_fee,
        users (
          full_name
        )
      `)
      .eq("id", booking.doctorId)
      .single();

    if (doctorError || !doctor) {
      return {
        success: false,
        error: "Doctor not found",
      };
    }

    const consultationFee = doctor.consultation_fee;
    const doctorName = (doctor as any).users?.full_name || "Doctor";

    // 2. Get patient user_id
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("user_id")
      .eq("id", booking.patientId)
      .single();

    if (patientError || !patient) {
      return {
        success: false,
        error: "Patient not found",
      };
    }

    // 3. Create appointment record (status: scheduled)
    const appointmentData = {
      patient_id: booking.patientId,
      doctor_id: booking.doctorId,
      agent_id: booking.agentId || null,
      appointment_date: `${booking.appointmentDate} ${booking.appointmentTime}`,
      consultation_type: booking.consultationType,
      consultation_fee: consultationFee,
      symptoms: booking.symptoms || null,
      notes: booking.notes || null,
      status: "scheduled",
      payment_status: "pending",
    };

    const appointment = await createAppointment(appointmentData);

    // 4. Deduct consultation fee from patient wallet
    const walletResult = await deductAppointmentFee(
      patient.user_id,
      appointment.id,
      consultationFee,
      doctorName
    );

    if (!walletResult.success) {
      // Rollback: Delete the appointment
      await supabase.from("appointments").delete().eq("id", appointment.id);

      return {
        success: false,
        error: walletResult.error || "Failed to process payment",
      };
    }

    // 5. Update appointment payment status
    await supabase
      .from("appointments")
      .update({ payment_status: "paid" })
      .eq("id", appointment.id);

    // 6. Process agent commission if booking was made through agent
    let commissionResult = null;
    if (booking.agentId) {
      commissionResult = await processAppointmentCommission(
        appointment.id,
        booking.agentId,
        consultationFee
      );

      if (!commissionResult.success) {
        console.error("Commission processing failed:", commissionResult.error);
        // Don't rollback the appointment, just log the error
        // Commission can be processed manually later
      }
    }

    // 7. Send notifications
    await sendBookingNotifications(appointment, doctor, patient.user_id);

    // 8. Return success
    return {
      success: true,
      appointment,
      walletTransaction: walletResult.transaction,
      commission: commissionResult?.commission,
    };
  } catch (error: any) {
    console.error("Error creating booking:", error);
    return {
      success: false,
      error: error.message || "Failed to create booking",
    };
  }
}

/**
 * Cancel appointment and process refund
 */
export async function cancelBookingWithRefund(
  appointmentId: string,
  cancelReason: string,
  refundAmount?: number
): Promise<BookingResult> {
  const supabase = await createServerClient();

  try {
    // 1. Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(`
        *,
        patients (
          user_id
        )
      `)
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return {
        success: false,
        error: "Appointment not found",
      };
    }

    // Check if appointment can be cancelled
    if (appointment.status === "completed" || appointment.status === "cancelled") {
      return {
        success: false,
        error: `Cannot cancel ${appointment.status} appointment`,
      };
    }

    // 2. Calculate refund amount (use provided amount or full fee)
    const refund = refundAmount || appointment.consultation_fee;

    // 3. Process refund
    const refundResult = await refundAppointmentFee(
      appointment.patients.user_id,
      appointmentId,
      refund,
      cancelReason
    );

    if (!refundResult.success) {
      return {
        success: false,
        error: refundResult.error || "Failed to process refund",
      };
    }

    // 4. Update appointment status
    const { data: updatedAppointment } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancellation_reason: cancelReason,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", appointmentId)
      .select()
      .single();

    // 5. Send cancellation notifications
    await sendCancellationNotifications(appointment, cancelReason);

    return {
      success: true,
      appointment: updatedAppointment,
      walletTransaction: refundResult.transaction,
    };
  } catch (error: any) {
    console.error("Error cancelling booking:", error);
    return {
      success: false,
      error: error.message || "Failed to cancel booking",
    };
  }
}

/**
 * Reschedule appointment
 */
export async function rescheduleBooking(
  appointmentId: string,
  newDate: string,
  newTime: string
): Promise<BookingResult> {
  const supabase = await createServerClient();

  try {
    // Get appointment
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();

    if (error || !appointment) {
      return {
        success: false,
        error: "Appointment not found",
      };
    }

    // Check if can be rescheduled
    if (appointment.status === "completed" || appointment.status === "cancelled") {
      return {
        success: false,
        error: "Cannot reschedule completed or cancelled appointment",
      };
    }

    // Update appointment date/time
    const { data: updatedAppointment } = await supabase
      .from("appointments")
      .update({
        appointment_date: `${newDate} ${newTime}`,
        status: "scheduled",
      })
      .eq("id", appointmentId)
      .select()
      .single();

    // Send reschedule notifications
    await sendRescheduleNotifications(updatedAppointment);

    return {
      success: true,
      appointment: updatedAppointment,
    };
  } catch (error: any) {
    console.error("Error rescheduling booking:", error);
    return {
      success: false,
      error: error.message || "Failed to reschedule booking",
    };
  }
}

/**
 * Complete appointment (called by doctor after consultation)
 */
export async function completeAppointment(
  appointmentId: string,
  diagnosis?: string,
  prescription?: string,
  notes?: string
): Promise<BookingResult> {
  const supabase = await createServerClient();

  try {
    // Update appointment status
    const { data: appointment } = await supabase
      .from("appointments")
      .update({
        status: "completed",
        consultation_end: new Date().toISOString(),
      })
      .eq("id", appointmentId)
      .select()
      .single();

    // Create health record if diagnosis/prescription provided
    if (diagnosis || prescription || notes) {
      await supabase.from("health_records").insert({
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        appointment_id: appointmentId,
        diagnosis: diagnosis || null,
        prescription: prescription || null,
        notes: notes || null,
      });
    }

    // Process commission if not already processed
    if (appointment.agent_id && !appointment.commission_paid) {
      const commissionResult = await processAppointmentCommission(
        appointmentId,
        appointment.agent_id,
        appointment.consultation_fee
      );

      if (commissionResult.success) {
        await supabase
          .from("appointments")
          .update({ commission_paid: true })
          .eq("id", appointmentId);
      }
    }

    return {
      success: true,
      appointment,
    };
  } catch (error: any) {
    console.error("Error completing appointment:", error);
    return {
      success: false,
      error: error.message || "Failed to complete appointment",
    };
  }
}

/**
 * Send booking confirmation notifications
 */
async function sendBookingNotifications(
  appointment: any,
  doctor: any,
  patientUserId: string
) {
  const supabase = await createServerClient();

  try {
    const appointmentDate = new Date(appointment.appointment_date);
    const formattedDate = appointmentDate.toLocaleDateString();
    const formattedTime = appointmentDate.toLocaleTimeString();

    // Notify patient
    await supabase.from("notifications").insert({
      user_id: patientUserId,
      title: "Appointment Confirmed",
      message: `Your appointment with ${doctor.users.full_name} is confirmed for ${formattedDate} at ${formattedTime}`,
      type: "appointment",
      reference_id: appointment.id,
    });

    // Notify doctor
    const { data: doctorUser } = await supabase
      .from("doctors")
      .select("user_id")
      .eq("id", appointment.doctor_id)
      .single();

    if (doctorUser) {
      await supabase.from("notifications").insert({
        user_id: doctorUser.user_id,
        title: "New Appointment",
        message: `New appointment scheduled for ${formattedDate} at ${formattedTime}`,
        type: "appointment",
        reference_id: appointment.id,
      });
    }
  } catch (error) {
    console.error("Error sending booking notifications:", error);
  }
}

/**
 * Send cancellation notifications
 */
async function sendCancellationNotifications(
  appointment: any,
  reason: string
) {
  const supabase = await createServerClient();

  try {
    // Notify patient
    await supabase.from("notifications").insert({
      user_id: appointment.patients.user_id,
      title: "Appointment Cancelled",
      message: `Your appointment has been cancelled. Reason: ${reason}`,
      type: "appointment",
      reference_id: appointment.id,
    });

    // Notify doctor
    const { data: doctorUser } = await supabase
      .from("doctors")
      .select("user_id")
      .eq("id", appointment.doctor_id)
      .single();

    if (doctorUser) {
      await supabase.from("notifications").insert({
        user_id: doctorUser.user_id,
        title: "Appointment Cancelled",
        message: `An appointment has been cancelled.`,
        type: "appointment",
        reference_id: appointment.id,
      });
    }
  } catch (error) {
    console.error("Error sending cancellation notifications:", error);
  }
}

/**
 * Send reschedule notifications
 */
async function sendRescheduleNotifications(appointment: any) {
  const supabase = await createServerClient();

  try {
    const appointmentDate = new Date(appointment.appointment_date);
    const formattedDate = appointmentDate.toLocaleDateString();
    const formattedTime = appointmentDate.toLocaleTimeString();

    // Get patient user_id
    const { data: patient } = await supabase
      .from("patients")
      .select("user_id")
      .eq("id", appointment.patient_id)
      .single();

    if (patient) {
      await supabase.from("notifications").insert({
        user_id: patient.user_id,
        title: "Appointment Rescheduled",
        message: `Your appointment has been rescheduled to ${formattedDate} at ${formattedTime}`,
        type: "appointment",
        reference_id: appointment.id,
      });
    }

    // Notify doctor
    const { data: doctorUser } = await supabase
      .from("doctors")
      .select("user_id")
      .eq("id", appointment.doctor_id)
      .single();

    if (doctorUser) {
      await supabase.from("notifications").insert({
        user_id: doctorUser.user_id,
        title: "Appointment Rescheduled",
        message: `An appointment has been rescheduled to ${formattedDate} at ${formattedTime}`,
        type: "appointment",
        reference_id: appointment.id,
      });
    }
  } catch (error) {
    console.error("Error sending reschedule notifications:", error);
  }
}
