import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Loader2, Ticket, MapPin, BusFront, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/dashboard/dashboard-components";

type SearchParams = {
  q: string;
};

export const Route = createFileRoute("/_authenticated/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      q: (search.q as string) || "",
    };
  },
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();

  const { data: results, isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: async () => {
      if (!q || q.length < 2) return { bookings: [], trips: [] };

      // Parameterized filters — user text is never interpolated into raw filter syntax.
      const pattern = `%${q}%`;
      const select = "id, passenger_name, passenger_phone, seat_number, status, amount, trips(routes(origin, destination), departure_at)";
      const [byName, byPhone] = await Promise.all([
        supabase.from("bookings").select(select).ilike("passenger_name", pattern).limit(10),
        supabase.from("bookings").select(select).ilike("passenger_phone", pattern).limit(10),
      ]);
      const seen = new Set<string>();
      const bookings = [...(byName.data ?? []), ...(byPhone.data ?? [])].filter((b) => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      }).slice(0, 10);

      // Search trips (by route or bus)
      // Since it's hard to text search across joined tables in a simple RPC without one,
      // we do a fetch of trips and filter locally if dataset is small, or use an RPC.
      // We will do a basic fetch for now.
      const { data: trips } = await supabase
        .from("trips")
        .select("id, departure_at, status, routes(origin, destination), buses(plate_number)")
        .order("departure_at", { ascending: false })
        .limit(100);

      const filteredTrips = (trips ?? []).filter((t) => {
        const routeObj = Array.isArray(t.routes) ? t.routes[0] : t.routes;
        const busObj = Array.isArray(t.buses) ? t.buses[0] : t.buses;
        const searchStr = `${routeObj?.origin} ${routeObj?.destination} ${busObj?.plate_number}`;
        return searchStr.toLowerCase().includes(q.toLowerCase());
      }).slice(0, 10);

      return {
        bookings: bookings ?? [],
        trips: filteredTrips,
      };
    },
    enabled: q.length >= 2,
  });

  if (!q) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <SearchIcon className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <h2 className="text-xl font-bold text-foreground">البحث العام</h2>
        <p className="mt-2 text-sm text-muted-foreground">أدخل كلمة بحث للبدء (اسم مسافر، هاتف، أو خط رحلة)</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
          نتائج البحث عن "{q}"
        </h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bookings Results */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <User className="h-5 w-5 text-primary" />
              المسافرين والحجوزات ({results?.bookings.length ?? 0})
            </h2>
            {results?.bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد حجوزات مطابقة.</p>
            ) : (
              <div className="space-y-3">
                {results?.bookings.map((b) => {
                  const trip = Array.isArray(b.trips) ? b.trips[0] : b.trips;
                  const routeObj = trip?.routes;
                  const routeArray = Array.isArray(routeObj) ? routeObj[0] : routeObj;
                  const routeStr = routeArray ? `${routeArray.origin} → ${routeArray.destination}` : "بدون خط";
                  
                  return (
                    <div key={b.id} className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-foreground">{b.passenger_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{b.passenger_phone || "بدون رقم هاتف"}</p>
                        </div>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{routeStr} (مقعد {b.seat_number})</span>
                        <button
                          onClick={() => navigate({ to: "/bookings" })}
                          className="font-bold text-primary hover:underline"
                        >
                          عرض
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trips Results */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <BusFront className="h-5 w-5 text-primary" />
              الرحلات ({results?.trips.length ?? 0})
            </h2>
            {results?.trips.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد رحلات مطابقة.</p>
            ) : (
              <div className="space-y-3">
                {results?.trips.map((t) => {
                  const routeObj = Array.isArray(t.routes) ? t.routes[0] : t.routes;
                  const busObj = Array.isArray(t.buses) ? t.buses[0] : t.buses;
                  
                  return (
                    <div key={t.id} className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-foreground">
                          {routeObj ? `${routeObj.origin} → ${routeObj.destination}` : "بدون خط"}
                        </p>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground">
                          {t.status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex flex-col gap-1">
                          <span>
                            {new Date(t.departure_at).toLocaleString("ar", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>حافلة {busObj?.plate_number || "—"}</span>
                        </div>
                        <button
                          onClick={() => navigate({ to: "/trips" })}
                          className="font-bold text-primary hover:underline"
                        >
                          عرض
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
