import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Loader2, Calendar as CalendarIcon, Wallet, Ticket, BusFront, TrendingUp, TrendingDown, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RevenueChart } from "@/components/dashboard/dashboard-components";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function ReportsPage() {
  const { data: agencyId } = useAgencyId();

  // Default: last 30 days
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDate(d);
  });
  const [toDate, setToDate] = useState(() => formatDate(new Date()));

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["reports", agencyId, fromDate, toDate],
    queryFn: async () => {
      if (!agencyId) return null;

      const fromISO = new Date(fromDate).toISOString();
      const toEnd = new Date(toDate);
      toEnd.setHours(23, 59, 59, 999);
      const toISO = toEnd.toISOString();

      const [bookingsRes, expensesRes, tripsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("amount, created_at")
          .eq("agency_id", agencyId)
          .eq("status", "confirmed")
          .gte("created_at", fromISO)
          .lte("created_at", toISO),
        supabase
          .from("expenses")
          .select("amount, date")
          .eq("agency_id", agencyId)
          .gte("date", fromDate)
          .lte("date", toDate),
        supabase
          .from("trips")
          .select("id, departure_at, status")
          .eq("agency_id", agencyId)
          .gte("departure_at", fromISO)
          .lte("departure_at", toISO),
      ]);

      const bookings = bookingsRes.data || [];
      const expenses = expensesRes.data || [];
      const trips = tripsRes.data || [];

      const totalRev = bookings.reduce((sum, b) => sum + Number(b.amount || 0), 0);
      const totalExp = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const completedTrips = trips.filter((t) => t.status === "completed").length;

      // Build daily series
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const dayCount = Math.min(Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1, 31);

      // Only show last 7 days in chart to keep it readable
      const chartDays = Math.min(dayCount, 7);
      const chartStart = new Date(toDate);
      chartStart.setDate(chartStart.getDate() - (chartDays - 1));

      const series = Array.from({ length: chartDays }).map((_, i) => {
        const d = new Date(chartStart);
        d.setDate(d.getDate() + i);
        const dayStr = formatDate(d);
        const dayLabel = d.toLocaleDateString("ar-EG", { weekday: "short" });

        const dayRev = bookings
          .filter((b) => b.created_at.startsWith(dayStr))
          .reduce((s, b) => s + Number(b.amount || 0), 0);

        const dayBookings = bookings.filter((b) => b.created_at.startsWith(dayStr)).length;

        return { day: dayStr, label: dayLabel, revenue: dayRev, bookings: dayBookings };
      });

      // Group expenses by category (for summary)
      const expByCategory = new Map<string, number>();
      for (const e of expenses) {
        const day = e.date;
        expByCategory.set(day, (expByCategory.get(day) ?? 0) + Number(e.amount || 0));
      }

      return {
        totalRevenue: totalRev,
        totalExpenses: totalExp,
        netIncome: totalRev - totalExp,
        totalBookings: bookings.length,
        totalTrips: trips.length,
        completedTrips,
        series,
        dayCount,
      };
    },
    enabled: !!agencyId,
  });

  function handleExportCSV() {
    if (!reportData) return;
    const header = ["اليوم", "الإيرادات", "التذاكر"];
    const csv = [
      header.join(","),
      ...reportData.series.map((s) => [s.day, s.revenue, s.bookings].join(",")),
      "",
      `إجمالي الإيرادات,${reportData.totalRevenue}`,
      `إجمالي المصروفات,${reportData.totalExpenses}`,
      `صافي الدخل,${reportData.netIncome}`,
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${fromDate}-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.20))] flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">التحليلات والأداء</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            التقارير الشاملة
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نظرة تفصيلية على أداء المبيعات، الرحلات والموازنة المالية.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={!reportData}>
            <Download className="me-2 h-4 w-4" /> تصدير CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="me-2 h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex shrink-0 flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="space-y-1.5">
          <Label className="text-xs">من تاريخ</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">إلى تاريخ</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 7);
              setFromDate(formatDate(d));
              setToDate(formatDate(new Date()));
            }}
          >
            آخر أسبوع
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 30);
              setFromDate(formatDate(d));
              setToDate(formatDate(new Date()));
            }}
          >
            آخر شهر
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 90);
              setFromDate(formatDate(d));
              setToDate(formatDate(new Date()));
            }}
          >
            آخر 3 أشهر
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-auto pb-4">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15 text-success">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">إجمالي الإيرادات</p>
                  <p className="font-display text-2xl font-extrabold tabular text-foreground">
                    {reportData?.totalRevenue.toLocaleString("ar-EG")} <span className="text-sm text-muted-foreground">ج.س</span>
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                  <TrendingDown className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">إجمالي المصروفات</p>
                  <p className="font-display text-2xl font-extrabold tabular text-foreground">
                    {reportData?.totalExpenses.toLocaleString("ar-EG")} <span className="text-sm text-muted-foreground">ج.س</span>
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">صافي الدخل</p>
                  <p className={`font-display text-2xl font-extrabold tabular ${(reportData?.netIncome ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                    {reportData?.netIncome.toLocaleString("ar-EG")} <span className="text-sm text-muted-foreground">ج.س</span>
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Ticket className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">التذاكر المصدرة</p>
                  <p className="font-display text-2xl font-extrabold tabular text-foreground">
                    {reportData?.totalBookings}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {reportData?.totalTrips} رحلة · {reportData?.completedTrips} مكتملة
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Revenue Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <BarChart3 className="h-5 w-5 text-primary" />
                أداء المبيعات
              </h2>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                {reportData?.dayCount ?? 0} يوم
              </div>
            </div>

            <div className="overflow-hidden">
              {reportData?.series && (
                <RevenueChart series={reportData.series} currency="ج.س" />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
