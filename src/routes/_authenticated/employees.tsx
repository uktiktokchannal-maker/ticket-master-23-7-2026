import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCog, Loader2, ShieldCheck, Mail, Copy, Check, Crown, Briefcase, TicketCheck, Calculator, Eye, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/employees")({
  component: EmployeesPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type UserRole = {
  user_id: string;
  role: string;
};

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; cls: string }> = {
  owner: { label: "مالك", icon: Crown, cls: "bg-warning/20 text-warning-foreground" },
  manager: { label: "مدير", icon: Briefcase, cls: "bg-primary/10 text-primary" },
  cashier: { label: "كاشير", icon: TicketCheck, cls: "bg-success/15 text-success" },
  accountant: { label: "محاسب", icon: Calculator, cls: "bg-accent-soft text-accent-foreground" },
  supervisor: { label: "مشرف", icon: Eye, cls: "bg-muted text-foreground" },
  broker: { label: "سمسار", icon: Shield, cls: "bg-muted text-muted-foreground" },
  inspector: { label: "مفتش", icon: ShieldCheck, cls: "bg-destructive/10 text-destructive" },
};

function EmployeesPage() {
  const { data: agencyId } = useAgencyId();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("agency_id", agencyId);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!agencyId,
  });

  // Fetch roles for all employees in the agency
  const { data: roles } = useQuery({
    queryKey: ["employee-roles", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
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

  // Build signup link with agency context
  const signupUrl = typeof window !== "undefined"
    ? `${window.location.origin}/auth?join=${agencyId ?? ""}`
    : "";

  function handleCopy() {
    navigator.clipboard.writeText(signupUrl).then(() => {
      setCopied(true);
      toast.success("تم نسخ رابط الدعوة");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.20))] flex-col gap-6 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">الإدارة والمالية</p>
          <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            إدارة الموظفين
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            عرض الموظفين المسجلين وصلاحيات وصولهم للنظام.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button variant="default">
              <Mail className="me-2 h-4 w-4" /> دعوة موظف جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>دعوة موظف جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                شارك رابط التسجيل التالي مع الموظف الجديد. عند التسجيل، سيُربط تلقائياً بوكالتك.
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3">
                <code className="flex-1 truncate text-xs text-foreground" dir="ltr">
                  {signupUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="me-1 h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="me-1 h-3.5 w-3.5" />
                  )}
                  {copied ? "تم" : "نسخ"}
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-primary/5 p-3 text-xs text-muted-foreground">
                <p className="font-bold text-foreground mb-1">ملاحظة:</p>
                <p>بعد تسجيل الموظف، يمكنك تعيين دوره (مدير، كاشير، محاسب...) من إعدادات الوكالة.</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-auto rounded-2xl border border-border bg-card p-4 shadow-card">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !employees || employees.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <UserCog className="h-10 w-10 text-muted-foreground opacity-50" />
            <p className="font-bold text-foreground">لا يوجد موظفين</p>
            <p className="text-sm text-muted-foreground">لم يتم إضافة موظفين آخرين لهذه الوكالة.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((emp, index) => {
              const empRoles = roleMap.get(emp.id) ?? [];
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={emp.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm transition hover:border-primary/30 hover:shadow-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserCog className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground truncate">
                        {emp.full_name || "مستخدم جديد"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {emp.phone || "بدون رقم هاتف"}
                      </p>
                    </div>
                  </div>
                  {/* Roles */}
                  <div className="flex flex-wrap gap-1.5">
                    {empRoles.length === 0 ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        بدون دور محدد
                      </span>
                    ) : (
                      empRoles.map((role) => {
                        const config = ROLE_CONFIG[role] ?? {
                          label: role,
                          icon: ShieldCheck,
                          cls: "bg-muted text-muted-foreground",
                        };
                        const RoleIcon = config.icon;
                        return (
                          <span
                            key={role}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${config.cls}`}
                          >
                            <RoleIcon className="h-3 w-3" />
                            {config.label}
                          </span>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
