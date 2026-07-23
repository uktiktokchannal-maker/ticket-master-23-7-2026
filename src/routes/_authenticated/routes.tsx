import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Route as RouteIcon, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/routes")({
  component: RoutesPage,
});

type RouteRow = {
  id: string;
  origin: string;
  destination: string;
  distance_km: number | null;
  default_price: number;
};

function RoutesPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RouteRow | null>(null);

  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("id, origin, destination, distance_km, default_price")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RouteRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (form: Omit<RouteRow, "id"> & { id?: string }) => {
      if (form.id) {
        const { error } = await supabase
          .from("routes")
          .update({
            origin: form.origin,
            destination: form.destination,
            distance_km: form.distance_km,
            default_price: form.default_price,
          })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        if (!agencyId) throw new Error("لم يتم تحديد الوكالة");
        const { error } = await supabase.from("routes").insert({
          agency_id: agencyId,
          origin: form.origin,
          destination: form.destination,
          distance_km: form.distance_km,
          default_price: form.default_price,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("تم الحفظ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRoute = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
      setConfirmDelete(null);
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">العمليات</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            المسارات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            عرّف مسارات السفر بين المدن والسعر الافتراضي للتذكرة.
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
              إضافة مسار
            </Button>
          </DialogTrigger>
          <RouteFormDialog
            key={editing?.id ?? "new"}
            initial={editing}
            onSubmit={(f) => upsert.mutate(f)}
            submitting={upsert.isPending}
          />
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !routes || routes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <RouteIcon className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-foreground">لا توجد مسارات بعد</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              أضف أول مسار (من – إلى) لتتمكن من جدولة رحلة.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">المسار</th>
                <th className="px-4 py-3 text-start">المسافة (كم)</th>
                <th className="px-4 py-3 text-start">السعر الافتراضي</th>
                <th className="px-4 py-3 text-end">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {r.origin} <span className="text-muted-foreground">→</span> {r.destination}
                  </td>
                  <td className="px-4 py-3 tabular text-muted-foreground">
                    {r.distance_km ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular font-bold">
                    {Number(r.default_price).toLocaleString("ar-EG")}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(r);
                          setDialogOpen(true);
                        }}
                        aria-label="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(r)}
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
        )}
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المسار؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف مسار «{confirmDelete?.origin} → {confirmDelete?.destination}» نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && removeRoute.mutate(confirmDelete.id)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RouteFormDialog({
  initial,
  onSubmit,
  submitting,
}: {
  initial: RouteRow | null;
  onSubmit: (f: Omit<RouteRow, "id"> & { id?: string }) => void;
  submitting: boolean;
}) {
  const [origin, setOrigin] = useState(initial?.origin ?? "");
  const [destination, setDestination] = useState(initial?.destination ?? "");
  const [distance, setDistance] = useState<string>(
    initial?.distance_km != null ? String(initial.distance_km) : ""
  );
  const [price, setPrice] = useState<string>(String(initial?.default_price ?? 0));

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "تعديل المسار" : "إضافة مسار"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!origin.trim() || !destination.trim()) {
            return toast.error("المدينتان مطلوبتان");
          }
          onSubmit({
            id: initial?.id,
            origin: origin.trim(),
            destination: destination.trim(),
            distance_km: distance ? Number(distance) : null,
            default_price: Number(price) || 0,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="origin">من *</Label>
            <Input id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination">إلى *</Label>
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="distance">المسافة (كم)</Label>
            <Input
              id="distance"
              type="number"
              min={0}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">السعر الافتراضي</Label>
            <Input
              id="price"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
