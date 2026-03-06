"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight, Globe, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { STATUS_COLORS, PRIORITY_COLORS, LANG_FLAGS, formatCategory } from "@/lib/constants";

interface Ticket {
  id: string;
  externalId: string | null;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  language: string | null;
  source: string | null;
  aiSummary: string | null;
  createdAt: string;
  assignee: { id: string; name: string } | null;
  _count: { messages: number };
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_ON_CUSTOMER", label: "Waiting" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "AUTO_CLOSED", label: "Auto-Closed" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "SUBSCRIPTION_CANCELLATION", label: "Subscription Cancel" },
  { value: "REFUND_REQUEST", label: "Refund Request" },
  { value: "FLASHCARD_ISSUES", label: "Flashcard Issues" },
  { value: "ACCOUNT_ISSUES", label: "Account Issues" },
  { value: "TECHNICAL_ERRORS", label: "Technical Errors" },
  { value: "CONTENT_UPLOAD", label: "Content Upload" },
  { value: "LANGUAGE_ISSUES", label: "Language Issues" },
  { value: "DATA_LOSS", label: "Data Loss" },
  { value: "BILLING_INVOICE", label: "Billing" },
  { value: "MISUNDERSTANDING", label: "Misunderstanding" },
  { value: "GARBAGE", label: "Garbage" },
  { value: "OTHER", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export default function TicketsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <TicketsContent />
    </Suspense>
  );
}

function TicketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkCategorizing, setBulkCategorizing] = useState(false);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [category, setCategory] = useState(
    searchParams.get("category") || "all"
  );
  const [priority, setPriority] = useState(
    searchParams.get("priority") || "all"
  );
  const [page, setPage] = useState(
    parseInt(searchParams.get("page") || "1")
  );
  const limit = 20;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      if (category !== "all") params.set("category", category);
      if (priority !== "all") params.set("priority", priority);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const res = await fetch(`/api/tickets?${params}`);
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      setTickets(data.tickets);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    }
    setLoading(false);
  }, [search, status, category, priority, page]);

  const handleBulkCategorize = async () => {
    setBulkCategorizing(true);
    try {
      const res = await fetch("/api/ai/categorize-batch", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Categorized ${data.categorized} tickets`);
        fetchTickets();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to categorize");
      }
    } catch {
      toast.error("Failed to categorize tickets");
    }
    setBulkCategorizing(false);
  };

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkCategorize}
            disabled={bulkCategorizing}
          >
            {bulkCategorizing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Categorize All
          </Button>
          <span className="text-sm text-muted-foreground">{total} tickets</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priority}
          onValueChange={(v) => {
            setPriority(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[50px]">Lang</TableHead>
              <TableHead className="w-[120px]">Assignee</TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="animate-pulse text-muted-foreground">
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{ticket.externalId}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate max-w-[300px]">
                        {ticket.aiSummary || ticket.subject}
                      </span>
                      {ticket.aiSummary && (
                        <Sparkles className="h-3 w-3 text-purple-500 flex-shrink-0" />
                      )}
                      {ticket._count.messages > 1 && (
                        <span className="text-xs text-muted-foreground">
                          ({ticket._count.messages})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {ticket.category && (
                      <Badge variant="outline" className="text-xs">
                        {formatCategory(ticket.category)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-xs ${PRIORITY_COLORS[ticket.priority] || ""}`}
                      variant="secondary"
                    >
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-xs ${STATUS_COLORS[ticket.status] || ""}`}
                      variant="secondary"
                    >
                      {ticket.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ticket.language ? (
                      <span title={ticket.language}>
                        {LANG_FLAGS[ticket.language] || ticket.language}
                      </span>
                    ) : (
                      <Globe className="h-3 w-3 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {ticket.assignee?.name || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
