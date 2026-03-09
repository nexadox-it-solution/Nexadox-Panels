"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Download,
  Plus,
  Search,
  Loader,
  IndianRupee,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Script from "next/script";

const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;

/* ─── Razorpay type declaration ──────────────────────────── */
declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function WalletPage() {
  const { toast } = useToast();
  const [topUpAmount, setTopUpAmount] = useState("");
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [agentEmail, setAgentEmail] = useState("");
  const [agentName, setAgentName] = useState("");

  /* Refs to avoid stale closures in Razorpay callback */
  const agentIdRef = useRef<number | null>(null);
  const agentUserIdRef = useRef<string | null>(null);

  const [walletData, setWalletData] = useState({
    balance: 0,
    totalTopUps: 0,
    totalDeductions: 0,
    lowBalanceThreshold: 5000,
  });

  const [transactions, setTransactions] = useState<any[]>([]);

  /* ── Fetch wallet data ────────────────────────────────────── */
  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      /* Fetch wallet data via server API (uses cookies for auth, bypasses RLS) */
      const res = await fetch(`/api/agent/wallet`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("[Wallet] API error:", res.status, errData);
        return;
      }

      const data = await res.json();
      const { profile, agent, transactions: txnList } = data;

      setAgentUserId(profile.id);
      agentUserIdRef.current = profile.id;
      setAgentName(profile.name || "");
      setAgentEmail(profile.email || "");

      setAgentId(agent.id);
      agentIdRef.current = agent.id;

      const balance = agent.wallet_balance;

      const totalCredits = txnList.filter((t: any) =>
        t.reason?.toLowerCase().includes("top") ||
        t.reason?.toLowerCase().includes("credit") ||
        (Number(t.amount) > 0 && t.reason?.toLowerCase().includes("add"))
      ).reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);

      const totalDebits = txnList.filter((t: any) =>
        t.reason?.toLowerCase().includes("booking") ||
        t.reason?.toLowerCase().includes("debit")
      ).reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);

      setWalletData({
        balance,
        totalTopUps: totalCredits,
        totalDeductions: totalDebits,
        lowBalanceThreshold: 5000,
      });
      setTransactions(txnList);
    } catch (e) {
      console.error("[Wallet] fetchWallet error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  /* ── Razorpay Top-Up Handler ──────────────────────────────── */
  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topUpAmount);
    if (!amount || amount < 10) {
      toast({ title: "Invalid Amount", description: "Minimum top-up is ₹10", variant: "destructive" });
      return;
    }

    /* Capture current ref values before async operations */
    const currentAgentId = agentIdRef.current || agentId;
    const currentAgentUserId = agentUserIdRef.current || agentUserId;

    if (!currentAgentId) {
      toast({ title: "Error", description: "Agent data not loaded. Please refresh the page.", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      /* Create Razorpay order via API */
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, agent_user_id: currentAgentUserId }),
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      if (!window.Razorpay) {
        throw new Error("Payment gateway is loading. Please try again in a moment.");
      }

      /* Open Razorpay Checkout */
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "Nexadox",
        description: "Agent Wallet Top Up",
        order_id: orderData.order_id,
        prefill: {
          name: agentName,
          email: agentEmail,
        },
        theme: { color: "#3b82f6" },
        handler: async (response: any) => {
          /* Verify payment on server */
          try {
            const payload = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount,
              agent_user_id: currentAgentUserId,
              agent_id: currentAgentId,
            };
            console.log("[Razorpay] Verifying payment:", payload);

            const verifyRes = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const verifyData = await verifyRes.json();
            console.log("[Razorpay] Verify response:", verifyRes.status, verifyData);

            if (verifyRes.ok && verifyData.success) {
              toast({ title: "Top Up Successful!", description: `${inr(amount)} has been added to your wallet.` });
              setTopUpAmount("");
              setShowTopUpModal(false);
              fetchWallet(); // Refresh data
            } else {
              throw new Error(verifyData.error || "Verification failed");
            }
          } catch (err: any) {
            console.error("[Razorpay] Verify error:", err);
            toast({ title: "Verification Failed", description: err?.message || "Payment verification failed. Please contact support with your payment ID.", variant: "destructive" });
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast({ title: "Payment Cancelled", description: "Top-up was cancelled", variant: "destructive" });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (res: any) => {
        toast({ title: "Payment Failed", description: res.error?.description || "Payment failed", variant: "destructive" });
        setProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Something went wrong", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const filteredTransactions = transactions.filter((txn) =>
    (txn.reason || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (txn.booking_id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLowBalance = walletData.balance < walletData.lowBalanceThreshold;

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Razorpay Checkout Script */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Wallet Management</h1>
          <p className="text-muted-foreground mt-1">Manage your wallet balance and transaction history</p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => setShowTopUpModal(true)}>
          <Plus className="h-5 w-5" /> Top Up Wallet
        </Button>
      </div>

      {/* Low Balance Alert */}
      {isLowBalance && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Wallet className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-900">Low Wallet Balance</h3>
                <p className="text-sm text-orange-800 mt-1">
                  Your wallet balance is below {inr(walletData.lowBalanceThreshold)}.
                  Please top up to continue booking appointments.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowTopUpModal(true)}>Top Up Now</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet Balance Card */}
      <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white border-0">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="h-6 w-6" />
            <span className="text-lg font-medium opacity-90">Current Balance</span>
          </div>
          <div className="text-5xl font-bold mb-6">{inr(walletData.balance)}</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="h-4 w-4" />
                <span className="text-sm opacity-90">Total Top Ups</span>
              </div>
              <div className="text-xl font-semibold">{inr(walletData.totalTopUps)}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownRight className="h-4 w-4" />
                <span className="text-sm opacity-90">Total Spent</span>
              </div>
              <div className="text-xl font-semibold">{inr(walletData.totalDeductions)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Up Modal */}
      {showTopUpModal && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><IndianRupee className="h-5 w-5" /> Top Up Wallet</CardTitle>
            <CardDescription>Add funds to your wallet via Razorpay</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTopUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (INR)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="10"
                  step="10"
                  placeholder="Enter amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  required
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[500, 1000, 2000, 5000].map((amount) => (
                  <Button key={amount} type="button" variant="outline" size="sm"
                    onClick={() => setTopUpAmount(amount.toString())}>
                    ₹{amount.toLocaleString("en-IN")}
                  </Button>
                ))}
              </div>

              {/* Payment Method Info */}
              <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <IndianRupee className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Razorpay Secure Payment</p>
                  <p className="text-xs text-blue-700">UPI, Cards, Net Banking, Wallets</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 gap-2" disabled={processing}>
                  {processing ? <><Loader className="h-4 w-4 animate-spin" /> Processing…</> : <>Pay ₹{topUpAmount || "0"}</>}
                </Button>
                <Button type="button" variant="outline"
                  onClick={() => { setShowTopUpModal(false); setTopUpAmount(""); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>All your wallet transactions in one place</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search transactions..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date & Time</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn) => {
                  const isCredit = (txn.reason || "").toLowerCase().includes("top") || (txn.reason || "").toLowerCase().includes("credit") || (txn.reason || "").toLowerCase().includes("add");
                  return (
                    <tr key={txn.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="py-3 px-4 text-sm">
                        {txn.created_at ? new Date(txn.created_at).toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="py-3 px-4 text-sm">{txn.reason || "—"}</td>
                      <td className="py-3 px-4">
                        {isCredit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <ArrowUpRight className="h-3 w-3" /> Credit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <ArrowDownRight className="h-3 w-3" /> Debit
                          </span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${isCredit ? "text-green-600" : "text-red-600"}`}>
                        {isCredit ? "+" : "-"}{inr(Math.abs(Number(txn.amount) || 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {txn.balance != null ? inr(Number(txn.balance)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold mt-1">{transactions.length}</p>
              </div>
              <Wallet className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Transaction</p>
                <p className="text-2xl font-bold mt-1">
                  {transactions.length > 0
                    ? inr(Math.round(transactions.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0) / transactions.length))
                    : "₹0"}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-bold mt-1">{inr(walletData.balance)}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
