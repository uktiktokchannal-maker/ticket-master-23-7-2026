import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  UserCog,
  Loader2,
  ShieldCheck,
  UserPlus,
  Crown,
  Briefcase,
  TicketCheck,
  Calculator,
  Eye,
  Shield,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { useBranches } from "@/hooks/use-active-branch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { createEmployee, type AppRole } from "@/lib/employees.functions";

export const Route = createFileRoute("/_authenticated/employees")({
  component: EmployeesPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  username: string | null;
  branch_id: string | null;
};

type UserRole = { user_id: string; role: string; branch_id: string | null };

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; cls: string }> = {
  owner: { label: "مالك", icon: Crown, cls: "bg-warning/20 text-warning-foreground" },
  manager: { label: "مدير", icon: Briefcase, cls: "bg-primary/10 text-primary" },
  cashier: { label: "كاشير", icon: TicketCheck, cls: "bg-success/15 text-success" },
  accountant: { label: "محاسب", icon: Calculator, cls: "bg-accent-soft text-accent-foreground" },
  supervisor: { label: "مشرف", icon: Eye, cls: "bg-muted text-foreground" },
  broker: { label: "سمسار", icon: Shield, cls: "bg-muted text-muted-foreground" },
  inspector: { label: "مفتش", icon: ShieldCheck, cls: "bg-destructive/10 text-destructive" },
};

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "manager", label: "مدير فرع" },
  { value: "cashier", label: "كاشير" },
  { value: "accountant", label: "محاسب" },
  { value: "supervisor", label: "مشرف" },
  { value: "broker", label: "سمسار" },
  { value: "inspector", label: "مفتش" },
];

function EmployeesPage() {
  const { data: agencyId } = useAgencyId();
  const { data: branches = [] } = useBranches();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, username, branch_id")
        .eq("agency_id", agencyId);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!agencyId,
  });

  const { data: roles } = useQuery({
    queryKey: ["employee-roles", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, branch_id")
        .eq("agency_id", agencyId);
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: !!agencyId,
  });

  const roleMap = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const arr = roleMap.get(r.user_id) ?? [];
    arr.push(r.role);
    roleMap.set(r.user_id, arr);
  }
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [role, setRole] = useState<AppRole>("cashier");

  const createFn = useServerFn(createEmployee);
  const addMutation = useMutation({
    mutationFn: async () => {
      return await createFn({
        data: { username, password, full_name: fullName, phone: phone || null, branch_id: branchId, role },
      });
    },
    onSuccess: () => {
      toast.success("تمت إضافة الموظف بنجاح");
      queryClient.invalidateQueries({ queryKey: ["employees", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["employee-roles", agencyId] });
      setUsername(""); setPassword(""); setFullName(""); setPhone(""); setBranchId(""); setRole("cashier");
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message ?? "تعذّر إضافة الموظف"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branchId) { toast.error("اختر الفرع"); return; }
    addMutation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">الإدارة والمالية</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">إدارة الموظفين</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف موظفاً مباشرة باسم مستخدم وكلمة مرور، وحدد الفرع والصلاحية.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="default">
              <UserPlus className="me-2 h-4 w-4" /> إضافة موظف جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>إضافة موظف جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-3 py-2">
              <Field label="الاسم الكامل">
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="مثال: خالد محمد" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="اسم المستخدم (للدخول)">
                  <input
                    required
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    className={`${inputCls} text-start`}
                    placeholder="khaled01"
                    pattern="[a-z0-9._-]{3,32}"
                    title="أحرف إنجليزية/أرقام/._- بطول 3-32"
                  />
                </Field>
                <Field label="كلمة المرور">
                  <input
                    required
                    type="text"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputCls} text-start`}
                    placeholder="••••••"
                    minLength={6}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="الفرع">
                  <select
                    required
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— اختر —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}{b.is_main ? " (رئيسي)" : ""}</option>
                    ))}
                  </select>
                </Field>
                <Field label="الصلاحية">
                  <select
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value as AppRole)}
                    className={inputCls}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="رقم الهاتف (اختياري)">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} dir="ltr" placeholder="+249…" />
              </Field>
              <DialogFooter className="mt-2">
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  إضافة الموظف
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !employees || employees.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <UserCog className="h-10 w-10 text-muted-foreground opacity-50" />
            <p className="font-bold text-foreground">لا يوجد موظفين</p>
            <p className="text-sm text-muted-foreground">اضغط «إضافة موظف جديد» لبدء إضافة موظفي وكالتك.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((emp) => {
              const empRoles = roleMap.get(emp.id) ?? [];
              const branchName = emp.branch_id ? branchMap.get(emp.branch_id) : null;
              return (
                <div
                  key={emp.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm transition hover:border-primary/30 hover:shadow-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserCog className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground truncate">{emp.full_name || "مستخدم"}</h3>
                      <p className="text-xs text-muted-foreground truncate" dir="ltr">
                        {emp.username ? `@${emp.username}` : emp.phone || "—"}
                      </p>
                    </div>
                  </div>

                  {branchName && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span>{branchName}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {empRoles.length === 0 ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">بدون دور</span>
                    ) : (
                      empRoles.map((r) => {
                        const config = ROLE_CONFIG[r] ?? { label: r, icon: ShieldCheck, cls: "bg-muted text-muted-foreground" };
                        const RoleIcon = config.icon;
                        return (
                          <span key={r} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${config.cls}`}>
                            <RoleIcon className="h-3 w-3" />
                            {config.label}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
