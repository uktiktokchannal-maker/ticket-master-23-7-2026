import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Ticket,
  BusFront,
  Wallet,
  CheckCircle2,
  Clock,
  Wrench,
  ArrowUpRight,
  Plus,
  ScrollText,
  MapPin,
  Gauge,
  CalendarClock,
  Building2,
  Globe2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { useActiveBranch } from "@/hooks/use-active-branch";
import {
  BusStatus,
  BookingStatus,
  Card,
  QuickAction,
  DeltaPill,
  FleetRow,
  KpiCard,
  RevenueChart,
  FleetDonut,
  StatusBadge,
  EmptyState,
} from "@/components/dashboard/dashboard-components";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});


type DashboardData = {
  profile: { full_name: string | null; agency_name: string | null; agency_currency: string };
  todayRevenue: number;
  todayBookings: number;
  yesterdayRevenue: number;
  yesterdayBookings: number;
  activeTrips: number;
  busCounts: Record<BusStatus, number>;
  occupancyPct: number;
  revenueSeries: Array<{ day: string; label: string; revenue: number; bookings: number }>;
  recentBookings: Array<{
    id: string;
    passenger_name: string;
    seat_number: number;
    amount: number;
    status: BookingStatus;
    created_at: string;
    route: string | null;
  }>;
  upcomingTrips: Array<{
    id: string;
    departure_at: string;
    route: string | null;
    booked: number;
    capacity: number;
  }>;
};

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
function daysAgoStart(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function loadDashboard(branchId: string | null): Promise<DashboardData> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) throw new Error("Not authenticated");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, agencies(name, currency)")
    .eq("id", userRes.user.id)
    .maybeSingle();

  const agencies = profileRow?.agencies as
    | { name: string; currency: string }
    | { name: string; currency: string }[]
    | null
    | undefined;
  const agency = Array.isArray(agencies) ? agencies[0] ?? null : agencies ?? null;

  const dayStart = startOfTodayISO();
  const dayEnd = endOfTodayISO();
  const weekStart = daysAgoStart(6).toISOString();
  const yesterdayStart = daysAgoStart(1).toISOString();
  const yesterdayEnd = new Date(daysAgoStart(0).getTime() - 1).toISOString();
  const nowIso = new Date().toISOString();
  const in48h = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  const [
    weekBookingsRes,
    activeTripsRes,
    busesRes,
    recentBookingsRes,
    upcomingTripsRes,
    todayTripsCapacityRes,
  ] = await Promise.all([
    (branchId
      ? supabase.from("bookings").select("amount, status, created_at").gte("created_at", weekStart).eq("branch_id", branchId)
      : supabase.from("bookings").select("amount, status, created_at").gte("created_at", weekStart)),
    supabase
      .from("trips")
      .select("id, status, departure_at")
      .gte("departure_at", dayStart)
      .lte("departure_at", dayEnd)
      .in("status", ["scheduled", "boarding", "departed"]),
    supabase.from("buses").select("status"),
    (branchId
      ? supabase.from("bookings").select("id, passenger_name, seat_number, amount, status, created_at, trips(routes(origin, destination))").order("created_at", { ascending: false }).limit(8).eq("branch_id", branchId)
      : supabase.from("bookings").select("id, passenger_name, seat_number, amount, status, created_at, trips(routes(origin, destination))").order("created_at", { ascending: false }).limit(8)),
    supabase
      .from("trips")
      .select("id, departure_at, buses(seat_count), routes(origin, destination), bookings(id, status, branch_id)")
      .gte("departure_at", nowIso)
      .lte("departure_at", in48h)
      .in("status", ["scheduled", "boarding"])
      .order("departure_at", { ascending: true })
      .limit(5),
    supabase
      .from("trips")
      .select("buses(seat_count), bookings(id, status, branch_id)")
      .gte("departure_at", dayStart)
      .lte("departure_at", dayEnd),
  ]);


  const weekBookings = weekBookingsRes.data ?? [];
  const todayTs = new Date(dayStart).getTime();
  const yTs = new Date(yesterdayStart).getTime();
  const yEndTs = new Date(yesterdayEnd).getTime();

  let todayRevenue = 0;
  let todayBookings = 0;
  let yesterdayRevenue = 0;
  let yesterdayBookings = 0;

  // Build 7-day series buckets
  const bucketMap = new Map<string, { revenue: number; bookings: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = daysAgoStart(i);
    const key = d.toISOString().slice(0, 10);
    bucketMap.set(key, { revenue: 0, bookings: 0 });
  }

  for (const b of weekBookings) {
    if (b.status !== "confirmed") continue;
    const t = new Date(b.created_at).getTime();
    const key = b.created_at.slice(0, 10);
    const bucket = bucketMap.get(key);
    const amt = Number(b.amount ?? 0);
    if (bucket) {
      bucket.revenue += amt;
      bucket.bookings += 1;
    }
    if (t >= todayTs) {
      todayRevenue += amt;
      todayBookings += 1;
    } else if (t >= yTs && t <= yEndTs) {
      yesterdayRevenue += amt;
      yesterdayBookings += 1;
    }
  }

  const dayNames = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
  const revenueSeries = Array.from(bucketMap.entries()).map(([key, v]) => {
    const d = new Date(key);
    return { day: key, label: dayNames[d.getDay()], revenue: v.revenue, bookings: v.bookings };
  });

  const busCounts: Record<BusStatus, number> = { active: 0, maintenance: 0, inactive: 0 };
  for (const b of busesRes.data ?? []) {
    const s = b.status as BusStatus;
    if (s in busCounts) busCounts[s] += 1;
  }

  // Occupancy: sum(confirmed bookings on today's trips) / sum(capacity)
  let seatsBooked = 0;
  let seatsCapacity = 0;
  for (const t of todayTripsCapacityRes.data ?? []) {
    const bus = Array.isArray(t.buses) ? t.buses[0] : t.buses;
    const cap = Number((bus as { seat_count?: number } | null)?.seat_count ?? 0);
    seatsCapacity += cap;
    const bks = (t.bookings ?? []) as Array<{ status: string; branch_id?: string | null }>;
    seatsBooked += bks.filter((x) => x.status === "confirmed" && (!branchId || x.branch_id === branchId)).length;
  }
  const occupancyPct = seatsCapacity > 0 ? Math.round((seatsBooked / seatsCapacity) * 100) : 0;

  const recentBookings = (recentBookingsRes.data ?? []).map((b) => {
    const trip = b.trips as { routes?: { origin: string; destination: string } | { origin: string; destination: string }[] | null } | null;
    const routeObj = trip?.routes;
    const route = Array.isArray(routeObj) ? routeObj[0] : routeObj;
    return {
      id: b.id,
      passenger_name: b.passenger_name,
      seat_number: b.seat_number,
      amount: Number(b.amount ?? 0),
      status: b.status,
      created_at: b.created_at,
      route: route ? `${route.origin} → ${route.destination}` : null,
    };
  });

  const upcomingTrips = (upcomingTripsRes.data ?? []).map((t) => {
    const routeObj = Array.isArray(t.routes) ? t.routes[0] : t.routes;
    const busObj = Array.isArray(t.buses) ? t.buses[0] : t.buses;
    const bks = (t.bookings ?? []) as Array<{ status: string; branch_id?: string | null }>;
    return {
      id: t.id as string,
      departure_at: t.departure_at as string,
      route: routeObj ? `${routeObj.origin} → ${routeObj.destination}` : null,
      booked: bks.filter((x) => x.status === "confirmed" && (!branchId || x.branch_id === branchId)).length,
      capacity: Number((busObj as { seat_count?: number } | null)?.seat_count ?? 0),
    };
  });


  return {
    profile: {
      full_name: profileRow?.full_name ?? userRes.user.email ?? null,
      agency_name: agency?.name ?? null,
      agency_currency: agency?.currency ?? "SDG",
    },
    todayRevenue,
    todayBookings,
    yesterdayRevenue,
    yesterdayBookings,
    activeTrips: activeTripsRes.data?.length ?? 0,
    busCounts,
    occupancyPct,
    revenueSeries,
    recentBookings,
    upcomingTrips,
  };
}

function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: loadDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        تعذّر تحميل بيانات اللوحة. حاول التحديث.
      </div>
    );
  }

  const {
    profile,
    todayRevenue,
    todayBookings,
    yesterdayRevenue,
    yesterdayBookings,
    activeTrips,
    busCounts,
    occupancyPct,
    revenueSeries,
    recentBookings,
    upcomingTrips,
  } = data;
  const totalBuses = busCounts.active + busCounts.maintenance + busCounts.inactive;
  const revenueDelta = pctDelta(todayRevenue, yesterdayRevenue);
  const bookingsDelta = pctDelta(todayBookings, yesterdayBookings);
  const currency = profile.agency_currency;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* HERO — compact */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-secondary to-primary p-4 text-primary-foreground shadow-elevated lg:p-6">
        <div className="brand-pattern absolute inset-0 opacity-20"></div>
        <div
          aria-hidden
          className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-accent/30 blur-3xl"
        />
        <div className="relative grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold lg:text-2xl">
              أهلاً بك في تذكرتي 👋
            </h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-primary-foreground/70">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {profile.agency_name || "السودان"}
              </span>
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {new Date().toLocaleDateString("ar", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/60">
                  إيرادات اليوم
                </p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-extrabold tabular lg:text-3xl">
                    {todayRevenue.toLocaleString("ar-EG", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs font-bold text-primary-foreground/70">{currency}</span>
                </div>
              </div>
              <DeltaPill delta={revenueDelta} inverted />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <QuickAction to="/pos" icon={Plus} label="بيع تذكرة" primary />
            <QuickAction to="/trips" icon={BusFront} label="رحلة جديدة" />
            <QuickAction to="/manifest" icon={ScrollText} label="المنفستو" />
          </div>
        </div>
      </section>

      {/* KPI GRID */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <KpiCard
          label="حجوزات اليوم"
          value={String(todayBookings)}
          icon={Ticket}
          tone="primary"
          delta={bookingsDelta}
          hint={todayBookings === 0 ? "لم يتم بيع أي تذكرة بعد" : `${yesterdayBookings} بالأمس`}
          sparkline={revenueSeries.map((s) => s.bookings)}
        />
        <KpiCard
          label="رحلات اليوم النشطة"
          value={String(activeTrips)}
          icon={BusFront}
          tone="accent"
          hint={activeTrips === 0 ? "لا رحلات مجدولة اليوم" : "قيد التشغيل"}
        />
        <KpiCard
          label="نسبة إشغال اليوم"
          value={`${occupancyPct}%`}
          icon={Gauge}
          tone="success"
          progress={occupancyPct}
          hint={occupancyPct === 0 ? "لا مقاعد محجوزة بعد" : "من إجمالي المقاعد"}
        />
        <KpiCard
          label="جاهزية الأسطول"
          value={totalBuses === 0 ? "0" : `${busCounts.active}/${totalBuses}`}
          icon={Wallet}
          tone="warning"
          hint={
            busCounts.maintenance > 0
              ? `${busCounts.maintenance} في الصيانة`
              : totalBuses === 0
                ? "أضف حافلاتك"
                : "جميعها جاهزة"
          }
        />
      </section>

      {/* CHART + FLEET DONUT */}
      <section className="grid gap-3 lg:grid-cols-3">

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold">إيرادات آخر 7 أيام</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                إجمالي الحجوزات المؤكدة يومياً
              </p>
            </div>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
              {currency}
            </span>
          </div>
          <RevenueChart series={revenueSeries} currency={currency} />
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="font-display text-base font-bold">حالة الأسطول</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalBuses > 0 ? `${totalBuses} حافلة إجمالاً` : "لا حافلات مسجّلة"}
            </p>
          </div>
          {totalBuses === 0 ? (
            <EmptyState
              icon={BusFront}
              title="لا توجد حافلات"
              desc="أضف حافلاتك لبدء جدولة الرحلات."
              cta={{ to: "/buses", label: "إدارة الأسطول" }}
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <FleetDonut
                active={busCounts.active}
                maintenance={busCounts.maintenance}
                inactive={busCounts.inactive}
              />
              <div className="w-full space-y-2">
                <FleetRow icon={CheckCircle2} tone="success" label="جاهزة" value={busCounts.active} total={totalBuses} />
                <FleetRow icon={Wrench} tone="warning" label="في الصيانة" value={busCounts.maintenance} total={totalBuses} />
                <FleetRow icon={Clock} tone="destructive" label="متوقفة" value={busCounts.inactive} total={totalBuses} />
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* RECENT BOOKINGS + UPCOMING TRIPS */}
      <section className="grid gap-3 lg:grid-cols-3">

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold">آخر الحجوزات</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {recentBookings.length > 0 ? `آخر ${recentBookings.length} تذكرة` : "لا نشاط بعد"}
              </p>
            </div>
            <Link
              to="/bookings"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              عرض الكل
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="لا توجد حجوزات بعد"
              desc="ابدأ من نقطة البيع لإصدار أول تذكرة."
              cta={{ to: "/pos", label: "افتح نقطة البيع" }}
            />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-start text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-start font-bold">الراكب</th>
                    <th className="px-3 py-2 text-start font-bold">الخط</th>
                    <th className="px-3 py-2 text-start font-bold">المقعد</th>
                    <th className="px-3 py-2 text-end font-bold">المبلغ</th>
                    <th className="px-3 py-2 text-end font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="border-t border-border/70">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-foreground">{b.passenger_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(b.created_at).toLocaleTimeString("ar", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{b.route ?? "—"}</td>
                      <td className="px-3 py-3 tabular text-foreground">#{b.seat_number}</td>
                      <td className="px-3 py-3 text-end font-bold tabular text-foreground">
                        {b.amount.toLocaleString("ar-EG")}{" "}
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {currency}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-end">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold">الرحلات القادمة</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">خلال 48 ساعة</p>
            </div>
            <Link
              to="/trips"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              الجدول
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {upcomingTrips.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="لا رحلات قادمة"
              desc="أنشئ رحلة جديدة لتظهر هنا."
              cta={{ to: "/trips", label: "جدولة رحلة" }}
            />
          ) : (
            <ul className="space-y-2.5">
              {upcomingTrips.map((t) => {
                const pct = t.capacity > 0 ? Math.round((t.booked / t.capacity) * 100) : 0;
                return (
                  <li
                    key={t.id}
                    className="rounded-xl border border-border p-3 transition hover:border-primary/40 hover:shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                        {t.route ?? "بدون خط"}
                      </p>
                      <span className="shrink-0 rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary tabular">
                        {new Date(t.departure_at).toLocaleTimeString("ar", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tabular text-muted-foreground">
                        {t.booked}/{t.capacity}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}


