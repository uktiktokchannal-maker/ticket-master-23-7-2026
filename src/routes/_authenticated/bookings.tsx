import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen, Plus, Pencil, Trash2, Search, Loader2, Printer, ArrowRightLeft, Receipt } from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeletons";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/bookings")({
  component: BookingsPage,
});

type BookingStatus = "confirmed" | "pending" | "cancelled" | "refunded";

type Booking = {
  id: string;
  passenger_name: string;
  passenger_phone: string | null;
  seat_number: number;
  amount: number;
  status: BookingStatus;
  created_at: string;
  trip_id: string;
  route: string | null;
  departure_at: string | null;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "مؤكد",
  pending: "معلق",
  cancelled: "ملغى",
  refunded: "مسترد",
};

const STATUS_TONE: Record<BookingStatus, string> = {
  confirmed: "bg-success/15 text-success",
  pending: "bg-warning/20 text-warning-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
  refunded: "bg-destructive/15 text-destructive",
};

function BookingsPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const [editing, setEditing] = useState<Booking | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Booking | null>(null);
  const [printTicket, setPrintTicket] = useState<Booking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, passenger_name, passenger_phone, seat_number, amount, status, created_at, trip_id, trips(departure_at, routes(origin, destination))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((b) => {
        const trip = b.trips as { departure_at?: string; routes?: { origin: string; destination: string } | { origin: string; destination: string }[] | null } | null;
        const routeObj = trip?.routes;
        const route = Array.isArray(routeObj) ? routeObj[0] : routeObj;
        return {
          id: b.id,
          passenger_name: b.passenger_name,
          passenger_phone: b.passenger_phone,
          seat_number: b.seat_number,
          amount: Number(b.amount ?? 0),
          status: b.status as BookingStatus,
          created_at: b.created_at,
          trip_id: b.trip_id,
          route: route ? `${route.origin} → ${route.destination}` : null,
          departure_at: trip?.departure_at ?? null,
        };
      });
    },
  });

  const { data: trips } = useQuery({
    queryKey: ["trips-for-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("id, departure_at, price, routes(origin, destination), buses(seat_count)")
        .in("status", ["scheduled", "boarding"])
        .order("departure_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t) => {
        const routeObj = Array.isArray(t.routes) ? t.routes[0] : t.routes;
        const busObj = Array.isArray(t.buses) ? t.buses[0] : t.buses;
        return {
          id: t.id as string,
          departure_at: t.departure_at as string,
          price: Number(t.price ?? 0),
          route: routeObj ? `${routeObj.origin} → ${routeObj.destination}` : "بدون خط",
          capacity: Number((busObj as { seat_count?: number } | null)?.seat_count ?? 0),
        };
      });
    },
  });

  const upsertBooking = useMutation({
    mutationFn: async (form: {
      id?: string;
      passenger_name: string;
      passenger_phone: string | null;
      trip_id: string;
      seat_number: number;
      amount: number;
      status: BookingStatus;
    }) => {
      if (form.id) {
        const { error } = await supabase
          .from("bookings")
          .update({
            passenger_name: form.passenger_name,
            passenger_phone: form.passenger_phone,
            trip_id: form.trip_id,
            seat_number: form.seat_number,
            amount: form.amount,
            status: form.status,
          })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        if (!agencyId) throw new Error("لم يتم تحديد الوكالة");
        const { error } = await supabase.from("bookings").insert({
          agency_id: agencyId,
          passenger_name: form.passenger_name,
          passenger_phone: form.passenger_phone,
          trip_id: form.trip_id,
          seat_number: form.seat_number,
          amount: form.amount,
          status: form.status,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("تم الحفظ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirmDelete(null);
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (bookings ?? []).filter((b) => {
    const matchesSearch =
      search.trim() === "" ||
      b.passenger_name.includes(search) ||
      (b.route && b.route.includes(search)) ||
      (b.passenger_phone && b.passenger_phone.includes(search));
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">الحجوزات والرحلات</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            الحجوزات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            قائمة الحجوزات والتذاكر المحجوزة لدى الوكالة.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="me-2 h-4 w-4" />
              حجز جديد
            </Button>
          </DialogTrigger>
          <BookingFormDialog
            key={editing?.id ?? "new"}
            initial={editing}
            trips={trips ?? []}
            onSubmit={(f) => upsertBooking.mutate(f)}
            submitting={upsertBooking.isPending}
          />
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" style={{ insetInlineStart: "0.75rem" }} />
          <Input
            placeholder="ابحث باسم المسافر، المسار، أو الهاتف…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BookingStatus | "all")}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="confirmed">مؤكد</SelectItem>
            <SelectItem value="pending">معلق</SelectItem>
            <SelectItem value="cancelled">ملغى</SelectItem>
            <SelectItem value="refunded">مسترد</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-foreground">لا توجد حجوزات</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              أضف أول حجز أو جرّب تغيير معايير البحث.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">المسافر</th>
                  <th className="px-4 py-3 text-start">المسار</th>
                  <th className="px-4 py-3 text-start">الموعد</th>
                  <th className="px-4 py-3 text-start">المقعد</th>
                  <th className="px-4 py-3 text-start">المبلغ</th>
                  <th className="px-4 py-3 text-start">الحالة</th>
                  <th className="px-4 py-3 text-end">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{b.passenger_name}</p>
                      <p className="text-xs text-muted-foreground">{b.passenger_phone || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground">{b.route ?? "—"}</td>
                    <td className="px-4 py-3 tabular text-muted-foreground">
                      {b.departure_at
                        ? new Date(b.departure_at).toLocaleString("ar", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular text-foreground">{b.seat_number}</td>
                    <td className="px-4 py-3 tabular font-bold text-foreground">
                      {b.amount.toLocaleString("ar-EG")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[b.status] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPrintTicket(b)}
                          aria-label="طباعة التذكرة"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {b.status === "confirmed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRescheduleBooking(b)}
                            aria-label="إعادة جدولة"
                            title="إعادة جدولة / تغيير المقعد"
                          >
                            <ArrowRightLeft className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(b);
                            setDialogOpen(true);
                          }}
                          aria-label="تعديل"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(b)}
                          aria-label="حذف"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحجز؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف حجز «{confirmDelete?.passenger_name}» نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteBooking.mutate(confirmDelete.id)}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!printTicket} onOpenChange={(o) => !o && setPrintTicket(null)}>
        <DialogContent className="max-w-3xl border-0 p-0 shadow-2xl bg-transparent sm:bg-transparent">
          {printTicket && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20, rotateX: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="flex flex-col sm:flex-row overflow-hidden rounded-[2rem] bg-card text-card-foreground shadow-[0_20px_50px_rgba(8,_112,_184,_0.2)]"
            >
              <div className="interactive-glow relative flex-1 p-8 sm:border-e-2 sm:border-dashed border-b-2 border-dashed sm:border-b-0 border-border">
                <div className="brand-pattern absolute inset-0 opacity-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8 border-b border-border/50 pb-4">
                    <h2 className="font-display text-3xl font-extrabold text-primary tracking-widest">TICKETTY</h2>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary uppercase tracking-widest">
                      Boarding Pass
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Passenger</p>
                      <p className="font-display text-xl font-bold mt-1">{printTicket.passenger_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</p>
                      <p className="font-display text-xl font-bold mt-1 tabular">
                        {printTicket.departure_at
                          ? new Date(printTicket.departure_at).toLocaleString("en-US", {
                              month: "short",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Route</p>
                    <p className="font-display text-2xl font-extrabold mt-1 text-foreground">{printTicket.route}</p>
                  </div>

                  <div className="flex gap-12">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Seat</p>
                      <p className="font-display text-4xl font-extrabold text-accent tabular">{printTicket.seat_number}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Class</p>
                      <p className="font-display text-xl font-bold mt-3">Economy</p>
                    </div>
                  </div>
                </div>
                
                <div className="absolute -bottom-4 -end-4 h-8 w-8 rounded-full bg-background sm:hidden"></div>
                <div className="absolute -bottom-4 -start-4 h-8 w-8 rounded-full bg-background sm:hidden"></div>
                <div className="absolute -top-4 -end-4 h-8 w-8 rounded-full bg-background hidden sm:block"></div>
                <div className="absolute -bottom-4 -end-4 h-8 w-8 rounded-full bg-background hidden sm:block"></div>
              </div>

              <div className="relative w-full sm:w-64 bg-primary p-8 text-primary-foreground flex flex-col justify-center items-center text-center">
                <div className="brand-pattern absolute inset-0 opacity-20"></div>
                <div className="relative z-10 w-full">
                  <div className="rounded-xl bg-white p-4 shadow-inner mb-6 inline-block mx-auto">
                    <QRCodeSVG 
                      value={`TICKET:${printTicket.id}`} 
                      size={120} 
                      level="M" 
                      fgColor="#062E5B"
                    />
                  </div>
                  
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Ticket No.</p>
                  <p className="font-mono text-sm opacity-90 truncate">{printTicket.id.split('-')[0].toUpperCase()}</p>
                  
                  <Button 
                    className="mt-6 w-full bg-white text-primary hover:bg-white/90" 
                    onClick={() => window.print()}
                  >
                    <Printer className="mr-2 h-4 w-4" /> طباعة A4
                  </Button>
                  <Button 
                    className="mt-2 w-full bg-white/80 text-primary hover:bg-white/70 border border-white/50" 
                    variant="outline"
                    onClick={() => {
                      document.body.classList.add('thermal-print-mode');
                      setTimeout(() => {
                        window.print();
                        document.body.classList.remove('thermal-print-mode');
                      }, 100);
                    }}
                  >
                    <Receipt className="mr-2 h-4 w-4" /> طباعة حرارية 80mm
                  </Button>
                </div>
                
                <div className="absolute -top-4 -start-4 h-8 w-8 rounded-full bg-background hidden sm:block"></div>
                <div className="absolute -bottom-4 -start-4 h-8 w-8 rounded-full bg-background hidden sm:block"></div>
                <div className="absolute -top-4 -end-4 h-8 w-8 rounded-full bg-background sm:hidden"></div>
                <div className="absolute -top-4 -start-4 h-8 w-8 rounded-full bg-background sm:hidden"></div>
              </div>
            </motion.div>
          )}

          {/* Hidden Thermal Receipt Template — only visible during print when thermal-print-mode is active */}
          {printTicket && (
            <div className="thermal-receipt" style={{ position: 'fixed', top: '-9999px', left: '-9999px' }}>
              <div className="receipt-header">تذكرتي · TICKETTY</div>
              <div className="receipt-divider" />
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'right' }}>المسافر:</td>
                    <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{printTicket.passenger_name}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'right' }}>الهاتف:</td>
                    <td style={{ textAlign: 'left' }}>{printTicket.passenger_phone || '—'}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'right' }}>المسار:</td>
                    <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{printTicket.route || '—'}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'right' }}>الموعد:</td>
                    <td style={{ textAlign: 'left' }}>
                      {printTicket.departure_at
                        ? new Date(printTicket.departure_at).toLocaleString('ar', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="receipt-divider" />
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'right' }}>المقعد:</td>
                    <td style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '14pt' }}>{printTicket.seat_number}</td>
                    <td style={{ textAlign: 'right' }}>المبلغ:</td>
                    <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{printTicket.amount.toLocaleString('ar-EG')}</td>
                  </tr>
                </tbody>
              </table>
              <div className="receipt-divider" />
              <div className="receipt-qr">
                <QRCodeSVG value={`TICKET:${printTicket.id}`} size={80} level="M" />
              </div>
              <div style={{ textAlign: 'center', fontSize: '8pt' }}>
                رقم التذكرة: {printTicket.id.split('-')[0].toUpperCase()}
              </div>
              <div className="receipt-tear">
                شكراً لاختياركم تذكرتي · TICKETTY
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      {rescheduleBooking && (
        <RescheduleDialog
          booking={rescheduleBooking}
          trips={trips ?? []}
          onClose={() => setRescheduleBooking(null)}
          onSuccess={() => {
            setRescheduleBooking(null);
            qc.invalidateQueries({ queryKey: ["bookings"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
            qc.invalidateQueries({ queryKey: ["pos-trips"] });
          }}
        />
      )}
    </div>
  );
}

function BookingFormDialog({
  initial,
  trips,
  onSubmit,
  submitting,
}: {
  initial: Booking | null;
  trips: Array<{ id: string; route: string; departure_at: string; price: number; capacity: number }>;
  onSubmit: (form: {
    id?: string;
    passenger_name: string;
    passenger_phone: string | null;
    trip_id: string;
    seat_number: number;
    amount: number;
    status: BookingStatus;
  }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.passenger_name ?? "");
  const [phone, setPhone] = useState(initial?.passenger_phone ?? "");
  const [tripId, setTripId] = useState(initial?.trip_id ?? "");
  const [seat, setSeat] = useState(initial?.seat_number ?? 1);
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [status, setStatus] = useState<BookingStatus>(initial?.status ?? "confirmed");

  // Auto-fill price when trip is selected
  const selectedTrip = trips.find((t) => t.id === tripId);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "تعديل الحجز" : "حجز جديد"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return toast.error("اسم المسافر مطلوب");
          if (!tripId) return toast.error("اختر الرحلة");
          onSubmit({
            id: initial?.id,
            passenger_name: name.trim(),
            passenger_phone: phone.trim() || null,
            trip_id: tripId,
            seat_number: Number(seat) || 1,
            amount: Number(amount) || 0,
            status,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="name">اسم المسافر *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">الهاتف</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>الرحلة *</Label>
          <Select
            value={tripId}
            onValueChange={(v) => {
              setTripId(v);
              const trip = trips.find((t) => t.id === v);
              if (trip && !initial) setAmount(trip.price);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر الرحلة" />
            </SelectTrigger>
            <SelectContent>
              {trips.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.route} — {new Date(t.departure_at).toLocaleString("ar", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTrip && (
            <p className="text-[11px] text-muted-foreground">
              السعة: {selectedTrip.capacity} مقعد · السعر الافتراضي: {selectedTrip.price.toLocaleString("ar-EG")}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="seat">رقم المقعد</Label>
            <Input
              id="seat"
              type="number"
              min={1}
              value={seat}
              onChange={(e) => setSeat(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ</Label>
            <Input
              id="amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BookingStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">مؤكد</SelectItem>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="cancelled">ملغى</SelectItem>
                <SelectItem value="refunded">مسترد</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {initial ? "حفظ التعديلات" : "إضافة الحجز"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ═══════════════════════════════════════════════════════════
   Reschedule Dialog — Change trip and/or seat for a booking
   ═══════════════════════════════════════════════════════════ */
function RescheduleDialog({
  booking,
  trips,
  onClose,
  onSuccess,
}: {
  booking: Booking;
  trips: Array<{ id: string; route: string; departure_at: string; price: number; capacity: number }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newTripId, setNewTripId] = useState(booking.trip_id);
  const [newSeat, setNewSeat] = useState<number | "">(booking.seat_number);

  const selectedTrip = trips.find((t) => t.id === newTripId);
  const priceDiff = selectedTrip ? selectedTrip.price - booking.amount : 0;

  // Fetch booked seats for the new trip
  const { data: bookedSeats = [] } = useQuery({
    queryKey: ["reschedule-seats", newTripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("seat_number")
        .eq("trip_id", newTripId)
        .eq("status", "confirmed")
        .neq("id", booking.id); // Exclude the current booking
      if (error) throw error;
      return (data ?? []).map((b) => b.seat_number);
    },
    enabled: !!newTripId,
  });

  const availableSeats = selectedTrip
    ? Array.from({ length: selectedTrip.capacity }, (_, i) => i + 1).filter(
        (s) => !bookedSeats.includes(s)
      )
    : [];

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!newTripId) throw new Error("اختر الرحلة الجديدة");
      if (!newSeat) throw new Error("اختر رقم المقعد الجديد");
      if (bookedSeats.includes(Number(newSeat))) {
        throw new Error("هذا المقعد محجوز بالفعل في الرحلة الجديدة");
      }

      const newAmount = selectedTrip?.price ?? booking.amount;

      const { error } = await supabase
        .from("bookings")
        .update({
          trip_id: newTripId,
          seat_number: Number(newSeat),
          amount: newAmount,
        })
        .eq("id", booking.id);

      if (error) {
        if (error.code === "23505") {
          throw new Error("المقعد المحدد تم حجزه للتو. يرجى اختيار مقعد آخر.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم إعادة جدولة التذكرة بنجاح");
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isChanged = newTripId !== booking.trip_id || Number(newSeat) !== booking.seat_number;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <ArrowRightLeft className="me-2 inline h-5 w-5 text-primary" />
            إعادة جدولة تذكرة «{booking.passenger_name}»
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Current booking summary */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">الحجز الحالي</p>
            <p className="text-foreground">
              <strong>{booking.route}</strong> · مقعد {booking.seat_number} ·{" "}
              {booking.amount.toLocaleString("ar-EG")}
            </p>
            {booking.departure_at && (
              <p className="text-xs text-muted-foreground">
                {new Date(booking.departure_at).toLocaleString("ar", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>

          {/* New trip selection */}
          <div className="space-y-2">
            <Label>الرحلة الجديدة</Label>
            <Select
              value={newTripId}
              onValueChange={(v) => {
                setNewTripId(v);
                setNewSeat(""); // Reset seat when trip changes
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الرحلة" />
              </SelectTrigger>
              <SelectContent>
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.route} —{" "}
                    {new Date(t.departure_at).toLocaleString("ar", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {t.price.toLocaleString("ar-EG")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seat selection */}
          <div className="space-y-2">
            <Label>المقعد الجديد</Label>
            {selectedTrip && availableSeats.length > 0 ? (
              <div className="grid grid-cols-8 gap-1.5 rounded-xl border border-border bg-card p-3">
                {Array.from({ length: selectedTrip.capacity }, (_, i) => i + 1).map((s) => {
                  const isBooked = bookedSeats.includes(s);
                  const isSelected = Number(newSeat) === s;
                  const isCurrent = s === booking.seat_number && newTripId === booking.trip_id;
                  return (
                    <button
                      key={s}
                      disabled={isBooked}
                      onClick={() => setNewSeat(s)}
                      className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-md"
                          : isCurrent
                            ? "border-2 border-warning bg-warning/20 text-warning-foreground"
                            : isBooked
                              ? "cursor-not-allowed bg-destructive/10 text-destructive/50"
                              : "border border-border bg-card text-foreground hover:border-primary hover:text-primary"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            ) : selectedTrip && availableSeats.length === 0 ? (
              <p className="text-sm text-destructive">جميع المقاعد محجوزة في هذه الرحلة.</p>
            ) : null}
            {selectedTrip && (
              <p className="text-[11px] text-muted-foreground">
                {availableSeats.length} مقعد متاح من {selectedTrip.capacity}
              </p>
            )}
          </div>

          {/* Price difference */}
          {isChanged && selectedTrip && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">السعر القديم</span>
                <span className="tabular font-bold text-foreground">
                  {booking.amount.toLocaleString("ar-EG")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">السعر الجديد</span>
                <span className="tabular font-bold text-foreground">
                  {selectedTrip.price.toLocaleString("ar-EG")}
                </span>
              </div>
              {priceDiff !== 0 && (
                <div className="mt-1 flex justify-between border-t border-border pt-1">
                  <span className={`font-bold ${priceDiff > 0 ? "text-destructive" : "text-success"}`}>
                    {priceDiff > 0 ? "دفع إضافي مطلوب" : "مبلغ مسترد"}
                  </span>
                  <span
                    className={`tabular font-extrabold ${priceDiff > 0 ? "text-destructive" : "text-success"}`}
                  >
                    {priceDiff > 0 ? "+" : ""}
                    {priceDiff.toLocaleString("ar-EG")}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={() => rescheduleMutation.mutate()}
            disabled={!isChanged || !newSeat || rescheduleMutation.isPending}
          >
            {rescheduleMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            تأكيد إعادة الجدولة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
