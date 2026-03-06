"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Ticket,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { STATUS_COLORS, LANG_LABELS, formatCategory } from "@/lib/constants";

interface DashboardData {
  stats: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    autoClosed: number;
  };
  categoryDistribution: Array<{
    category: string | null;
    _count: { category: number };
  }>;
  languageDistribution: Array<{
    language: string | null;
    _count: { language: number };
  }>;
  recentTickets: Array<{
    id: string;
    externalId: string | null;
    subject: string;
    status: string;
    category: string | null;
    createdAt: string;
    assignee: { name: string } | null;
  }>;
  assigneeWorkload: Array<{
    assigneeId: string;
    _count: { assigneeId: number };
    assignee: { name: string } | null;
  }>;
}

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = () => {
    setError(null);
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load dashboard");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  };

  const handleBarClick = useCallback((data: { key?: string }) => {
    if (data?.key) router.push(`/tickets?category=${data.key}`);
  }, [router]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchDashboard}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Loading dashboard...
        </div>
      </div>
    );
  }

  const categoryData = data.categoryDistribution
    .filter((c) => c.category)
    .map((c) => ({
      name: formatCategory(c.category),
      key: c.category!,
      count: c._count.category,
    }));

  const languageData = data.languageDistribution
    .filter((l) => l.language)
    .map((l) => ({
      name: LANG_LABELS[l.language!] || l.language!,
      value: l._count.language,
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Link href="/tickets">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Total Tickets</p>
              </div>
              <p className="text-3xl font-bold mt-2">{data.stats.total}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/tickets?status=OPEN">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <p className="text-sm text-muted-foreground">Open</p>
              </div>
              <p className="text-3xl font-bold mt-2 text-blue-600">
                {data.stats.open}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/tickets?status=IN_PROGRESS">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
              <p className="text-3xl font-bold mt-2 text-yellow-600">
                {data.stats.inProgress}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/tickets?status=RESOLVED">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
              <p className="text-3xl font-bold mt-2 text-green-600">
                {data.stats.resolved}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/tickets?status=AUTO_CLOSED">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-gray-500" />
                <p className="text-sm text-muted-foreground">Auto-Closed</p>
              </div>
              <p className="text-3xl font-bold mt-2 text-gray-600">
                {data.stats.autoClosed}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recentTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground font-mono">
                    #{ticket.externalId}
                  </span>
                  <span className="text-sm font-medium truncate max-w-md">
                    {ticket.subject}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {ticket.category && (
                    <Badge variant="outline" className="text-xs">
                      {formatCategory(ticket.category)}
                    </Badge>
                  )}
                  <Badge
                    className={`text-xs ${STATUS_COLORS[ticket.status] || ""}`}
                    variant="secondary"
                  >
                    {ticket.status.replace(/_/g, " ")}
                  </Badge>
                  {ticket.assignee && (
                    <span className="text-xs text-muted-foreground">
                      {ticket.assignee.name}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tickets by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(300, categoryData.length * 32)}>
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={160}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(_: unknown, index: number) => handleBarClick(categoryData[index])}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Language Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tickets by Language</CardTitle>
          </CardHeader>
          <CardContent>
            {languageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={languageData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    dataKey="value"
                  >
                    {languageData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Run AI categorization to detect languages
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
