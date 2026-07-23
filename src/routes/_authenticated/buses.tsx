import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BusFront, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/buses")({
  component: BusesPage,
});

type BusStatus = "active" | "maintenance" | "inactive";
type Bus = {
  id: string;
  plate_number: string;
  model: string | null;
  seat_count: number;
  status: BusStatus;
};

const STATUS_LABEL: Record<BusStatus, string> = {
  active: "جاهزة",
  maintenance: "في الصيانة",
  inactive: "متوقفة",
};
const STATUS_TONE: Record<BusStatus, string> = {
  active: "bg-success/15 text-success",
  maintenance: "bg-warning/20 text-warning-foreground",
  inactive: "bg-muted text-muted-foreground",
};

function BusesPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const [editing, setEditing] = useState<Bus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Bus | null>(null);

  const { data: buses, isLoading } = useQuery({
    queryKey: ["buses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buses")
        .select("id, plate_number, model, seat_count, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Bus[];
    },
  });

  const upsertBus = useMutation({
    mutationFn: async (form: Omit<Bus, "id"> & { id?: string }) => {
      if (form.id) {
        const { error } = await supabase
          .from("buses")
          .update({
            plate_number: form.plate_number,
            model: form.model,
            seat_count: form.seat_count,
            status: form.status,
          })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        if (!agencyId) throw new Error("لم يتم تحديد الوكالة");
        const { error } = await supabase.from("buses").insert({
          agency_id: agencyId,
          plate_number: form.plate_number,
          model: form.model,
          seat_count: form.seat_count,
          status: form.status,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("تم الحفظ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBus = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("buses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirmDelete(null);
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">الأسطول</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            الحافلات
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف حافلات وكالتك مع رقم اللوحة وعدد المقاعد والحالة.
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
              إضافة حافلة
            </Button>
          </DialogTrigger>
          <BusFormDialog
            key={editing?.id ?? "new"}
            initial={editing}
            onSubmit={(f) => upsertBus.mutate(f)}
            submitting={upsertBus.isPending}
          />
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !buses || buses.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BusFront className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-foreground">لا توجد حافلات بعد</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              ابدأ بإضافة أول حافلة لتتمكن من جدولة الرحلات.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">رقم اللوحة</th>
                <th className="px-4 py-3 text-start">الموديل</th>
                <th className="px-4 py-3 text-start">المقاعد</th>
                <th className="px-4 py-3 text-start">الحالة</th>
                <th className="px-4 py-3 text-end">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((b) => (
                <tr key={b.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-foreground">{b.plate_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.model || "—"}</td>
                  <td className="px-4 py-3 tabular">{b.seat_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[b.status]}`}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="inline-flex gap-1">
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
        )}
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحافلة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الحافلة «{confirmDelete?.plate_number}» نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteBus.mutate(confirmDelete.id)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BusFormDialog({
  initial,
  onSubmit,
  submitting,
}: {
  initial: Bus | null;
  onSubmit: (f: Omit<Bus, "id"> & { id?: string }) => void;
  submitting: boolean;
}) {
  const [plate, setPlate] = useState(initial?.plate_number ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [seats, setSeats] = useState(initial?.seat_count ?? 45);
  const [status, setStatus] = useState<BusStatus>(initial?.status ?? "active");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "تعديل الحافلة" : "إضافة حافلة"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!plate.trim()) return toast.error("رقم اللوحة مطلوب");
          onSubmit({
            id: initial?.id,
            plate_number: plate.trim(),
            model: model.trim() || null,
            seat_count: Number(seats) || 0,
            status,
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="plate">رقم اللوحة *</Label>
          <Input id="plate" value={plate} onChange={(e) => setPlate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">الموديل</Label>
          <Input id="model" value={model ?? ""} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="seats">عدد المقاعد</Label>
            <Input
              id="seats"
              type="number"
              min={1}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BusStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">جاهزة</SelectItem>
                <SelectItem value="maintenance">في الصيانة</SelectItem>
                <SelectItem value="inactive">متوقفة</SelectItem>
              </SelectContent>
            </Select>
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
