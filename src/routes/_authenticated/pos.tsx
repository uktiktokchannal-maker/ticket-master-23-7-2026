import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Ticket, Trash2, CreditCard, Banknote, Smartphone, Search, Loader2, Plus, Minus } from "lucide-react";
import { CardGridSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TicketPrintView, type TicketData } from "@/components/ticket-print";


export const Route = createFileRoute("/_authenticated/pos")({
  component: POSPage,
});

type TripOption = {
  id: string;
  route: string;
  departure_at: string;
  bus: string;
  price: number;
  capacity: number;
  booked_seats: number[];
};

type CartItem = {
  key: string;
  trip: TripOption;
  seat: number;
  passenger: string;
  phone: string;
};

type PayMethod = "cash" | "card" | "mobile";

function POSPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const [search, setSearch] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<TripOption | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const passengerRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const [selectedSeatForBooking, setSelectedSeatForBooking] = useState<number | null>(null);
  const [pay, setPay] = useState<PayMethod>("cash");
  const [discount, setDiscount] = useState(0);
  const [issuedTickets, setIssuedTickets] = useState<TicketData[] | null>(null);


  // Fetch upcoming trips with their booked seats (filtered by agency)
  const { data: tripsData, isLoading } = useQuery({
    queryKey: ["pos-trips", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("trips")
        .select("id, departure_at, price, routes(origin, destination), buses(plate_number, seat_count), bookings(seat_number, status)")
        .eq("agency_id", agencyId)
        .gte("departure_at", now)
        .in("status", ["scheduled", "boarding"])
        .order("departure_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t) => {
        const routeObj = Array.isArray(t.routes) ? t.routes[0] : t.routes;
        const busObj = Array.isArray(t.buses) ? t.buses[0] : t.buses;
        const bks = (t.bookings ?? []) as Array<{ seat_number: number; status: string }>;
        const bookedSeats = bks.filter((b) => b.status === "confirmed").map((b) => b.seat_number);
        return {
          id: t.id as string,
          route: routeObj ? `${routeObj.origin} → ${routeObj.destination}` : "بدون خط",
          departure_at: t.departure_at as string,
          bus: (busObj as { plate_number?: string } | null)?.plate_number ?? "—",
          price: Number(t.price ?? 0),
          capacity: Number((busObj as { seat_count?: number } | null)?.seat_count ?? 0),
          booked_seats: bookedSeats,
        };
      });
    },
    enabled: !!agencyId,
    refetchInterval: 30_000, // Auto-refresh every 30s
  });

  // Real-time subscriptions for bookings AND trips to update seat map instantly
  useEffect(() => {
    const channel = supabase
      .channel("realtime_pos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          qc.invalidateQueries({ queryKey: ["pos-trips"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        () => {
          qc.invalidateQueries({ queryKey: ["pos-trips"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const filteredTrips = useMemo(
    () =>
      (tripsData ?? []).filter(
        (t) => search.trim() === "" || t.route.includes(search) || t.bus.includes(search)
      ),
    [tripsData, search]
  );

  const cartSeatsForTrip = useMemo(
    () =>
      cart
        .filter((c) => selectedTrip && c.trip.id === selectedTrip.id)
        .map((c) => c.seat),
    [cart, selectedTrip]
  );

  // Available seats = all seats - booked - in cart
  const availableSeats = useMemo(() => {
    if (!selectedTrip) return [];
    const allSeats = Array.from({ length: selectedTrip.capacity }, (_, i) => i + 1);
    const taken = new Set([...selectedTrip.booked_seats, ...cartSeatsForTrip]);
    return allSeats.filter((s) => !taken.has(s));
  }, [selectedTrip, cartSeatsForTrip]);

  const allSeatsForDisplay = useMemo(() => {
    if (!selectedTrip) return [];
    return Array.from({ length: selectedTrip.capacity }, (_, i) => i + 1);
  }, [selectedTrip]);

  const seatMap = useMemo(() => {
    if (!selectedTrip) return null;
    return (
      <div className="grid grid-cols-[1fr_1fr_1.5rem_1fr_1fr] gap-y-3 justify-items-center">
        {Array.from({ length: Math.ceil(allSeatsForDisplay.length / 4) }).map((_, rowIndex) => {
          return Array.from({ length: 4 }).map((_, colIndex) => {
            const seatNum = rowIndex * 4 + colIndex + 1;
            if (seatNum > allSeatsForDisplay.length) return <div key={`empty-${rowIndex}-${colIndex}`} />;

            const isBooked = selectedTrip.booked_seats.includes(seatNum);
            const isInCart = cartSeatsForTrip.includes(seatNum);

            const btn = (
              <button
                key={seatNum}
                onClick={() => handleSeatClick(seatNum)}
                disabled={isBooked || isInCart}
                className={`relative flex h-10 w-10 items-center justify-center rounded-lg border-2 tabular-nums text-sm font-bold transition-transform hover:scale-105 active:scale-95 ${
                  isBooked
                    ? "cursor-not-allowed border-destructive/30 bg-destructive/10 text-destructive/60"
                    : isInCart
                      ? "cursor-not-allowed border-warning bg-warning text-warning-foreground shadow-lg shadow-warning/20"
                      : "border-primary/20 bg-card text-foreground hover:border-primary hover:text-primary hover:shadow-md"
                }`}
              >
                {seatNum}
              </button>
            );

            if (colIndex === 1) {
              return (
                <div key={`group-${rowIndex}-${colIndex}`} className="contents">
                  {btn}
                  <div className="w-full"></div>
                </div>
              );
            }

            return btn;
          });
        })}
      </div>
    );
  }, [selectedTrip, cartSeatsForTrip, allSeatsForDisplay]);

  function handleSeatClick(seat: number) {
    if (!selectedTrip) return;
    if (selectedTrip.booked_seats.includes(seat) || cartSeatsForTrip.includes(seat)) return;
    setSelectedSeatForBooking(seat);
  }

  function confirmAddSeat() {
    if (!selectedTrip || selectedSeatForBooking === null) return;
    const passName = passengerRef.current?.value || "";
    const passPhone = phoneRef.current?.value || "";
    if (!passName.trim()) return toast.error("أدخل اسم المسافر أولاً");
    
    setCart((prev) => [
      ...prev,
      {
        key: `${selectedTrip.id}-${selectedSeatForBooking}-${crypto.randomUUID()}`,
        trip: selectedTrip,
        seat: selectedSeatForBooking,
        passenger: passName.trim(),
        phone: passPhone.trim(),
      },
    ]);
    
    setSelectedSeatForBooking(null);
    toast.success(`تم اختيار المقعد ${selectedSeatForBooking}`);
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  const subtotal = cart.reduce((s, c) => s + c.trip.price, 0);
  const total = Math.max(0, subtotal - discount);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("لم يتم تحديد الوكالة");
      if (cart.length === 0) throw new Error("السلة فارغة");

      const perTicketDiscount = cart.length > 0 ? Math.floor(discount / cart.length) : 0;

      const bookings = cart.map((c) => ({
        agency_id: agencyId,
        trip_id: c.trip.id,
        passenger_name: c.passenger,
        passenger_phone: c.phone || null,
        seat_number: c.seat,
        amount: Math.max(0, c.trip.price - perTicketDiscount),
        status: "confirmed" as const,
      }));

      const { data: inserted, error } = await supabase
        .from("bookings")
        .insert(bookings)
        .select("id, seat_number, trip_id, passenger_name, amount");
      if (error) {
        if (error.code === "23505") {
          throw new Error("عذراً، بعض المقاعد التي اخترتها تم حجزها للتو من قبل شخص آخر. يرجى تحديث الصفحة واختيار مقاعد أخرى.");
        }
        throw error;
      }

      // Build ticket data by matching inserted rows back to cart items (by trip+seat)
      const tripsById = new Map(cart.map((c) => [`${c.trip.id}-${c.seat}`, c] as const));
      const tickets: TicketData[] = (inserted ?? []).map((row) => {
        const cartItem = tripsById.get(`${row.trip_id}-${row.seat_number}`);
        const trip = cartItem?.trip;
        return {
          id: row.id,
          passenger_name: row.passenger_name,
          bus_name: trip?.bus ?? "—",
          seat_number: row.seat_number,
          route: trip?.route ?? null,
          departure_at: trip?.departure_at ?? null,
          amount: Number(row.amount ?? 0),
          currency: "ج.س",
        };
      });
      return tickets;
    },
    onSuccess: (tickets) => {
      toast.success(`تم إصدار ${tickets.length} تذكرة بمبلغ ${total.toLocaleString("ar-EG")} ج.س`);
      setIssuedTickets(tickets);
      setCart([]);
      setDiscount(0);
      setSelectedTrip(null);
      qc.invalidateQueries({ queryKey: ["pos-trips"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["shift-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">الحجوزات والرحلات</p>
        <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
          نقطة البيع
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          إصدار تذاكر سريعة للمسافرين واختيار المقاعد وطرق الدفع.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trips + seat map */}
        <div className="space-y-4 lg:col-span-2">
          <div className="relative">
            <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" style={{ insetInlineStart: "0.75rem" }} />
            <Input
              placeholder="ابحث برقم الحافلة أو المسار…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>

          {isLoading ? (
            <CardGridSkeleton count={4} cols={2} />
          ) : filteredTrips.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card py-12 text-center">
              <p className="text-sm font-bold text-foreground">لا توجد رحلات قادمة</p>
              <p className="mt-1 text-xs text-muted-foreground">أنشئ رحلة جديدة من صفحة الرحلات أولاً.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredTrips.map((t) => {
                const active = selectedTrip?.id === t.id;
                const soldCount = t.booked_seats.length;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTrip(t)}
                    className={`rounded-2xl border p-4 text-start transition ${
                      active
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <p className="font-bold text-foreground">{t.route}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(t.departure_at).toLocaleString("ar", {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · حافلة {t.bus}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {t.capacity - soldCount} مقعد متاح من {t.capacity}
                      </span>
                      <span className="font-display text-sm font-extrabold text-primary">
                        {t.price.toLocaleString("ar-EG")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedTrip && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-3xl p-6"
            >
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">المقاعد — {selectedTrip.route}</p>
                  <p className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm border border-primary text-primary"></div> متاح</span>
                    <span className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-destructive/20 border border-destructive/40"></div> محجوز</span>
                    <span className="flex items-center gap-1"><div className="h-3 w-3 rounded-sm bg-warning text-warning-foreground"></div> محدد</span>
                  </p>
                </div>
                {/* Passenger input moved to Dialog */}
              </div>
              {/* Airline style seat map */}
              <div className="mt-6 mx-auto max-w-sm rounded-3xl border-4 border-border bg-card p-6 shadow-card">
                <div className="mb-8 flex justify-center">
                  <div className="h-6 w-16 rounded-full bg-muted-foreground/20"></div> {/* Driver area placeholder */}
                </div>
                
                {seatMap}
              </div>
            </motion.div>
          )}

          {/* Seat Booking Dialog */}
          <Dialog open={selectedSeatForBooking !== null} onOpenChange={(o) => !o && setSelectedSeatForBooking(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>تأكيد حجز المقعد {selectedSeatForBooking}</DialogTitle>
                <DialogDescription>
                  يرجى إدخال اسم المسافر لتأكيد حجز هذا المقعد في السلة.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3">
                <div>
                  <Label htmlFor="passengerName" className="mb-2 block">اسم المسافر</Label>
                  <Input
                    id="passengerName"
                    ref={passengerRef}
                    placeholder="الاسم الثلاثي أو الثنائي..."
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="passengerPhone" className="mb-2 block">رقم الهاتف (اختياري)</Label>
                  <Input
                    id="passengerPhone"
                    ref={phoneRef}
                    placeholder="01XXXXXXXXX"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmAddSeat();
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedSeatForBooking(null)}>إلغاء</Button>
                <Button onClick={confirmAddSeat}>تأكيد المقعد</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cart */}
        <div className="space-y-4">
          <div className="glass-card rounded-3xl p-6">
            <div className="mb-3 flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              <p className="font-bold text-foreground">التذاكر ({cart.length})</p>
            </div>
            {cart.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                لا توجد تذاكر بعد. اختر رحلة ومقعد.
              </p>
            ) : (
              <ul className="space-y-2">
                {cart.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{c.passenger}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.trip.route} · مقعد {c.seat}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-sm font-bold text-foreground">
                        {c.trip.price.toLocaleString("ar-EG")}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(c.key)} aria-label="حذف">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>المجموع الفرعي</span>
                <span className="tabular">{subtotal.toLocaleString("ar-EG")}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>خصم</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDiscount((d) => Math.max(0, d - 500))}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="tabular w-16 text-center font-semibold text-foreground">
                    {discount.toLocaleString("ar-EG")}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setDiscount((d) => d + 500)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-display text-base font-extrabold">
                <span>الإجمالي</span>
                <span className="tabular text-primary">{total.toLocaleString("ar-EG")}</span>
              </div>
            </div>

            <div className="mt-4">
              <Label className="mb-2 text-xs">طريقة الدفع</Label>
              <Select value={pay} onValueChange={(v) => setPay(v as PayMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">
                    <span className="flex items-center gap-2"><Banknote className="h-4 w-4" /> نقداً</span>
                  </SelectItem>
                  <SelectItem value="card">
                    <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> بطاقة</span>
                  </SelectItem>
                  <SelectItem value="mobile">
                    <span className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> محفظة إلكترونية</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="mt-4 w-full"
              onClick={() => checkoutMutation.mutate()}
              disabled={cart.length === 0 || checkoutMutation.isPending}
            >
              {checkoutMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              إصدار التذاكر
            </Button>
          </div>
        </div>
      </div>

      {/* Issued tickets — auto-open after checkout for immediate printing */}
      <Dialog
        open={!!issuedTickets}
        onOpenChange={(o) => {
          if (!o) {
            document.body.classList.remove("tickets-print-mode");
            setIssuedTickets(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>التذاكر جاهزة للطباعة</DialogTitle>
            <DialogDescription>
              اضغط طباعة لإصدار التذاكر مباشرة للمسافرين.
            </DialogDescription>
          </DialogHeader>
          {issuedTickets && (
            <TicketPrintView
              tickets={issuedTickets}
              onClose={() => setIssuedTickets(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
