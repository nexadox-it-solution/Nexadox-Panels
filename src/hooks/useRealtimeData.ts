"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Custom hook for real-time queue updates
 */
export function useQueueRealtime(doctorId?: string) {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (doctorId) params.append("doctorId", doctorId);
      params.append("date", new Date().toISOString().split("T")[0]);

      const response = await fetch(`/api/queue?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch queue");

      const data = await response.json();
      setQueue(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchQueue();

    // Set up real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel("queue_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: doctorId ? `doctor_id=eq.${doctorId}` : undefined,
        },
        (payload) => {
          console.log("Queue update:", payload);
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, fetchQueue]);

  return { queue, loading, error, refetch: fetchQueue };
}

/**
 * Custom hook for real-time notifications
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    // Fetch initial notifications
    const fetchNotifications = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Set up real-time subscription
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const channel = supabase
        .channel("notification_updates")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("New notification:", payload);
            setNotifications((prev) => [payload.new as any, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });
  }, []);

  const markAsRead = async (notificationId: string) => {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}

/**
 * Custom hook for wallet balance with real-time updates
 */
export function useWalletBalance() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await fetch("/api/wallet?action=balance");
        if (response.ok) {
          const data = await response.json();
          setBalance(data.balance);
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();

    // Set up real-time subscription for wallet transactions
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const channel = supabase
        .channel("wallet_updates")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "wallet_transactions",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchBalance();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });
  }, []);

  return { balance, loading };
}

/**
 * Custom hook for fetching and managing appointments
 */
export function useAppointments(filters?: {
  doctorId?: string;
  patientId?: string;
  agentId?: string;
  status?: string;
  date?: string;
}) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
      }

      const response = await fetch(`/api/appointments?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch appointments");

      const data = await response.json();
      setAppointments(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAppointments();

    // Set up real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel("appointment_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAppointments]);

  return { appointments, loading, error, refetch: fetchAppointments };
}
