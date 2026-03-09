import { createServerClient } from "@/lib/supabase/server";
import {
  getWalletBalance,
  createWalletTransaction,
} from "@/lib/supabase/queries";

/**
 * Wallet Service
 * Handles all wallet-related operations including balance checks,
 * transactions, and automatic deductions
 */

export interface WalletTransaction {
  user_id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  reference_type?: string;
  reference_id?: string;
}

/**
 * Check if user has sufficient balance for a transaction
 */
export async function hasSufficientBalance(
  userId: string,
  requiredAmount: number
): Promise<boolean> {
  try {
    const balance = await getWalletBalance(userId);
    return balance >= requiredAmount;
  } catch (error) {
    console.error("Error checking wallet balance:", error);
    return false;
  }
}

/**
 * Deduct amount from patient wallet for appointment booking
 */
export async function deductAppointmentFee(
  patientId: string,
  appointmentId: string,
  consultationFee: number,
  doctorName: string
): Promise<{ success: boolean; transaction?: any; error?: string }> {
  try {
    // Check balance
    const hasBalance = await hasSufficientBalance(patientId, consultationFee);
    if (!hasBalance) {
      return {
        success: false,
        error: "Insufficient wallet balance",
      };
    }

    // Create debit transaction
    const transaction = await createWalletTransaction({
      user_id: patientId,
      amount: consultationFee,
      type: "debit",
      description: `Appointment booking with ${doctorName}`,
      reference_type: "appointment",
      reference_id: appointmentId,
    });

    return {
      success: true,
      transaction,
    };
  } catch (error: any) {
    console.error("Error deducting appointment fee:", error);
    return {
      success: false,
      error: error.message || "Failed to deduct appointment fee",
    };
  }
}

/**
 * Refund appointment fee to patient wallet
 */
export async function refundAppointmentFee(
  patientId: string,
  appointmentId: string,
  consultationFee: number,
  reason: string
): Promise<{ success: boolean; transaction?: any; error?: string }> {
  try {
    // Create credit transaction
    const transaction = await createWalletTransaction({
      user_id: patientId,
      amount: consultationFee,
      type: "credit",
      description: `Refund: ${reason}`,
      reference_type: "appointment_refund",
      reference_id: appointmentId,
    });

    return {
      success: true,
      transaction,
    };
  } catch (error: any) {
    console.error("Error refunding appointment fee:", error);
    return {
      success: false,
      error: error.message || "Failed to refund appointment fee",
    };
  }
}

/**
 * Add funds to wallet (top-up)
 */
export async function topUpWallet(
  userId: string,
  amount: number,
  paymentMethod: string,
  transactionId?: string
): Promise<{ success: boolean; transaction?: any; error?: string }> {
  try {
    // In production, verify payment gateway transaction here
    // For now, we'll assume payment is successful

    const transaction = await createWalletTransaction({
      user_id: userId,
      amount,
      type: "credit",
      description: `Wallet top-up via ${paymentMethod}`,
      reference_type: "top_up",
      reference_id: transactionId,
    });

    return {
      success: true,
      transaction,
    };
  } catch (error: any) {
    console.error("Error topping up wallet:", error);
    return {
      success: false,
      error: error.message || "Failed to top up wallet",
    };
  }
}

/**
 * Transfer agent commission to agent wallet
 */
export async function creditAgentCommission(
  agentId: string,
  commissionAmount: number,
  appointmentId: string
): Promise<{ success: boolean; transaction?: any; error?: string }> {
  try {
    // Get agent's user_id
    const supabase = await createServerClient();
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("user_id")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return {
        success: false,
        error: "Agent not found",
      };
    }

    // Create credit transaction
    const transaction = await createWalletTransaction({
      user_id: agent.user_id,
      amount: commissionAmount,
      type: "credit",
      description: `Commission earned from appointment`,
      reference_type: "commission",
      reference_id: appointmentId,
    });

    // Update agent's total earnings
    await supabase
      .from("agents")
      .update({
        wallet_earnings: supabase.raw(`wallet_earnings + ${commissionAmount}`),
      })
      .eq("id", agentId);

    return {
      success: true,
      transaction,
    };
  } catch (error: any) {
    console.error("Error crediting agent commission:", error);
    return {
      success: false,
      error: error.message || "Failed to credit agent commission",
    };
  }
}

/**
 * Get wallet summary for user
 */
export async function getWalletSummary(userId: string) {
  try {
    const supabase = await createServerClient();

    // Get current balance
    const balance = await getWalletBalance(userId);

    // Get transaction statistics
    const { data: transactions } = await supabase
      .from("wallet_transactions")
      .select("amount, type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const totalCredits =
      transactions
        ?.filter((t) => t.type === "credit")
        .reduce((sum, t) => sum + t.amount, 0) || 0;

    const totalDebits =
      transactions
        ?.filter((t) => t.type === "debit")
        .reduce((sum, t) => sum + t.amount, 0) || 0;

    // Get this month's transactions
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
      .toISOString()
      .split("T")[0];

    const monthTransactions =
      transactions?.filter((t) => t.created_at >= startOfMonth) || [];

    const monthlySpending =
      monthTransactions
        .filter((t) => t.type === "debit")
        .reduce((sum, t) => sum + t.amount, 0) || 0;

    return {
      balance,
      totalCredits,
      totalDebits,
      monthlySpending,
      transactionCount: transactions?.length || 0,
      lastTransaction: transactions?.[0] || null,
    };
  } catch (error: any) {
    console.error("Error getting wallet summary:", error);
    throw error;
  }
}

/**
 * Send low balance notification
 */
export async function checkAndNotifyLowBalance(
  userId: string,
  threshold: number = 100
) {
  try {
    const balance = await getWalletBalance(userId);

    if (balance < threshold) {
      const supabase = await createServerClient();
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Low Wallet Balance",
        message: `Your wallet balance is low (₹${balance}). Please top up to continue booking appointments.`,
        type: "wallet",
      });
    }
  } catch (error) {
    console.error("Error checking low balance:", error);
  }
}
