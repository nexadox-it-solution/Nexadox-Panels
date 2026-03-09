// @ts-nocheck
import { createServerClient } from "@/lib/supabase/server";
import { calculateCommission, getAgentCommissions } from "@/lib/supabase/queries";
import { creditAgentCommission } from "./wallet.service";

/**
 * Commission Service
 * Handles all commission-related operations for booking agents
 */

export interface CommissionCalculation {
  appointmentId: string;
  agentId: string;
  consultationFee: number;
  commissionRate: number;
  commissionAmount: number;
}

/**
 * Calculate commission amount based on agent's rate
 */
export async function calculateAgentCommission(
  agentId: string,
  consultationFee: number
): Promise<{ rate: number; amount: number }> {
  try {
    const supabase = await createServerClient();

    // Get agent's commission rate
    const { data: agent, error } = await supabase
      .from("agents")
      .select("commission_rate")
      .eq("id", agentId)
      .single();

    if (error || !agent) {
      throw new Error("Agent not found");
    }

    const commissionAmount = (consultationFee * agent.commission_rate) / 100;

    return {
      rate: agent.commission_rate,
      amount: commissionAmount,
    };
  } catch (error: any) {
    console.error("Error calculating commission:", error);
    throw error;
  }
}

/**
 * Process commission for completed appointment
 * This includes logging the commission and crediting agent wallet
 */
export async function processAppointmentCommission(
  appointmentId: string,
  agentId: string,
  consultationFee: number
): Promise<{ success: boolean; commission?: any; error?: string }> {
  try {
    // Calculate commission
    const { rate, amount } = await calculateAgentCommission(
      agentId,
      consultationFee
    );

    // Log commission using stored procedure
    const commission = await calculateCommission(
      appointmentId,
      agentId,
      consultationFee
    );

    // Credit agent's wallet
    const walletResult = await creditAgentCommission(
      agentId,
      amount,
      appointmentId
    );

    if (!walletResult.success) {
      return {
        success: false,
        error: walletResult.error || "Failed to credit agent commission",
      };
    }

    return {
      success: true,
      commission: {
        ...commission,
        rate,
        amount,
        walletTransaction: walletResult.transaction,
      },
    };
  } catch (error: any) {
    console.error("Error processing appointment commission:", error);
    return {
      success: false,
      error: error.message || "Failed to process commission",
    };
  }
}

/**
 * Get agent's commission summary
 */
export async function getAgentCommissionSummary(agentId: string) {
  try {
    const supabase = await createServerClient();

    // Get all-time commissions
    const allCommissions = await getAgentCommissions(agentId);

    const totalEarnings =
      allCommissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;

    // Get this month's commissions
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).toISOString();

    const monthCommissions = await getAgentCommissions(agentId, {
      startDate: startOfMonth,
    });

    const monthlyEarnings =
      monthCommissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;

    // Get this week's commissions
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weekCommissions = await getAgentCommissions(agentId, {
      startDate: startOfWeek.toISOString(),
    });

    const weeklyEarnings =
      weekCommissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;

    // Get today's commissions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCommissions = await getAgentCommissions(agentId, {
      startDate: today.toISOString(),
    });

    const todayEarnings =
      todayCommissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;

    // Get agent details
    const { data: agent } = await supabase
      .from("agents")
      .select("commission_rate, wallet_earnings, total_bookings")
      .eq("id", agentId)
      .single();

    return {
      totalEarnings,
      monthlyEarnings,
      weeklyEarnings,
      todayEarnings,
      commissionRate: agent?.commission_rate || 0,
      walletBalance: agent?.wallet_earnings || 0,
      totalBookings: agent?.total_bookings || 0,
      transactionCount: allCommissions?.length || 0,
      averageCommission:
        allCommissions && allCommissions.length > 0
          ? totalEarnings / allCommissions.length
          : 0,
    };
  } catch (error: any) {
    console.error("Error getting commission summary:", error);
    throw error;
  }
}

/**
 * Get agent's top earning periods
 */
export async function getAgentTopEarnings(agentId: string, limit: number = 5) {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("commission_logs")
      .select(`
        *,
        appointments (
          appointment_date,
          patients (
            users (
              full_name
            )
          ),
          doctors (
            users (
              full_name
            )
          )
        )
      `)
      .eq("agent_id", agentId)
      .order("commission_amount", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data;
  } catch (error: any) {
    console.error("Error getting top earnings:", error);
    throw error;
  }
}

/**
 * Calculate pending commissions (appointments completed but not yet paid)
 */
export async function getPendingCommissions(agentId: string) {
  try {
    const supabase = await createServerClient();

    // Get completed appointments without commission logs
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        id,
        consultation_fee,
        appointment_date,
        patients (
          users (
            full_name
          )
        ),
        doctors (
          users (
            full_name
          )
        )
      `)
      .eq("agent_id", agentId)
      .eq("status", "completed")
      .is("commission_paid", false);

    if (error) throw error;

    // Calculate commission for each
    const { rate } = await calculateAgentCommission(agentId, 0);

    const pendingCommissions =
      appointments?.map((apt) => ({
        appointmentId: apt.id,
        consultationFee: apt.consultation_fee,
        commissionAmount: (apt.consultation_fee * rate) / 100,
        appointmentDate: apt.appointment_date,
        patientName: apt.patients?.users?.full_name,
        doctorName: apt.doctors?.users?.full_name,
      })) || [];

    const totalPending =
      pendingCommissions.reduce((sum, c) => sum + c.commissionAmount, 0) || 0;

    return {
      count: pendingCommissions.length,
      totalAmount: totalPending,
      commissions: pendingCommissions,
    };
  } catch (error: any) {
    console.error("Error getting pending commissions:", error);
    throw error;
  }
}

/**
 * Generate commission report for date range
 */
export async function generateCommissionReport(
  agentId: string,
  startDate: string,
  endDate: string
) {
  try {
    const commissions = await getAgentCommissions(agentId, {
      startDate,
      endDate,
    });

    const totalEarnings =
      commissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;

    // Group by date
    const dailyEarnings: { [key: string]: number } = {};
    commissions?.forEach((c) => {
      const date = new Date(c.created_at).toISOString().split("T")[0];
      dailyEarnings[date] = (dailyEarnings[date] || 0) + c.commission_amount;
    });

    // Group by doctor
    const earningsByDoctor: { [key: string]: { count: number; total: number } } =
      {};
    commissions?.forEach((c) => {
      const doctorName = c.appointments?.doctors?.users?.full_name || "Unknown";
      if (!earningsByDoctor[doctorName]) {
        earningsByDoctor[doctorName] = { count: 0, total: 0 };
      }
      earningsByDoctor[doctorName].count++;
      earningsByDoctor[doctorName].total += c.commission_amount;
    });

    return {
      period: { startDate, endDate },
      totalEarnings,
      transactionCount: commissions?.length || 0,
      averageCommission:
        commissions && commissions.length > 0
          ? totalEarnings / commissions.length
          : 0,
      dailyBreakdown: dailyEarnings,
      doctorBreakdown: earningsByDoctor,
      transactions: commissions,
    };
  } catch (error: any) {
    console.error("Error generating commission report:", error);
    throw error;
  }
}
