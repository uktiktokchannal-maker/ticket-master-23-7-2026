import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Loader2, Ticket, Wallet, BusFront, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { dbErrorMessage } from "@/lib/db-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/branch-reports")({
  component: BranchReportsPage,
  head: () => ({
    meta: [
      { title: "تقارير الفروع | تذكرتي" },
      {
        name: "description",
        content:
          "تقارير مبيعات التذاكر وإيرادات الحافلات والمقاعد المباعة لكل فرع في وكالتك.",
      },
      { property: "og:title", content: "تقارير الفروع | تذكرتي" },
      {
        property: "og:description",
        content: "مبيعات التذاكر وإيرادات الحافلات والمقاعد المباعة حسب الفرع.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

type BranchRow = {
  branchId: string;
  branchName: string;
  tickets: number;
  seats: number;
  revenue: number;
  cancelled: number;
  avgTicket: number;
};

type BusRow = {
  busId: string;
  plate: string;
  branchName: string;
  seats: number;
  revenue: number;
  trips: number;
  capacity: number;
  occupancy: number;
};

function BranchReportsPage() {
  const { data: agencyId } = useAgencyId();
  const { branches, activeBranchId, isOwner } = useActiveBranch();

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateStr(d);
  });
  const [to, setTo] = useState(() => toDateStr(new Date()));
  // منطقياً: غير المالك يرى فرعه فقط ولا يستطيع تغيير النطاق
  const [scope, setScope] = useState<"all" | "branch">("all");

  const rangeValid = from <= to;
  const effectiveBranchId = !isOwner
    ? activeBranchId
    : scope === "branch"
      ? activeBranchId
      : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["branch-reports", agencyId, from, to, effectiveBranchId],
    enabled: !!agencyId && rangeValid,
    queryFn: async () => {
      const fromISO = new Date(`${from}T00:00:00`).toISOString();
      const toEnd = new Date(`${to}T23:59:59.999`).toISOString();

      let q = supabase
        .from("bookings")
        .select("id, amount, status, branch_id, trip_id, created_at")
        .eq("agency_id", agencyId!)
        .gte("created_at", fromISO)
        .lte("created_at", toEnd);
      if (effectiveBranchId) q = q.eq("branch_id", effectiveBranchId);

      const [bookingsRes, tripsRes] = await Promise.all([
        q,
        supabase
          .from("trips")
          .select("id, bus_id, status, buses(plate_number, seat_count)")
          .eq("agency_id", agencyId!),
      ]);
      if (bookingsRes.error) throw bookingsRes.error;
      if (tripsRes.error) throw tripsRes.error;

      const bookings = bookingsRes.data ?? [];
      const trips = tripsRes.data ?? [];
      const tripById = new Map(trips.map((t) => [t.id, t]));
      const branchName = (id: string | null) =>
        branches.find((b) => b.id === id)?.name ?? "بدون فرع";

      const branchMap = new Map<string, BranchRow>();
      const busMap = new Map<string, BusRow>();
      const busTripIds = new Map<string, Set<string>>();

      for (const b of bookings) {
        const key = b.branch_id ?? "none";
        const row =
          branchMap.get(key) ??
          {
            branchId: key,
            branchName: branchName(b.branch_id),
            tickets: 0,
            seats: 0,
            revenue: 0,
            cancelled: 0,
            avgTicket: 0,
          };
        // منطقياً: الإيراد والمقاعد المباعة تُحتسب من الحجوزات المؤكدة فقط
        if (b.status === "confirmed") {
          row.tickets += 1;
          row.seats += 1;
          row.revenue += Number(b.amount || 0);
        } else if (b.status === "cancelled" || b.status === "refunded") {
          row.cancelled += 1;
        }
        branchMap.set(key, row);

        if (b.status !== "confirmed") continue;
        const trip = tripById.get(b.trip_id);
        if (!trip?.bus_id) continue;
        const bus = Array.isArray(trip.buses) ? trip.buses[0] : trip.buses;
        const brow =
          busMap.get(trip.bus_id) ??
          {
            busId: trip.bus_id,
            plate: (bus as { plate_number?: string } | null)?.plate_number ?? "—",
            branchName: branchName(b.branch_id),
            seats: 0,
            revenue: 0,
            trips: 0,
            capacity: Number((bus as { seat_count?: number } | null)?.seat_count ?? 0),
            occupancy: 0,
          };
        brow.seats += 1;
        brow.revenue += Number(b.amount || 0);
        busMap.set(trip.bus_id, brow);

        const set = busTripIds.get(trip.bus_id) ?? new Set<string>();
        set.add(trip.id);
        busTripIds.set(trip.bus_id, set);
      }

      const branchRows = [...branchMap.values()].map((r) => ({
        ...r,
        avgTicket: r.tickets > 0 ? r.revenue / r.tickets : 0,
      }));
      branchRows.sort((a, b) => b.revenue - a.revenue);

      const busRows = [...busMap.values()].map((r) => {
        const tripCount = busTripIds.get(r.busId)?.size ?? 0;
        const capacityTotal = tripCount * r.capacity;
        return {
          ...r,
          trips: tripCount,
          occupancy: capacityTotal > 0 ? Math.round((r.seats / capacityTotal) * 100) : 0,
        };
      });
      busRows.sort((a, b) => b.revenue - a.revenue);

      return {
        branchRows,
        busRows,
        totals: {
          tickets: branchRows.reduce((s, r) => s + r.tickets, 0),
          seats: branchRows.reduce((s, r) => s + r.seats, 0),
          revenue: branchRows.reduce((s, r) => s + r.revenue, 0),
        },
      };
    },
  });

  const num = (n: number) => Number(n || 0).toLocaleString("ar-EG");

  const csv = useMemo(() => {
    if (!data) return "";
    const lines = [
      ["الفرع", "التذاكر المباعة", "المقاعد المباعة", "الإيراد", "متوسط التذكرة", "ملغاة"].join(","),
      ...data.branchRows.map((r) =>
        [r.branchName, r.tickets, r.seats, r.revenue, Math.round(r.avgTicket), r.cancelled].join(",")
      ),
    ];
    return lines.join("\n");
  }, [data]);

  function exportCSV() {
    if (!csv) return toast.error("لا توجد بيانات للتصدير");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch-report-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">التقارير</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            تقارير الفروع
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            مبيعات التذاكر، إيرادات الحافلات، والمقاعد المباعة — حسب الفرع.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">من</Label>
            <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">إلى</Label>
            <Input id="to" type="date" value={to} min={from} max={toDateStr(new Date())} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.branchRows.length}>
            <Download className="me-2 h-4 w-4" /> تصدير CSV
          </Button>
        </div>
      </div>

      {isOwner && (
        <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs font-semibold">
          <button
            className={`rounded-lg px-3 py-1.5 ${scope === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setScope("all")}
          >
            كل الفروع
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 ${scope === "branch" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setScope("branch")}
            disabled={!activeBranchId}
          >
            الفرع الحالي
          </button>
        </div>
      )}

      {!rangeValid && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          تاريخ البداية يجب أن يكون قبل تاريخ النهاية أو مساوياً له.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {dbErrorMessage(error)}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !data || data.branchRows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-16 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold text-foreground">لا توجد بيانات في هذه الفترة</p>
          <p className="max-w-xs text-xs text-muted-foreground">غيّر نطاق التاريخ أو سجّل حجوزات جديدة.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard icon={<Ticket className="h-4 w-4" />} label="التذاكر المباعة" value={num(data.totals.tickets)} />
            <StatCard icon={<BusFront className="h-4 w-4" />} label="المقاعد المباعة" value={num(data.totals.seats)} />
            <StatCard icon={<Wallet className="h-4 w-4" />} label="إجمالي الإيراد" value={num(data.totals.revenue)} />
          </div>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <h2 className="border-b border-border px-4 py-3 text-sm font-bold">الأداء حسب الفرع</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start">الفرع</th>
                    <th className="px-4 py-2.5 text-start">التذاكر</th>
                    <th className="px-4 py-2.5 text-start">المقاعد المباعة</th>
                    <th className="px-4 py-2.5 text-start">الإيراد</th>
                    <th className="px-4 py-2.5 text-start">متوسط التذكرة</th>
                    <th className="px-4 py-2.5 text-start">ملغاة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.branchRows.map((r) => (
                    <tr key={r.branchId} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5 font-semibold">{r.branchName}</td>
                      <td className="px-4 py-2.5 tabular">{num(r.tickets)}</td>
                      <td className="px-4 py-2.5 tabular">{num(r.seats)}</td>
                      <td className="px-4 py-2.5 tabular font-bold">{num(r.revenue)}</td>
                      <td className="px-4 py-2.5 tabular text-muted-foreground">{num(Math.round(r.avgTicket))}</td>
                      <td className="px-4 py-2.5 tabular text-muted-foreground">{num(r.cancelled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <h2 className="border-b border-border px-4 py-3 text-sm font-bold">إيرادات الحافلات</h2>
            {data.busRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">لا توجد إيرادات مرتبطة بحافلات في هذه الفترة.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-start">الحافلة</th>
                      <th className="px-4 py-2.5 text-start">الرحلات</th>
                      <th className="px-4 py-2.5 text-start">المقاعد المباعة</th>
                      <th className="px-4 py-2.5 text-start">نسبة الإشغال</th>
                      <th className="px-4 py-2.5 text-start">الإيراد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.busRows.map((r) => (
                      <tr key={r.busId} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5 font-semibold">{r.plate}</td>
                        <td className="px-4 py-2.5 tabular">{num(r.trips)}</td>
                        <td className="px-4 py-2.5 tabular">{num(r.seats)}</td>
                        <td className="px-4 py-2.5 tabular text-muted-foreground">{r.occupancy}%</td>
                        <td className="px-4 py-2.5 tabular font-bold">{num(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold tabular">{value}</p>
    </div>
  );
}
