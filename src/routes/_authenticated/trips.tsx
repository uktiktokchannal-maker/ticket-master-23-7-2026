import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, Pencil, Trash2, Search, BusFront, MapPin, Loader2, User } from "lucide-react";
import { CardGridSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";
import { dbErrorMessage } from "@/lib/db-errors";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
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

export const Route = createFileRoute("/_authenticated/trips")({
  component: TripsPage,
});

type TripStatus = "scheduled" | "boarding" | "departed" | "completed" | "cancelled";

type Trip = {
  id: string;
  route: string;
  route_id: string;
  bus: string;
  bus_id: string;
  driver_name: string | null;
  driver_id: string | null;
  departure_at: string;
  price: number;
  capacity: number;
  sold: number;
  status: TripStatus;
};

const STATUS_LABEL: Record<TripStatus, string> = {
  scheduled: "مجدولة",
  boarding: "صعود",
  departed: "انطلقت",
  completed: "منتهية",
  cancelled: "ملغاة",
};

const STATUS_TONE: Record<TripStatus, string> = {
  scheduled: "bg-primary/10 text-primary",
  boarding: "bg-accent-soft text-accent-foreground",
  departed: "bg-warning/20 text-warning-foreground",
  completed: "bg-success/15 text-success",
  cancelled: "bg-muted text-muted-foreground line-through",
};

function TripsPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const [editing, setEditing] = useState<Trip | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Trip | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatus | "all">("all");

  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("id, departure_at, price, status, route_id, bus_id, driver_id, routes(origin, destination), buses(plate_number, seat_count), bookings(id, status), drivers(name)")
        .limit(100)
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t) => {
        const routeObj = Array.isArray(t.routes) ? t.routes[0] : t.routes;
        const busObj = Array.isArray(t.buses) ? t.buses[0] : t.buses;
        const driverObj = Array.isArray(t.drivers) ? t.drivers[0] : t.drivers;
        const bks = (t.bookings ?? []) as Array<{ status: string }>;
        return {
          id: t.id as string,
          route: routeObj ? `${routeObj.origin} → ${routeObj.destination}` : "بدون خط",
          route_id: t.route_id as string,
          bus: (busObj as { plate_number?: string } | null)?.plate_number ?? "—",
          bus_id: t.bus_id as string,
          driver_name: (driverObj as { name?: string } | null)?.name ?? null,
          driver_id: (t as { driver_id?: string | null }).driver_id ?? null,
          departure_at: t.departure_at as string,
          price: Number(t.price ?? 0),
          capacity: Number((busObj as { seat_count?: number } | null)?.seat_count ?? 0),
          sold: bks.filter((x) => x.status === "confirmed").length,
          status: t.status as TripStatus,
        };
      });
    },
  });

  // Fetch routes and buses for the form
  const { data: routesList } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("id, origin, destination, default_price")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: busesList } = useQuery({
    queryKey: ["buses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buses")
        .select("id, plate_number, seat_count, status")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: driversList } = useQuery({
    queryKey: ["drivers-for-trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name, status")
        .in("status", ["active", "on_trip"])
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsertTrip = useMutation({
    mutationFn: async (form: {
      id?: string;
      route_id: string;
      bus_id: string;
      driver_id: string | null;
      departure_at: string;
      price: number;
      status: TripStatus;
    }) => {
      if (form.id) {
        const { error } = await supabase
          .from("trips")
          .update({
            route_id: form.route_id,
            bus_id: form.bus_id,
            driver_id: form.driver_id,
            departure_at: form.departure_at,
            price: form.price,
            status: form.status,
          })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        if (!agencyId) throw new Error("لم يتم تحديد الوكالة");
        const { error } = await supabase.from("trips").insert({
          agency_id: agencyId,
          route_id: form.route_id,
          bus_id: form.bus_id,
          driver_id: form.driver_id,
          departure_at: form.departure_at,
          price: form.price,
          status: form.status,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("تم الحفظ");
    },
    onError: (e: Error) => toast.error(dbErrorMessage(e)),
  });

  const deleteTrip = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirmDelete(null);
      toast.success("تم الحذف");
    },
    onError: (e: Error) => {
      if (e.message.includes("violates foreign key constraint")) {
        toast.error("لا يمكن إتمام العملية لارتباط هذا العنصر ببيانات أخرى (حجوزات أو تذاكر)");
      } else {
        toast.error(dbErrorMessage(e));
      }
    },
  });

  const filtered = (trips ?? []).filter((t) => {
    const matchesSearch =
      search.trim() === "" ||
      t.route.includes(search) ||
      t.bus.includes(search);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">الحجوزات والرحلات</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            الرحلات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            جدولة الرحلات، متابعة نسب البيع، والحافلات المخصصة.
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
              رحلة جديدة
            </Button>
          </DialogTrigger>
          <TripFormDialog
            key={editing?.id ?? "new"}
            initial={editing}
            routes={routesList ?? []}
            buses={busesList ?? []}
            drivers={driversList ?? []}
            existingTrips={trips ?? []}
            onSubmit={(f) => upsertTrip.mutate(f)}
            submitting={upsertTrip.isPending}
          />

        </Dialog>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" style={{ insetInlineStart: "0.75rem" }} />
          <Input
            placeholder="ابحث بمسار أو حافلة…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TripStatus | "all")}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="scheduled">مجدولة</SelectItem>
            <SelectItem value="boarding">صعود</SelectItem>
            <SelectItem value="departed">انطلقت</SelectItem>
            <SelectItem value="completed">منتهية</SelectItem>
            <SelectItem value="cancelled">ملغاة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} cols={3} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center shadow-card">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <CalendarClock className="h-5 w-5" />
          </div>
          <p className="mt-2 text-sm font-bold text-foreground">لا توجد رحلات</p>
          <p className="mt-1 text-xs text-muted-foreground">أضف رحلة جديدة لتظهر هنا.</p>
        </div>
      ) : (
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1 }
          }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((t) => {
            const pct = t.capacity > 0 ? Math.round((t.sold / t.capacity) * 100) : 0;
            const [origin, dest] = t.route.split(" → ");

            return (
              <article
                key={t.id}
                className="group glass-card interactive-glow relative flex flex-col justify-between overflow-hidden ticket-shape p-5 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
              >
                <div className="brand-pattern absolute inset-0 z-0 opacity-10"></div>
                <div className="relative z-10">
                  <div className="mb-4 flex items-start justify-between">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[t.status]}`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span className="font-display text-sm font-extrabold text-primary tabular">
                      {t.price.toLocaleString("ar-EG")} ج.س
                    </span>
                  </div>

                  {/* Timeline View */}
                  <div className="relative ms-2 border-s-2 border-dashed border-border py-2 ps-6 overflow-hidden">
                    {/* Animated line drawing effect */}
                    <div 
                      className="absolute -start-[2px] top-0 w-[2px] h-full bg-primary/40"
                    ></div>
                    
                    <div className="absolute -start-1.5 top-0 h-3 w-3 rounded-full bg-primary ring-4 ring-card z-10 transition-transform group-hover:scale-125"></div>
                    <div className="mb-6">
                      <p className="font-display text-base font-extrabold text-foreground">{origin || "محطة الانطلاق"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(t.departure_at).toLocaleString("ar", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="absolute -start-1.5 bottom-0 h-3 w-3 rounded-full bg-accent ring-4 ring-card z-10 transition-transform group-hover:scale-125 group-hover:bg-primary"></div>
                    <div>
                      <p className="font-display text-base font-extrabold text-foreground">{dest || "الوجهة"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">موعد الوصول التقريبي</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <BusFront className="h-4 w-4" strokeWidth={1.8} /> {t.bus}
                    </span>
                    {t.driver_name && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 transition-colors group-hover:bg-accent/10 group-hover:text-accent">
                        <User className="h-4 w-4" strokeWidth={1.8} /> {t.driver_name}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>
                        المقاعد المباعة: <span className="tabular font-bold text-foreground">{t.sold}/{t.capacity}</span>
                      </span>
                      <span className="tabular font-bold text-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-1000 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-5 flex justify-end gap-1 border-t border-border/50 pt-3 opacity-80 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(t);
                      setDialogOpen(true);
                    }}
                    aria-label="تعديل"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (t.sold > 0) {
                        toast.error("لا يمكن حذف رحلة تحتوي على مقاعد مباعة. قم بإلغاء التذاكر أولاً.");
                        return;
                      }
                      setConfirmDelete(t);
                    }}
                    aria-label="حذف"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </article>
            );
          })}
        </motion.div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الرحلة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف رحلة «{confirmDelete?.route}» نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteTrip.mutate(confirmDelete.id)}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TripFormDialog({
  initial,
  routes,
  buses,
  drivers,
  onSubmit,
  submitting,
}: {
  initial: Trip | null;
  routes: Array<{ id: string; origin: string; destination: string; default_price: number }>;
  buses: Array<{ id: string; plate_number: string; seat_count: number }>;
  drivers: Array<{ id: string; name: string; status: string }>;
  onSubmit: (form: {
    id?: string;
    route_id: string;
    bus_id: string;
    driver_id: string | null;
    departure_at: string;
    price: number;
    status: TripStatus;
  }) => void;
  submitting: boolean;
}) {
  const [routeId, setRouteId] = useState(initial?.route_id ?? "");
  const [busId, setBusId] = useState(initial?.bus_id ?? "");
  const [driverId, setDriverId] = useState(initial?.driver_id ?? "none");
  const [departure, setDeparture] = useState(
    initial ? new Date(initial.departure_at).toISOString().slice(0, 16) : ""
  );
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [status, setStatus] = useState<TripStatus>(initial?.status ?? "scheduled");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "تعديل الرحلة" : "رحلة جديدة"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!routeId) return toast.error("اختر المسار");
          if (!busId) return toast.error("اختر الحافلة");
          if (!departure) return toast.error("حدد موعد الانطلاق");
          onSubmit({
            id: initial?.id,
            route_id: routeId,
            bus_id: busId,
            driver_id: driverId !== "none" ? driverId : null,
            departure_at: new Date(departure).toISOString(),
            price: Number(price) || 0,
            status,
          });
        }}
      >
        <div className="space-y-2">
          <Label>المسار *</Label>
          <Select
            value={routeId}
            onValueChange={(v) => {
              setRouteId(v);
              const r = routes.find((x) => x.id === v);
              if (r && !initial) setPrice(Number(r.default_price));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر المسار" />
            </SelectTrigger>
            <SelectContent>
              {routes.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.origin} → {r.destination}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>الحافلة *</Label>
            <Select value={busId} onValueChange={setBusId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحافلة" />
              </SelectTrigger>
              <SelectContent>
                {buses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.plate_number} ({b.seat_count} مقعد)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dep">موعد الانطلاق *</Label>
            <Input id="dep" type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="price">السعر</Label>
            <Input id="price" type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>السائق</Label>
            <Select value={driverId ?? "none"} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر السائق" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون سائق</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TripStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">مجدولة</SelectItem>
                <SelectItem value="boarding">صعود</SelectItem>
                <SelectItem value="departed">انطلقت</SelectItem>
                <SelectItem value="completed">منتهية</SelectItem>
                <SelectItem value="cancelled">ملغاة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {initial ? "حفظ التعديلات" : "إضافة الرحلة"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}