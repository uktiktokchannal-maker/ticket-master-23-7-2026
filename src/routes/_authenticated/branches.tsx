import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil, Trash2, Loader2, Save, Star, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { useBranches, useActiveBranch, type Branch } from "@/hooks/use-active-branch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

export const Route = createFileRoute("/_authenticated/branches")({
  component: BranchesPage,
});

function BranchesPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const { data: branches = [], isLoading } = useBranches();
  const { isOwner } = useActiveBranch();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Branch | null>(null);

  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isMain, setIsMain] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setState(editing.state ?? "");
      setAddress(editing.address ?? "");
      setPhone(editing.phone ?? "");
      setIsMain(editing.is_main);
    } else {
      setName("");
      setState("");
      setAddress("");
      setPhone("");
      setIsMain(false);
    }
  }, [editing, dialogOpen]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("لم يتم تحديد الوكالة");
      if (!name.trim()) throw new Error("اسم الفرع مطلوب");

      // If setting a new main, unset the previous main first
      if (isMain) {
        await supabase
          .from("branches")
          .update({ is_main: false })
          .eq("agency_id", agencyId)
          .neq("id", editing?.id ?? "00000000-0000-0000-0000-000000000000");
      }

      const payload = {
        name: name.trim(),
        state: state.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        is_main: isMain,
      };

      if (editing) {
        const { error } = await supabase
          .from("branches")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branches").insert({
          ...payload,
          agency_id: agencyId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم تعديل الفرع" : "تم إضافة الفرع");
      qc.invalidateQueries({ queryKey: ["branches"] });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الفرع");
      qc.invalidateQueries({ queryKey: ["branches"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => {
      toast.error(
        e.message.includes("foreign key")
          ? "لا يمكن حذف الفرع لوجود بيانات مرتبطة به (حجوزات/ورديات/مصروفات)"
          : e.message,
      );
    },
  });

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-lg font-bold text-foreground">صلاحيات محدودة</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          إدارة الفروع متاحة لمالك الوكالة فقط.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">إدارة النظام</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            الفروع
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف فروع شركتك في الولايات المختلفة وأدر بياناتها.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="me-2 h-4 w-4" />
              فرع جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل الفرع" : "إضافة فرع جديد"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>اسم الفرع *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="فرع الخرطوم" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>الولاية</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="الخرطوم" />
                </div>
                <div className="space-y-2">
                  <Label>الهاتف</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>العنوان</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="شارع الجمهورية..." />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isMain}
                  onChange={(e) => setIsMain(e.target.checked)}
                  className="h-4 w-4"
                />
                تعيين كفرع رئيسي
              </label>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setDialogOpen(false); setEditing(null); }}
              >
                إلغاء
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !name.trim()}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">لا توجد فروع بعد</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h3 className="truncate font-display text-base font-bold text-foreground">
                      {b.name}
                    </h3>
                    {b.is_main && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        <Star className="h-3 w-3" />
                        رئيسي
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {b.state && <p>الولاية: {b.state}</p>}
                    {b.address && <p className="truncate">العنوان: {b.address}</p>}
                    {b.phone && <p>الهاتف: {b.phone}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => { setEditing(b); setDialogOpen(true); }}
                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label="تعديل"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(b)}
                    className="rounded-lg border border-border p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="حذف"
                    disabled={b.is_main}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الفرع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف فرع «{confirmDelete?.name}»؟ لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
