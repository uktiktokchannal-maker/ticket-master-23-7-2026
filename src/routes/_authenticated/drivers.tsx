import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Plus, Search, Loader2, Edit, Trash2, Smartphone, IdCard } from "lucide-react";
import { toast } from "sonner";
import { dbErrorMessage } from "@/lib/db-errors";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
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
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/drivers")({
  component: DriversPage,
});

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  license_number: string | null;
  status: "active" | "inactive" | "on_trip";
};

function DriversPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [license, setLicense] = useState("");
  const [status, setStatus] = useState<Driver["status"]>("active");

  const { data: drivers, isLoading } = useQuery({
    queryKey: ["drivers", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("agency_id", agencyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Driver[];
    },
    enabled: !!agencyId,
  });

  const filtered = useMemo(() => {
    return (drivers ?? []).filter(
      (d) =>
        search.trim() === "" ||
        d.name.includes(search) ||
        (d.phone && d.phone.includes(search)) ||
        (d.license_number && d.license_number.includes(search))
    );
  }, [drivers, search]);

  function openEdit(d: Driver) {
    setEditing(d);
    setName(d.name);
    setPhone(d.phone ?? "");
    setLicense(d.license_number ?? "");
    setStatus(d.status);
    setOpen(true);
  }

  function openNew() {
    setEditing(null);
    setName("");
    setPhone("");
    setLicense("");
    setStatus("active");
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("لم يتم العثور على الوكالة");
      if (!name.trim()) throw new Error("اسم السائق مطلوب");

      const payload = {
        agency_id: agencyId,
        name: name.trim(),
        phone: phone.trim() || null,
        license_number: license.trim() || null,
        status,
      };

      if (editing) {
        const { error } = await supabase.from("drivers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("drivers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم تعديل السائق" : "تمت إضافة السائق");
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(dbErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف السائق");
      qc.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (e: Error) => toast.error(dbErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">فريق العمل</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            إدارة السائقين
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إضافة سائقين جدد، ومتابعة رخص القيادة وحالتهم.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="me-2 h-4 w-4" /> إضافة سائق
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل سائق" : "سائق جديد"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: محمد أحمد" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
                </div>
                <div className="space-y-2">
                  <Label>رقم الرخصة</Label>
                  <Input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="xxxxxxx" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Driver["status"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">متاح (نشط)</SelectItem>
                    <SelectItem value="on_trip">في رحلة</SelectItem>
                    <SelectItem value="inactive">غير متاح</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()}>
                {saveMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-6 max-w-sm relative">
          <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" style={{ insetInlineStart: "0.75rem" }} />
          <Input
            placeholder="ابحث عن سائق…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <User className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-foreground">لا يوجد سائقين</p>
            <p className="max-w-xs text-xs text-muted-foreground">لم يتم العثور على سائقين مسجلين يطابقون بحثك.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <div key={d.id} className="group relative rounded-2xl border border-border bg-background p-4 transition hover:border-primary/40 hover:shadow-card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{d.name}</h3>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          d.status === "active" ? "bg-success/15 text-success" :
                          d.status === "on_trip" ? "bg-warning/20 text-warning-foreground" :
                          "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {d.status === "active" ? "متاح" : d.status === "on_trip" ? "في رحلة" : "غير متاح"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(d)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (window.confirm("هل أنت متأكد من حذف هذا السائق؟")) {
                          deleteMutation.mutate(d.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5" />
                    <span className="tabular">{d.phone || "لا يوجد رقم"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <IdCard className="h-3.5 w-3.5" />
                    <span className="tabular">{d.license_number || "لا توجد رخصة"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
