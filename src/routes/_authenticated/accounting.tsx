import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, Plus, Loader2, Calendar, Receipt, BusFront, Pencil, Trash2, Filter } from "lucide-react";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/accounting")({
  component: AccountingPage,
});

type Expense = {
  id: string;
  category: "fuel" | "maintenance" | "salary" | "office" | "other";
  amount: number;
  description: string;
  date: string;
  bus_id: string | null;
  buses?: { plate_number: string } | null;
};

const categoryMap: Record<string, string> = {
  fuel: "وقود",
  maintenance: "صيانة",
  salary: "رواتب",
  office: "مصروفات مكتبية",
  other: "أخرى",
};

const categoryColors: Record<string, string> = {
  fuel: "bg-primary/10 text-primary",
  maintenance: "bg-warning/20 text-warning-foreground",
  salary: "bg-success/15 text-success",
  office: "bg-accent-soft text-accent-foreground",
  other: "bg-muted text-muted-foreground",
};

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function AccountingPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDate(d);
  });
  const [filterTo, setFilterTo] = useState(() => formatDate(new Date()));

  // Form state
  const [category, setCategory] = useState<Expense["category"]>("fuel");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [busId, setBusId] = useState<string | "none">("none");

  function openNew() {
    setEditing(null);
    setCategory("fuel");
    setAmount("");
    setDesc("");
    setDate(formatDate(new Date()));
    setBusId("none");
    setOpen(true);
  }

  function openEdit(exp: Expense) {
    setEditing(exp);
    setCategory(exp.category);
    setAmount(String(exp.amount));
    setDesc(exp.description);
    setDate(exp.date);
    setBusId(exp.bus_id ?? "none");
    setOpen(true);
  }

  // Fetch revenues (confirmed bookings)
  const { data: revenues = 0, isLoading: loadingRev } = useQuery({
    queryKey: ["accounting-revenues", agencyId],
    queryFn: async () => {
      if (!agencyId) return 0;
      const { data, error } = await supabase
        .from("bookings")
        .select("amount")
        .eq("agency_id", agencyId)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    },
    enabled: !!agencyId,
  });

  // Fetch expenses
  const { data: expenses = [], isLoading: loadingExp } = useQuery({
    queryKey: ["accounting-expenses", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category, amount, description, date, bus_id, buses(plate_number)")
        .eq("agency_id", agencyId)
        .order("date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!agencyId,
  });

  // Fetch buses for expense attribution
  const { data: buses = [] } = useQuery({
    queryKey: ["accounting-buses", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("buses")
        .select("id, plate_number")
        .eq("agency_id", agencyId);
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId,
  });

  // Filtered expenses
  const filtered = expenses.filter((e) => {
    const matchCategory = filterCategory === "all" || e.category === filterCategory;
    const matchFrom = e.date >= filterFrom;
    const matchTo = e.date <= filterTo;
    return matchCategory && matchFrom && matchTo;
  });

  const totalExpenses = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const allTimeExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netIncome = revenues - allTimeExpenses;

  // Expense distribution for mini chart
  const categoryTotals = new Map<string, number>();
  for (const e of filtered) {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + Number(e.amount));
  }

  const saveExpense = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("لا توجد وكالة");
      if (!amount || Number(amount) <= 0) throw new Error("يرجى إدخال مبلغ صحيح");
      if (!desc.trim()) throw new Error("يرجى كتابة البيان");

      if (!activeBranchId) throw new Error("لم يتم تحديد الفرع");
      const payload = {
        agency_id: agencyId,
        branch_id: activeBranchId,
        category,
        amount: Number(amount),
        description: desc.trim(),
        date,
        bus_id: busId !== "none" ? busId : null,
      };

      if (editing) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "تم تعديل المصروف" : "تم إضافة المصروف");
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
    },
  });

  const isLoading = loadingRev || loadingExp;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">الإدارة والمالية</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            المحاسبة والمالية
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تتبع الإيرادات، تسجيل المصروفات، ومعرفة صافي الربح.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="me-2 h-4 w-4" /> إضافة مصروف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل المصروف" : "مصروف جديد"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveExpense.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المبلغ *</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الصرف *</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>البيان / الوصف *</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثال: تعبئة وقود" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>التصنيف</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as Expense["category"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryMap).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ربط بحافلة (اختياري)</Label>
                  <Select value={busId} onValueChange={setBusId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون ارتباط</SelectItem>
                      {buses.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.plate_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => { setOpen(false); setEditing(null); }}>إلغاء</Button>
                <Button type="submit" disabled={saveExpense.isPending}>
                  {saveExpense.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {editing ? "حفظ التعديلات" : "حفظ"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">إجمالي الإيرادات</p>
                  <p className="font-display text-xl font-extrabold tabular text-foreground">
                    {revenues.toLocaleString("ar-EG")} ج.س
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">إجمالي المصروفات</p>
                  <p className="font-display text-xl font-extrabold tabular text-foreground">
                    {allTimeExpenses.toLocaleString("ar-EG")} ج.س
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">صافي الدخل</p>
                  <p className={`font-display text-xl font-extrabold tabular ${netIncome >= 0 ? "text-success" : "text-destructive"}`}>
                    {netIncome.toLocaleString("ar-EG")} ج.س
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Expense Distribution Chart */}
          {categoryTotals.size > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-4 font-display text-base font-bold text-foreground">توزيع المصروفات حسب التصنيف</h2>
              <div className="space-y-3">
                {Array.from(categoryTotals.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, total]) => {
                    const pct = totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0;
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className={`inline-flex w-24 items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${categoryColors[cat] ?? "bg-muted text-muted-foreground"}`}>
                          {categoryMap[cat] ?? cat}
                        </span>
                        <div className="flex-1">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="w-20 text-end text-xs font-bold tabular text-foreground">
                          {total.toLocaleString("ar-EG")}
                        </span>
                        <span className="w-10 text-end text-[11px] tabular text-muted-foreground">{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="space-y-1">
              <Label className="text-[10px]">التصنيف</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {Object.entries(categoryMap).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">من</Label>
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">إلى</Label>
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
            {filtered.length !== expenses.length && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                {filtered.length} من {expenses.length}
              </span>
            )}
          </div>

          {/* Expenses List */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">سجل المصروفات</h2>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
                <Receipt className="h-8 w-8 opacity-20" />
                <p className="text-sm">لا توجد مصروفات مطابقة.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm">
                  <thead className="border-b border-border text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="pb-3 pe-4 text-start font-medium">التاريخ</th>
                      <th className="pb-3 pe-4 text-start font-medium">البيان</th>
                      <th className="pb-3 pe-4 text-start font-medium">التصنيف</th>
                      <th className="pb-3 pe-4 text-start font-medium">ارتباط</th>
                      <th className="pb-3 pe-4 text-end font-medium">المبلغ</th>
                      <th className="pb-3 text-end font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((exp) => (
                      <tr key={exp.id} className="group transition-colors hover:bg-muted/50">
                        <td className="py-3 pe-4 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {exp.date}
                          </div>
                        </td>
                        <td className="py-3 pe-4 font-bold text-foreground">{exp.description}</td>
                        <td className="py-3 pe-4">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryColors[exp.category] ?? "bg-muted text-foreground"}`}>
                            {categoryMap[exp.category]}
                          </span>
                        </td>
                        <td className="py-3 pe-4 text-xs text-muted-foreground">
                          {exp.buses ? (
                            <span className="flex items-center gap-1">
                              <BusFront className="h-3.5 w-3.5" />
                              {exp.buses.plate_number}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 pe-4 text-end font-extrabold tabular text-foreground">
                          {Number(exp.amount).toLocaleString("ar-EG")}
                        </td>
                        <td className="py-3 text-end">
                          <div className="inline-flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openEdit(exp)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                if (window.confirm("حذف المصروف؟")) {
                                  deleteExpense.mutate(exp.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        </>
      )}
    </div>
  );
}
