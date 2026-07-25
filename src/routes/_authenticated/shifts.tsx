import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Clock,
  DoorOpen,
  DoorClosed,
  Loader2,
  Banknote,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { useActiveBranch } from "@/hooks/use-active-branch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/shifts")({
  component: ShiftsPage,
});

type Shift = {
  id: string;
  agency_id: string;
  cashier_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  expected_cash: number;
  actual_cash: number | null;
  difference: number | null;
  notes: string | null;
  status: string;
};

function ShiftsPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const { activeBranchId } = useActiveBranch();
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [actualCash, setActualCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  // Get current user profile
  const { data: profile } = useQuery({
    queryKey: ["shift-profile", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentUser?.id,
  });

  // Get the current open shift for this cashier
  const { data: activeShift, isLoading: loadingActive } = useQuery({
    queryKey: ["active-shift", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data, error } = await supabase
        .from("cashier_shifts")
        .select("*")
        .eq("cashier_id", currentUser.id)
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return data as Shift | null;
    },
    enabled: !!currentUser?.id,
  });

  // Compute sales during the active shift
  const { data: shiftSales = 0 } = useQuery({
    queryKey: ["shift-sales", activeShift?.id, activeShift?.opened_at],
    queryFn: async () => {
      if (!activeShift || !agencyId) return 0;
      const { data, error } = await supabase
        .from("bookings")
        .select("amount")
        .eq("agency_id", agencyId)
        .eq("status", "confirmed")
        .gte("created_at", activeShift.opened_at);
      if (error) throw error;
      return (data ?? []).reduce((sum, b) => sum + Number(b.amount || 0), 0);
    },
    enabled: !!activeShift && !!agencyId,
    refetchInterval: 15_000, // Auto-refresh every 15s
  });

  const expectedCash = (activeShift?.opening_balance ?? 0) + shiftSales;

  // Get shift history
  const { data: shifts = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["shift-history", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("cashier_shifts")
        .select("*")
        .eq("agency_id", agencyId)
        .order("opened_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Shift[];
    },
    enabled: !!agencyId,
  });

  // Open a new shift
  const openShift = useMutation({
    mutationFn: async () => {
      if (!agencyId || !currentUser?.id) throw new Error("لم يتم تحديد الوكالة أو المستخدم");
      if (!activeBranchId) throw new Error("لم يتم تحديد الفرع");
      const balance = Number(openingBalance) || 0;
      if (balance < 0) throw new Error("المبلغ الافتتاحي لا يمكن أن يكون سالباً");

      const { error } = await supabase.from("cashier_shifts").insert({
        agency_id: agencyId,
        branch_id: activeBranchId,
        cashier_id: currentUser.id,
        opening_balance: balance,
        expected_cash: balance,
        status: "open",
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("لديك وردية مفتوحة بالفعل. أغلقها أولاً قبل فتح وردية جديدة.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم فتح الوردية بنجاح");
      qc.invalidateQueries({ queryKey: ["active-shift"] });
      qc.invalidateQueries({ queryKey: ["shift-history"] });
      setOpenDialogOpen(false);
      setOpeningBalance("0");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Close the active shift
  const closeShift = useMutation({
    mutationFn: async () => {
      if (!activeShift) throw new Error("لا توجد وردية مفتوحة");
      const actual = Number(actualCash);
      if (isNaN(actual) || actual < 0) throw new Error("يرجى إدخال المبلغ الفعلي الصحيح");

      const diff = actual - expectedCash;

      const { error } = await supabase
        .from("cashier_shifts")
        .update({
          closed_at: new Date().toISOString(),
          expected_cash: expectedCash,
          actual_cash: actual,
          difference: diff,
          notes: closeNotes.trim() || null,
          status: "closed",
        })
        .eq("id", activeShift.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إغلاق الوردية بنجاح");
      qc.invalidateQueries({ queryKey: ["active-shift"] });
      qc.invalidateQueries({ queryKey: ["shift-history"] });
      setCloseDialogOpen(false);
      setActualCash("");
      setCloseNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closedShifts = shifts.filter((s) => s.status === "closed");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">الإدارة والمالية</p>
        <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
          ورديات الصندوق
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          فتح وإغلاق ورديات الكاشير ومطابقة المبالغ النقدية مع المبيعات المسجلة.
        </p>
      </div>

      {loadingActive ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : activeShift ? (
        /* ───── Active Shift Card ───── */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border-2 border-success/30 bg-success/5 p-6 shadow-card"
        >
          <div className="brand-pattern absolute inset-0 opacity-5" />
          <div className="relative z-10">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20 text-success">
                <DoorOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-success">وردية مفتوحة حالياً</p>
                <p className="text-sm text-muted-foreground">
                  {profile?.full_name ?? "الكاشير"} — منذ{" "}
                  {new Date(activeShift.opened_at).toLocaleString("ar", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">المبلغ الافتتاحي</p>
                <p className="mt-1 font-display text-xl font-extrabold tabular text-foreground">
                  {Number(activeShift.opening_balance).toLocaleString("ar-EG")}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">مبيعات الوردية</p>
                <p className="mt-1 font-display text-xl font-extrabold tabular text-success">
                  +{shiftSales.toLocaleString("ar-EG")}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-card">
                <p className="text-[10px] font-bold uppercase text-primary">المبلغ المتوقع في الصندوق</p>
                <p className="mt-1 font-display text-xl font-extrabold tabular text-primary">
                  {expectedCash.toLocaleString("ar-EG")}
                </p>
              </div>
            </div>

            <Button
              className="mt-5"
              variant="destructive"
              onClick={() => setCloseDialogOpen(true)}
            >
              <DoorClosed className="me-2 h-4 w-4" />
              إغلاق الوردية
            </Button>
          </div>
        </motion.div>
      ) : (
        /* ───── No Active Shift ───── */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card py-14 text-center shadow-card"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Clock className="h-6 w-6" />
          </div>
          <p className="font-display text-base font-bold text-foreground">لا توجد وردية مفتوحة</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            افتح وردية جديدة لبدء تسجيل المبيعات النقدية وتتبع الصندوق.
          </p>
          <Button className="mt-2" onClick={() => setOpenDialogOpen(true)}>
            <DoorOpen className="me-2 h-4 w-4" />
            فتح وردية جديدة
          </Button>
        </motion.div>
      )}

      {/* ───── Shift History ───── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 font-display text-lg font-bold text-foreground">سجل الورديات المغلقة</h2>
        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : closedShifts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <ArrowUpDown className="h-8 w-8 opacity-20" />
            <p className="text-sm">لا توجد ورديات مغلقة بعد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">تاريخ الفتح</th>
                  <th className="px-4 py-3 text-start">تاريخ الإغلاق</th>
                  <th className="px-4 py-3 text-start">الافتتاحي</th>
                  <th className="px-4 py-3 text-start">المتوقع</th>
                  <th className="px-4 py-3 text-start">الفعلي</th>
                  <th className="px-4 py-3 text-start">الفارق</th>
                  <th className="px-4 py-3 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {closedShifts.map((s) => {
                  const diff = Number(s.difference ?? 0);
                  return (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 tabular text-muted-foreground">
                        {new Date(s.opened_at).toLocaleString("ar", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 tabular text-muted-foreground">
                        {s.closed_at
                          ? new Date(s.closed_at).toLocaleString("ar", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 tabular font-bold text-foreground">
                        {Number(s.opening_balance).toLocaleString("ar-EG")}
                      </td>
                      <td className="px-4 py-3 tabular font-bold text-foreground">
                        {Number(s.expected_cash).toLocaleString("ar-EG")}
                      </td>
                      <td className="px-4 py-3 tabular font-bold text-foreground">
                        {s.actual_cash != null ? Number(s.actual_cash).toLocaleString("ar-EG") : "—"}
                      </td>
                      <td className="px-4 py-3 tabular">
                        {s.difference != null ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              diff === 0
                                ? "bg-success/15 text-success"
                                : diff > 0
                                  ? "bg-primary/10 text-primary"
                                  : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {diff === 0 ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : diff < 0 ? (
                              <XCircle className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {diff > 0 ? "+" : ""}
                            {diff.toLocaleString("ar-EG")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                          مغلقة
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ───── Open Shift Dialog ───── */}
      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>فتح وردية جديدة</DialogTitle>
            <DialogDescription>
              أدخل المبلغ الموجود حالياً في درج الصندوق لبدء الوردية.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              openShift.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="openingBalance">
                <Banknote className="me-1 inline h-4 w-4" />
                المبلغ الافتتاحي في الصندوق
              </Label>
              <Input
                id="openingBalance"
                type="number"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                أدخل المبلغ النقدي الذي تم تسليمه لك في بداية الوردية.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpenDialogOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={openShift.isPending}>
                {openShift.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                فتح الوردية
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ───── Close Shift Dialog ───── */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إغلاق الوردية</DialogTitle>
            <DialogDescription>
              قم بعد النقود في الصندوق وأدخل المبلغ الفعلي لمطابقته مع المبلغ المتوقع.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              closeShift.mutate();
            }}
          >
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المبلغ الافتتاحي</span>
                <span className="tabular font-bold text-foreground">
                  {Number(activeShift?.opening_balance ?? 0).toLocaleString("ar-EG")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">مبيعات الوردية</span>
                <span className="tabular font-bold text-success">
                  +{shiftSales.toLocaleString("ar-EG")}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
                <span className="text-primary">المبلغ المتوقع في الصندوق</span>
                <span className="tabular text-primary">
                  {expectedCash.toLocaleString("ar-EG")}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="actualCash">
                <Banknote className="me-1 inline h-4 w-4" />
                المبلغ الفعلي في الصندوق *
              </Label>
              <Input
                id="actualCash"
                type="number"
                min="0"
                step="0.01"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="أدخل المبلغ الفعلي بعد العد..."
                autoFocus
              />
              {actualCash && (
                <div className="mt-2">
                  {(() => {
                    const diff = Number(actualCash) - expectedCash;
                    if (diff === 0) {
                      return (
                        <p className="flex items-center gap-1 text-sm font-bold text-success">
                          <CheckCircle2 className="h-4 w-4" /> مطابق تماماً ✓
                        </p>
                      );
                    }
                    return (
                      <p
                        className={`flex items-center gap-1 text-sm font-bold ${diff > 0 ? "text-primary" : "text-destructive"}`}
                      >
                        {diff > 0 ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {diff > 0 ? "فائض" : "عجز"}: {Math.abs(diff).toLocaleString("ar-EG")}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="closeNotes">ملاحظات (اختياري)</Label>
              <Textarea
                id="closeNotes"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="أي ملاحظات على وردية اليوم..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setCloseDialogOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="destructive" disabled={closeShift.isPending || !actualCash}>
                {closeShift.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                إغلاق الوردية وحفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
