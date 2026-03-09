"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Loader,
  Calendar,
  Receipt,
  BadgeDollarSign,
  Users,
  Search,
  AlertCircle,
  FileSpreadsheet,
  Table as TableIcon,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* ───── Constants ───── */
const REPORT_TYPES = [
  { key: "appointments", label: "Appointments", icon: Calendar },
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "invoices", label: "Invoices", icon: BadgeDollarSign },
  { key: "users", label: "Users", icon: Users },
] as const;
type ReportType = (typeof REPORT_TYPES)[number]["key"];

const STATUS_OPTIONS: Record<ReportType, string[]> = {
  appointments: ["booked", "confirmed", "checked-in", "completed", "cancelled", "no-show"],
  transactions: ["Completed", "Pending", "Failed", "Refunded"],
  invoices: [],
  users: ["active", "inactive", "blocked"],
};

const SOURCE_ROLE_OPTIONS: Record<ReportType, string[]> = {
  appointments: ["Admin", "Agent", "Attendant", "Doctor", "Patient"],
  transactions: ["Admin", "Agent", "Attendant", "Patient"],
  invoices: [],
  users: [],
};

const APPOINTMENT_COLUMNS = [
  "appointment_id", "patient_name", "patient_email", "patient_phone",
  "doctor_name", "clinic_name", "appointment_date", "slot", "status",
  "source_role", "booking_amount", "commission_amount", "payable_amount",
  "token_number", "notes", "created_at",
];
const TRANSACTION_COLUMNS = [
  "txn_id", "booking_id", "source_role", "user_name", "user_email",
  "reason", "amount", "balance", "status", "started_on",
];
const INVOICE_COLUMNS = [
  "invoice_number", "txn_id", "booking_id", "user_name", "user_email",
  "invoice_date", "taxable_amount", "gst", "gst_percentage",
  "total_amount", "status", "created_at",
];
const USER_COLUMNS = [
  "id", "name", "email", "phone", "role", "status", "created_at",
];

function getColumns(type: ReportType): string[] {
  switch (type) {
    case "appointments": return APPOINTMENT_COLUMNS;
    case "transactions": return TRANSACTION_COLUMNS;
    case "invoices": return INVOICE_COLUMNS;
    case "users": return USER_COLUMNS;
  }
}

const ROWS_PER_PAGE = 25;

/* ───── CSV Export ───── */
function arrayToCSV(data: Record<string, any>[], columns: string[]): string {
  const header = columns.join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = row[col] ?? "";
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(",")
  );
  return [header, ...rows].join("\n");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ───── Excel (XLSX) using simple XML Spreadsheet ───── */
function arrayToExcelXML(data: Record<string, any>[], columns: string[]): string {
  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Header">
    <Font ss:Bold="1" ss:Size="11"/>
    <Interior ss:Color="#4F46E5" ss:Pattern="Solid"/>
    <Font ss:Color="#FFFFFF" ss:Bold="1"/>
  </Style>
  <Style ss:ID="DateStyle">
    <NumberFormat ss:Format="yyyy-mm-dd"/>
  </Style>
</Styles>
<Worksheet ss:Name="Report">
<Table>
`;

  // Header row
  xml += "<Row>\n";
  for (const col of columns) {
    xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.replace(/_/g, " ").toUpperCase())}</Data></Cell>\n`;
  }
  xml += "</Row>\n";

  // Data rows
  for (const row of data) {
    xml += "<Row>\n";
    for (const col of columns) {
      const val = row[col] ?? "";
      const str = escapeXml(String(val));
      const isNum = typeof val === "number" || (!isNaN(Number(val)) && val !== "" && val !== null);
      xml += `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${str}</Data></Cell>\n`;
    }
    xml += "</Row>\n";
  }

  xml += `</Table>
</Worksheet>
</Workbook>`;
  return xml;
}

/* ───── Format helpers ───── */
function formatColumnHeader(col: string): string {
  return col
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCellValue(col: string, val: any): string {
  if (val === null || val === undefined) return "—";
  if (col.includes("date") || col === "created_at" || col === "started_on") {
    try {
      return new Date(val).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(val);
    }
  }
  if (col.includes("amount") || col === "gst" || col === "balance") {
    const num = parseFloat(val);
    return isNaN(num) ? String(val) : `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  }
  return String(val);
}

function statusBadge(val: string) {
  const lower = (val || "").toLowerCase();
  const colors: Record<string, string> = {
    booked: "bg-blue-100 text-blue-700",
    confirmed: "bg-green-100 text-green-700",
    completed: "bg-emerald-100 text-emerald-700",
    "checked-in": "bg-purple-100 text-purple-700",
    cancelled: "bg-red-100 text-red-700",
    "no-show": "bg-orange-100 text-orange-700",
    active: "bg-green-100 text-green-700",
    inactive: "bg-gray-100 text-gray-600",
    blocked: "bg-red-100 text-red-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
    refunded: "bg-violet-100 text-violet-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[lower] || "bg-gray-100 text-gray-700"}`}>
      {val}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════
   Reports Page
   ════════════════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>("appointments");
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [hasFetched, setHasFetched] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceRoleFilter, setSourceRoleFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  const fetchReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    setError("");
    setPage(1);
    try {
      const params = new URLSearchParams({ type });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "5000");

      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to fetch report");
      setData(json.report || []);
      setTotal(json.total || 0);
      setHasFetched(true);
    } catch (err: any) {
      setError(err.message || "Error fetching report");
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as ReportType);
    setData([]);
    setTotal(0);
    setHasFetched(false);
    setError("");
    setSearchTerm("");
    setSourceRoleFilter("");
    setPage(1);
  };

  const columns = getColumns(activeTab);

  // Client-side filters: source role + search
  let filtered = data;
  if (sourceRoleFilter) {
    filtered = filtered.filter((row) => {
      const role = String(row.source_role || "").toLowerCase();
      return role === sourceRoleFilter.toLowerCase();
    });
  }
  if (searchTerm) {
    filtered = filtered.filter((row) =>
      columns.some((col) =>
        String(row[col] || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
    );
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginatedData = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const handleDownloadCSV = () => {
    if (filtered.length === 0) return;
    const csv = arrayToCSV(filtered, columns);
    downloadBlob(csv, `${activeTab}_report_${new Date().toISOString().split("T")[0]}.csv`, "text/csv;charset=utf-8;");
  };

  const handleDownloadExcel = () => {
    if (filtered.length === 0) return;
    const xml = arrayToExcelXML(filtered, columns);
    downloadBlob(xml, `${activeTab}_report_${new Date().toISOString().split("T")[0]}.xls`, "application/vnd.ms-excel");
  };

  const statuses = STATUS_OPTIONS[activeTab];
  const sourceRoles = SOURCE_ROLE_OPTIONS[activeTab];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate, preview, and download reports in CSV or Excel format.
          </p>
        </div>
      </div>

      {/* Report Type Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 h-12">
          {REPORT_TYPES.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2 text-sm">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* All tabs share the same content structure */}
        {REPORT_TYPES.map(({ key }) => (
          <TabsContent key={key} value={key}>
            <Card className="p-6 space-y-6">
              {/* Filters */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <Filter className="h-4 w-4" /> Filters
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Date From</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Date To</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  {statuses.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <Select
                        value={statusFilter || "__all__"}
                        onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Statuses</SelectItem>
                          {statuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {sourceRoles.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Source Role</label>
                      <Select
                        value={sourceRoleFilter || "__all__"}
                        onValueChange={(v) => { setSourceRoleFilter(v === "__all__" ? "" : v); setPage(1); }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Roles</SelectItem>
                          {sourceRoles.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={() => fetchReport(activeTab)}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? (
                        <Loader className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Generate Report
                    </Button>
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Results */}
              {hasFetched && !loading && (
                <>
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        <TableIcon className="h-4 w-4 inline mr-1" />
                        {filtered.length} record{filtered.length !== 1 ? "s" : ""}{" "}
                        {searchTerm && `(filtered from ${data.length})`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9 w-56"
                          placeholder="Search in results…"
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                          }}
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadCSV}
                        disabled={filtered.length === 0}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadExcel}
                        disabled={filtered.length === 0}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-1" />
                        Excel
                      </Button>
                    </div>
                  </div>

                  {/* Data Table */}
                  {filtered.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-lg font-medium">No records found</p>
                      <p className="text-sm">Try adjusting your filters or date range.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
                              #
                            </th>
                            {columns.map((col) => (
                              <th
                                key={col}
                                className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b whitespace-nowrap"
                              >
                                {formatColumnHeader(col)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {paginatedData.map((row, idx) => (
                            <tr
                              key={row.id || idx}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                            >
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                {(page - 1) * ROWS_PER_PAGE + idx + 1}
                              </td>
                              {columns.map((col) => (
                                <td
                                  key={col}
                                  className="px-3 py-2.5 whitespace-nowrap text-sm"
                                >
                                  {col === "status"
                                    ? statusBadge(row[col])
                                    : formatCellValue(col, row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-muted-foreground">
                        Page {page} of {totalPages} · Showing{" "}
                        {(page - 1) * ROWS_PER_PAGE + 1}–
                        {Math.min(page * ROWS_PER_PAGE, filtered.length)} of{" "}
                        {filtered.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {/* Show up to 5 page buttons */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            pageNum = i + 1;
                          } else if (page >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = page - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={page === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setPage(pageNum)}
                              className="w-9"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Loading indicator */}
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <Loader className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Generating report…</p>
                  </div>
                </div>
              )}

              {/* Initial state */}
              {!hasFetched && !loading && (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium mb-1">Select filters and generate</p>
                  <p className="text-sm">
                    Choose a date range and click &quot;Generate Report&quot; to preview data.
                    You can then download as CSV or Excel.
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
