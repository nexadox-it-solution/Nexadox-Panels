"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Hash,
  Search,
  Printer,
  XCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Ban,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TokenManagementPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // TODO: Fetch tokens from Supabase
  const allTokens = [
    {
      id: "1",
      token_number: "14",
      patient_name: "Jane Smith",
      patient_mobile: "+1 234-567-8902",
      doctor: "Dr. Sarah Johnson",
      check_in_time: "09:45 AM",
      status: "in_progress",
      wait_time: 0,
    },
    {
      id: "2",
      token_number: "15",
      patient_name: "John Doe",
      patient_mobile: "+1 234-567-8901",
      doctor: "Dr. Sarah Johnson",
      check_in_time: "09:30 AM",
      status: "waiting",
      wait_time: 15,
    },
    {
      id: "3",
      token_number: "13",
      patient_name: "Alice Johnson",
      patient_mobile: "+1 234-567-8903",
      doctor: "Dr. Sarah Johnson",
      check_in_time: "09:15 AM",
      status: "completed",
      wait_time: 0,
    },
    {
      id: "4",
      token_number: "12",
      patient_name: "Bob Williams",
      patient_mobile: "+1 234-567-8904",
      doctor: "Dr. Sarah Johnson",
      check_in_time: "09:00 AM",
      status: "cancelled",
      wait_time: 0,
    },
    {
      id: "5",
      token_number: "11",
      patient_name: "Carol Martinez",
      patient_mobile: "+1 234-567-8905",
      doctor: "Dr. Sarah Johnson",
      check_in_time: "08:45 AM",
      status: "no_show",
      wait_time: 0,
    },
  ];

  const filteredTokens = allTokens.filter((token) => {
    const matchesSearch =
      token.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.token_number.includes(searchQuery) ||
      token.patient_mobile.includes(searchQuery);

    const matchesStatus = statusFilter === "all" || token.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      waiting: {
        color: "bg-yellow-100 text-yellow-700 border-yellow-300",
        icon: Clock,
        label: "Waiting",
      },
      in_progress: {
        color: "bg-blue-100 text-blue-700 border-blue-300",
        icon: AlertCircle,
        label: "In Progress",
      },
      completed: {
        color: "bg-green-100 text-green-700 border-green-300",
        icon: CheckCircle,
        label: "Completed",
      },
      cancelled: {
        color: "bg-red-100 text-red-700 border-red-300",
        icon: XCircle,
        label: "Cancelled",
      },
      no_show: {
        color: "bg-gray-100 text-gray-700 border-gray-300",
        icon: Ban,
        label: "No Show",
      },
    };

    const badge = badges[status as keyof typeof badges];
    const Icon = badge.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${badge.color}`}
      >
        <Icon className="h-3 w-3" />
        {badge.label}
      </span>
    );
  };

  const handleCancelToken = async () => {
    if (!selectedToken || !cancelReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a cancellation reason",
        variant: "destructive",
      });
      return;
    }

    // TODO: Update token status in Supabase
    toast({
      title: "Token Cancelled",
      description: `Token #${selectedToken.token_number} has been cancelled`,
    });

    setShowCancelModal(false);
    setSelectedToken(null);
    setCancelReason("");
  };

  const handlePrintToken = (token: any) => {
    // TODO: Implement token printing
    toast({
      title: "Print Request",
      description: `Printing token #${token.token_number}`,
    });
  };

  const todayStats = {
    total: allTokens.length,
    waiting: allTokens.filter((t) => t.status === "waiting").length,
    in_progress: allTokens.filter((t) => t.status === "in_progress").length,
    completed: allTokens.filter((t) => t.status === "completed").length,
    cancelled: allTokens.filter((t) => t.status === "cancelled").length,
    no_show: allTokens.filter((t) => t.status === "no_show").length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Token Management
        </h1>
        <p className="text-muted-foreground mt-1">
          View, manage, and track all issued tokens
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Tokens</p>
              <p className="text-3xl font-bold mt-1">{todayStats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-yellow-600">Waiting</p>
              <p className="text-3xl font-bold mt-1 text-yellow-600">
                {todayStats.waiting}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-blue-600">In Progress</p>
              <p className="text-3xl font-bold mt-1 text-blue-600">
                {todayStats.in_progress}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-green-600">Completed</p>
              <p className="text-3xl font-bold mt-1 text-green-600">
                {todayStats.completed}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-red-600">Cancelled</p>
              <p className="text-3xl font-bold mt-1 text-red-600">
                {todayStats.cancelled}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">No Show</p>
              <p className="text-3xl font-bold mt-1 text-gray-600">
                {todayStats.no_show}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by token number, patient name, or mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All Status</option>
              <option value="waiting">Waiting</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Modal */}
      {showCancelModal && selectedToken && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCancelModal(false)}
        >
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Cancel Token</CardTitle>
              <CardDescription>
                Are you sure you want to cancel token #{selectedToken.token_number}?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="font-medium">{selectedToken.patient_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedToken.patient_mobile}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Cancellation Reason *
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason for cancellation..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleCancelToken}
                  className="flex-1"
                >
                  Cancel Token
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCancelModal(false);
                    setSelectedToken(null);
                    setCancelReason("");
                  }}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tokens List */}
      <Card>
        <CardHeader>
          <CardTitle>All Tokens ({filteredTokens.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTokens.length === 0 ? (
            <div className="text-center py-12">
              <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No tokens found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Token</th>
                    <th className="text-left py-3 px-4 font-semibold">Patient</th>
                    <th className="text-left py-3 px-4 font-semibold">Doctor</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Check-in Time
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTokens.map((token) => (
                    <tr key={token.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-lg text-primary">
                          #{token.token_number}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{token.patient_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {token.patient_mobile}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">{token.doctor}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {token.check_in_time}
                        </div>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(token.status)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintToken(token)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          {(token.status === "waiting" ||
                            token.status === "in_progress") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedToken(token);
                                setShowCancelModal(true);
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TODO: Add bulk actions for token management */}
      {/* TODO: Add token history with detailed view */}
      {/* TODO: Add export to CSV/PDF functionality */}
    </div>
  );
}
