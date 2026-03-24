"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader,
  Wallet,
  Search,
  Plus,
  IndianRupee,
  Users,
  Check,
  X,
} from "lucide-react";

interface Agent {
  agent_id: number | null;   // agents table INT PK
  user_id: string;            // profile UUID
  has_agent_row: boolean;
  wallet_balance: number;
  wallet_earnings: number;
  business_name: string | null;
  approval_status: string;
  name: string;
  email: string;
  phone: string;
}

const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;

export default function AdminWalletPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add money form
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/wallet");
      const json = await res.json();
      setAgents(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMoney = async () => {
    if (!selectedAgentId || !amount || Number(amount) <= 0) {
      setMessage({ type: "error", text: "Select an agent and enter a valid amount" });
      return;
    }

    const agent = agents.find((a) => a.user_id === selectedAgentId);
    if (!agent) return;

    if (!agent.has_agent_row || !agent.agent_id) {
      setMessage({ type: "error", text: `${agent.name} does not have a wallet record yet. They need to log in first or be set up in the Agents page.` });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agent.agent_id,
          user_id: agent.user_id,
          amount: Number(amount),
          reason: reason.trim() || "Admin Wallet Top-up",
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setMessage({ type: "error", text: json.error || "Failed to add money" });
        return;
      }

      setMessage({
        type: "success",
        text: `Successfully added ${inr(Number(amount))} to ${agent.name}'s wallet. Txn: ${json.txn_id}`,
      });
      setAmount("");
      setReason("");
      setSelectedAgentId("");
      loadAgents(); // Refresh balances
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = agents.filter((a) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (a.name || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.phone || "").toLowerCase().includes(q) ||
      (a.business_name || "").toLowerCase().includes(q)
    );
  });

  const totalBalance = agents.reduce((s, a) => s + (Number(a.wallet_balance) || 0), 0);
  const totalEarnings = agents.reduce((s, a) => s + (Number(a.wallet_earnings) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Wallet Management</h1>
          <p className="text-sm text-muted-foreground">
            Add money to agent wallets
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Total Agents",
            value: agents.length,
            icon: Users,
            bg: "bg-blue-100",
            fg: "text-blue-600",
          },
          {
            label: "Total Wallet Balance",
            value: inr(totalBalance),
            icon: Wallet,
            bg: "bg-emerald-100",
            fg: "text-emerald-600",
          },
          {
            label: "Total Earnings",
            value: inr(totalEarnings),
            icon: IndianRupee,
            bg: "bg-purple-100",
            fg: "text-purple-600",
          },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-lg ${c.bg} flex items-center justify-center`}
              >
                <c.icon className={`h-4 w-4 ${c.fg}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-lg font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Money Form */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-emerald-600" /> Add Money to Agent Wallet
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Select Agent
            </label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Choose agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.filter(a => a.has_agent_row).map((a) => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.name} — {a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Amount (₹)
            </label>
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Reason (optional)
            </label>
            <Input
              placeholder="e.g. Bonus, Refund"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleAddMoney}
              disabled={submitting || !selectedAgentId || !amount}
              className="h-9 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <Loader className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Money
            </Button>
          </div>
        </div>

        {/* Feedback */}
        {message && (
          <div
            className={`mt-4 p-3 rounded-lg flex items-start gap-2 text-sm ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.type === "success" ? (
              <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
            ) : (
              <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
            )}
            {message.text}
          </div>
        )}
      </Card>

      {/* Agent List */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Agent Wallets</h2>
        <div className="relative ml-auto max-w-xs w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <Card className="p-12 flex flex-col items-center">
          <Loader className="h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b">
                  {["Agent", "Email", "Phone", "Business", "Status", "Wallet Balance", "Earnings"].map(
                    (h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider ${
                          h === "Wallet Balance" || h === "Earnings"
                            ? "text-right"
                            : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>No agents found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr
                      key={a.user_id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{a.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.email}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.phone}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.business_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            a.approval_status?.toLowerCase() === "approved"
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : a.approval_status?.toLowerCase() === "rejected"
                              ? "text-red-700 bg-red-50 border-red-200"
                              : "text-amber-700 bg-amber-50 border-amber-200"
                          }`}
                        >
                          {a.approval_status ? a.approval_status.charAt(0).toUpperCase() + a.approval_status.slice(1) : "Pending"}
                        </span>
                        {!a.has_agent_row && (
                          <span className="ml-1 text-xs text-muted-foreground">(no wallet)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                        {inr(Number(a.wallet_balance) || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-purple-600">
                        {inr(Number(a.wallet_earnings) || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
