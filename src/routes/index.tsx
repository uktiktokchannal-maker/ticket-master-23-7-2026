import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, BusFront, ShieldCheck, Ticket } from "lucide-react";
import logo from "@/assets/logo-full.png.asset.json";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="TICKETTY" className="h-10 w-10 rounded-lg object-contain" />
            <div className="leading-tight">
              <p className="font-display text-base font-extrabold text-primary">TICKETTY</p>
              <p className="text-xs text-muted-foreground">ERP لشركات النقل</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              دخول لوحة التحكم
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              نظام SaaS متعدد المستأجرين
            </div>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight text-foreground lg:text-5xl">
              أدر وكالة النقل البري من مكان واحد
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground lg:text-lg">
              محرك حجوزات مركزي، إصدار تذاكر بالـ QR، منفستو رقمي، ورديات محاسبية،
              إدارة السماسرة والتقارير المالية — كل ذلك بالعربية وبواجهة سريعة تناسب
              الكاشير والمحاسب معاً.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-card transition hover:opacity-90"
              >
                ابدأ الآن مجاناً
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center rounded-xl border border-input bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                استعرض الميزات
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-bl from-primary-soft via-transparent to-accent-soft blur-2xl" />
            <div className="rounded-3xl border border-border bg-card p-6 shadow-elevated">
              <img
                src={logo.url}
                alt="شعار TICKETTY"
                className="mx-auto h-64 w-64 object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <h2 className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">
            كل ما تحتاجه وكالتك — في نظام واحد
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            تخلّص من الدفاتر الورقية وجداول Excel والحجوزات المزدوجة عبر WhatsApp.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-card transition hover:shadow-elevated"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted-foreground lg:px-8">
          © {new Date().getFullYear()} TICKETTY ERP · جميع الحقوق محفوظة
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: Ticket,
    title: "محرك تذاكر ذكي",
    desc: "قفل لحظي للمقاعد يمنع الحجوزات المزدوجة، وتذاكر مؤمّنة برموز QR.",
  },
  {
    icon: BusFront,
    title: "إدارة الأسطول والرحلات",
    desc: "أضف الحافلات، جدول الرحلات، وتحكم في مخطط المقاعد لكل نوع حافلة.",
  },
  {
    icon: ShieldCheck,
    title: "ورديات ومحاسبة مؤتمتة",
    desc: "افتح واقفل ورديات الكاشير مع مطابقة النقد وقيود يومية متزنة تلقائياً.",
  },
  {
    icon: BarChart3,
    title: "تقارير لحظية",
    desc: "لوحات KPI للإيرادات، نسبة الإشغال، أداء الكاشير، وأعلى المسارات.",
  },
];
