import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-full.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — TICKETTY ERP" },
      { name: "description", content: "سجل الدخول أو أنشئ حساباً جديداً لوكالتك على منصة TICKETTY ERP." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setCheckingSession(false);
    });
  }, [navigate]);

  function resolveEmail(input: string): string {
    const v = input.trim();
    if (v.includes("@")) return v;
    return `${v.toLowerCase()}@users.ticketty.local`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: identifier.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, agency_name: agencyName },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء حسابك بنجاح");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: resolveEmail(identifier),
          password,
        });
        if (error) throw error;
        toast.success("مرحباً بعودتك");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "حدث خطأ ما";
      toast.error(
        message.includes("Invalid login") ? "بيانات الدخول غير صحيحة" :
        message.includes("already registered") ? "هذا البريد مسجل مسبقاً" :
        message
      );
    } finally {
      setLoading(false);
    }
  }


  if (checkingSession) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-10 lg:text-primary-foreground">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt="TICKETTY" className="h-12 w-12 rounded-xl bg-card object-contain p-1" />
          <div>
            <p className="font-display text-lg font-extrabold">TICKETTY</p>
            <p className="text-xs opacity-80">ERP لشركات النقل البري</p>
          </div>
        </div>
        <div className="relative">
          <h2 className="font-display text-3xl font-extrabold leading-tight">
            أدر وكالتك بذكاء
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed opacity-90">
            من إصدار التذكرة إلى المنفستو الرقمي، من ورديات الكاشير إلى قيود المحاسبة
            المتزنة — كل شيء في مكان واحد وبالعربية.
          </p>
        </div>
        <p className="text-xs opacity-70">© {new Date().getFullYear()} TICKETTY</p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src={logo.url} alt="TICKETTY" className="h-10 w-10 rounded-lg object-contain" />
            <div>
              <p className="font-display text-base font-extrabold text-primary">TICKETTY</p>
              <p className="text-xs text-muted-foreground">ERP لشركات النقل</p>
            </div>
          </div>

          <div className="mb-6 inline-flex rounded-xl border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                mode === "signin" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                mode === "signup" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
              }`}
            >
              إنشاء حساب
            </button>
          </div>

          <h1 className="font-display text-2xl font-extrabold text-foreground">
            {mode === "signin" ? "مرحباً بعودتك" : "أنشئ حساب وكالتك"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "أدخل بياناتك للوصول إلى لوحة التحكم."
              : "ابدأ في دقائق — سنجهّز وكالتك تلقائياً."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <Field label="الاسم الكامل" htmlFor="fullName">
                  <input
                    id="fullName"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    className={inputClass}
                  />
                </Field>
                <Field label="اسم الوكالة" htmlFor="agencyName">
                  <input
                    id="agencyName"
                    required
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="مثال: وكالة الأمل للنقل"
                    className={inputClass}
                  />
                </Field>
              </>
            )}

            <Field
              label={mode === "signup" ? "البريد الإلكتروني" : "البريد الإلكتروني أو اسم المستخدم"}
              htmlFor="identifier"
            >
              <input
                id="identifier"
                type={mode === "signup" ? "email" : "text"}
                required
                dir="ltr"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === "signup" ? "you@agency.com" : "username أو you@agency.com"}
                className={`${inputClass} text-start`}
              />
            </Field>


            <Field label="كلمة المرور" htmlFor="password">
              <input
                id="password"
                type="password"
                required
                minLength={6}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputClass} text-start`}
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-card transition hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "دخول" : "إنشاء الحساب"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← العودة للصفحة الرئيسية</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

const inputClass =
  "block w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
