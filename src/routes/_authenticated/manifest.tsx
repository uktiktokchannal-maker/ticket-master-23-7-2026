import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Printer, Download, Search, BusFront, MapPin, CalendarClock, Loader2 } from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/manifest")({
  component: ManifestPage,
});

type TripSummary = {
  id: string;
  route: string;
  bus: string;
  departure_at: string;
};

type ManifestRow = {
  seat: number;
  passenger: string;
  phone: string | null;
  boarding: string;
  dropoff: string;
  paid: boolean;
  status: string;
};

function ManifestPage() {
  const [tripId, setTripId] = useState<string>("");
  const [search, setSearch] = useState("");

  // Fetch trips for selection (today and future)
  const { data: trips, isLoading: tripsLoading } = useQuery({
    queryKey: ["manifest-trips"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("trips")
        .select("id, departure_at, routes(origin, destination), buses(plate_number)")
        .gte("departure_at", todayStart.toISOString())
        .order("departure_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((t) => {
        const routeObj = Array.isArray(t.routes) ? t.routes[0] : t.routes;
        const busObj = Array.isArray(t.buses) ? t.buses[0] : t.buses;
        return {
          id: t.id as string,
          route: routeObj ? `${routeObj.origin} → ${routeObj.destination}` : "بدون خط",
          bus: (busObj as { plate_number?: string } | null)?.plate_number ?? "—",
          departure_at: t.departure_at as string,
          origin: routeObj?.origin ?? "",
          destination: routeObj?.destination ?? "",
        };
      });
    },
  });

  // Auto-select first trip
  const selectedTripId = tripId || (trips && trips.length > 0 ? trips[0].id : "");
  const trip = trips?.find((t) => t.id === selectedTripId);

  // Fetch passengers for selected trip
  const { data: passengers, isLoading: passengersLoading } = useQuery({
    queryKey: ["manifest-passengers", selectedTripId],
    queryFn: async () => {
      if (!selectedTripId) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("seat_number, passenger_name, passenger_phone, status, amount")
        .eq("trip_id", selectedTripId)
        .in("status", ["confirmed", "pending"])
        .order("seat_number", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((b) => ({
        seat: b.seat_number,
        passenger: b.passenger_name,
        phone: b.passenger_phone,
        boarding: trip?.origin ?? "—",
        dropoff: trip?.destination ?? "—",
        paid: b.status === "confirmed",
        status: b.status,
      }));
    },
    enabled: !!selectedTripId,
  });

  const rows = passengers ?? [];
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          search.trim() === "" ||
          r.passenger.includes(search) ||
          String(r.seat).includes(search) ||
          (r.phone && r.phone.includes(search))
      ),
    [rows, search]
  );

  const paidCount = rows.filter((r) => r.paid).length;

  function handlePrint() {
    window.print();
  }

  function handleExport() {
    if (!trip) return;
    const header = ["مقعد", "المسافر", "الهاتف", "الصعود", "النزول", "الدفع"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.seat,
          r.passenger,
          r.phone ?? "",
          r.boarding,
          r.dropoff,
          r.paid ? "مدفوع" : "غير مدفوع",
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest-${trip.bus}-${trip.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير المنفستو");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">الحجوزات والرحلات</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            المنفستو
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كشف المسافرين لكل رحلة — للطباعة أو التصدير عند نقاط التفتيش.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="me-2 h-4 w-4" /> تصدير CSV
          </Button>
          <Button onClick={handlePrint} disabled={rows.length === 0}>
            <Printer className="me-2 h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-semibold text-muted-foreground">اختر الرحلة</label>
          {tripsLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل الرحلات…
            </div>
          ) : !trips || trips.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">لا توجد رحلات قادمة</p>
          ) : (
            <Select value={selectedTripId} onValueChange={setTripId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.route} — {new Date(t.departure_at).toLocaleString("ar", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-2">
          <label className="text-xs font-semibold text-muted-foreground">بحث</label>
          <div className="relative">
            <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" style={{ insetInlineStart: "0.75rem" }} />
            <Input
              placeholder="ابحث باسم، رقم مقعد، أو هاتف…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card print:border-0 print:shadow-none">
        {trip && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-display text-base font-extrabold text-foreground">{trip.route}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><BusFront className="h-3.5 w-3.5" /> {trip.bus}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {new Date(trip.departure_at).toLocaleString("ar", { weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
            <div className="text-end">
              <p className="tabular font-display text-lg font-extrabold text-primary">
                {rows.length} <span className="text-xs text-muted-foreground">مسافر</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                مدفوع: <span className="tabular font-bold text-foreground">{paidCount}</span> / غير مدفوع:{" "}
                <span className="tabular font-bold text-foreground">{rows.length - paidCount}</span>
              </p>
            </div>
          </div>
        )}

        {passengersLoading ? (
          <div className="mt-3"><TableSkeleton rows={5} cols={7} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ScrollText className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-foreground">لا توجد بيانات</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              لم يتم تسجيل أي مسافر في هذه الرحلة بعد.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">#</th>
                  <th className="px-3 py-2 text-start">المقعد</th>
                  <th className="px-3 py-2 text-start">المسافر</th>
                  <th className="px-3 py-2 text-start">الهاتف</th>
                  <th className="px-3 py-2 text-start">الصعود</th>
                  <th className="px-3 py-2 text-start">النزول</th>
                  <th className="px-3 py-2 text-start">الدفع</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.seat} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 tabular text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 tabular font-bold text-foreground">{r.seat}</td>
                    <td className="px-3 py-2 font-semibold text-foreground">{r.passenger}</td>
                    <td className="px-3 py-2 tabular text-muted-foreground">{r.phone || "—"}</td>
                    <td className="px-3 py-2 text-foreground">{r.boarding}</td>
                    <td className="px-3 py-2 text-foreground">{r.dropoff}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          r.paid ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"
                        }`}
                      >
                        {r.paid ? "مدفوع" : "غير مدفوع"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 hidden grid-cols-3 gap-6 border-t border-border pt-6 text-xs text-muted-foreground print:grid">
          <div>توقيع السائق: __________________</div>
          <div>توقيع المفتش: __________________</div>
          <div>ختم الوكالة: __________________</div>
        </div>
      </div>
    </div>
  );
}