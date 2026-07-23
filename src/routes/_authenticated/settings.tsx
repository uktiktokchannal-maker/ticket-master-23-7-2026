import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Save, Loader2, Building, Moon, Sun, Monitor, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgencyId } from "@/hooks/use-agency-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: agencyId } = useAgencyId();
  const { theme, setTheme } = useTheme();

  // Agency State
  const [agencyName, setAgencyName] = useState("");
  const [currency, setCurrency] = useState("ج.س");

  // Profile State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["settings-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل الدخول");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: agencyData, isLoading: agencyLoading } = useQuery({
    queryKey: ["settings-agency", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .eq("id", agencyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId,
  });

  useEffect(() => {
    if (profileData) {
      setFullName(profileData.full_name ?? "");
      setPhone(profileData.phone ?? "");
    }
  }, [profileData]);

  useEffect(() => {
    if (agencyData) {
      setAgencyName(agencyData.name);
      setCurrency(agencyData.currency);
    }
  }, [agencyData]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل الدخول");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ البيانات الشخصية");
      qc.invalidateQueries({ queryKey: ["settings-profile"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAgencyMutation = useMutation({
    mutationFn: async () => {
      if (!agencyName.trim()) throw new Error("اسم الوكالة مطلوب");
      if (!currency.trim()) throw new Error("العملة مطلوبة");

      const { error } = await supabase.rpc("create_agency_for_current_user", {
        _name: agencyName.trim(),
        _currency: currency.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ إعدادات الوكالة");
      qc.invalidateQueries({ queryKey: ["settings-agency"] });
      qc.invalidateQueries({ queryKey: ["agency-id"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!newPassword || newPassword.length < 6) {
        throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("كلمة المرور الجديدة غير متطابقة");
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isLoading = profileLoading || agencyLoading;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">الإعدادات العامة</p>
        <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
          إعدادات الحساب والوكالة
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          إدارة تفاصيل وكالتك وبيانات حسابك وتفضيلات المظهر.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Agency Settings */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Building className="h-5 w-5 text-primary" />
              بيانات الوكالة
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>اسم الوكالة</Label>
                <Input
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="شركة السفريات..."
                />
              </div>
              <div className="space-y-2">
                <Label>العملة</Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="ج.س، ريال، دولار..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => saveAgencyMutation.mutate()}
                disabled={saveAgencyMutation.isPending || !agencyName.trim() || !currency.trim()}
              >
                {saveAgencyMutation.isPending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                حفظ الوكالة
              </Button>
            </div>
          </section>

          {/* Profile Settings */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Settings className="h-5 w-5 text-primary" />
              بيانات الحساب الشخصي
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => saveProfileMutation.mutate()}
                disabled={saveProfileMutation.isPending}
              >
                {saveProfileMutation.isPending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                حفظ الحساب
              </Button>
            </div>
          </section>

          {/* Password Change */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Lock className="h-5 w-5 text-primary" />
              تغيير كلمة المرور
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                />
              </div>
              <div className="space-y-2">
                <Label>تأكيد كلمة المرور</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور"
                />
              </div>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-2 text-xs text-destructive">كلمة المرور غير متطابقة</p>
            )}
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => changePasswordMutation.mutate()}
                disabled={
                  changePasswordMutation.isPending ||
                  !newPassword ||
                  newPassword.length < 6 ||
                  newPassword !== confirmPassword
                }
                variant="outline"
              >
                {changePasswordMutation.isPending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="me-2 h-4 w-4" />
                )}
                تغيير كلمة المرور
              </Button>
            </div>
          </section>

          {/* Appearance Settings */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">المظهر</h2>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition ${
                  theme === "light"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Sun className="h-6 w-6" />
                <span className="text-sm font-semibold">فاتح</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition ${
                  theme === "dark"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Moon className="h-6 w-6" />
                <span className="text-sm font-semibold">داكن</span>
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition ${
                  theme === "system"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Monitor className="h-6 w-6" />
                <span className="text-sm font-semibold">النظام</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
