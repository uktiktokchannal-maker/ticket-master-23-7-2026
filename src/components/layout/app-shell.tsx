import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  LayoutDashboard,
  Ticket,
  CalendarClock,
  BookOpen,
  Users,
  BusFront,
  Route as RouteIcon,
  UserCog,
  Wallet,
  BarChart3,
  Bell,
  Settings,
  ScrollText,
  LogOut,
  Menu,
  X,
  Search,
  Clock,
  Building2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import logo from "@/assets/logo-full.png.asset.json";

type NavGroup = {
  label: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard; disabled?: boolean }[];
};

const NAV: NavGroup[] = [
  {
    label: "الرئيسية",
    items: [{ to: "/dashboard", label: "نظرة عامة", icon: LayoutDashboard }],
  },
  {
    label: "الحجوزات والرحلات",
    items: [
      { to: "/pos", label: "نقطة البيع", icon: Ticket },
      { to: "/bookings", label: "الحجوزات", icon: BookOpen },
      { to: "/trips", label: "الرحلات", icon: CalendarClock },
      { to: "/manifest", label: "المنفستو", icon: ScrollText },
    ],
  },
  {
    label: "الأسطول والعمليات",
    items: [
      { to: "/buses", label: "الحافلات", icon: BusFront },
      { to: "/routes", label: "المسارات", icon: RouteIcon },
      { to: "/drivers", label: "السائقون", icon: Users },
    ],
  },
  {
    label: "الإدارة والمالية",
    items: [
      { to: "/employees", label: "الموظفون", icon: UserCog },
      { to: "/accounting", label: "المحاسبة", icon: Wallet },
      { to: "/shifts", label: "الورديات", icon: Clock },
      { to: "/reports", label: "التقارير", icon: BarChart3 },
    ],
  },
  {
    label: "النظام",
    items: [
      { to: "/branches", label: "الفروع", icon: Building2 },
      { to: "/notifications", label: "التنبيهات", icon: Bell },
      { to: "/settings", label: "إعدادات الوكالة", icon: Settings },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — sticky on desktop, fixed drawer on mobile */}
      <aside
        className={`fixed inset-y-0 z-50 w-64 shrink-0 border-l border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
        style={{ insetInlineStart: 0 }}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img
              src={logo.url}
              alt="TICKETTY · تذكرتي"
              className="h-10 w-auto object-contain drop-shadow-sm"
            />
            <div className="leading-tight">
              <p className="font-display text-sm font-extrabold text-sidebar-accent">تذكرتي</p>
              <p className="text-[10px] text-sidebar-foreground/70">ERP · النقل البري</p>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-6 overflow-y-auto p-3" style={{ height: "calc(100dvh - 4rem)" }}>
          {NAV.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location.pathname === item.to;
                  return (
                    <li key={item.to}>
                      {item.disabled ? (
                        <span
                          className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/60"
                          aria-label={`${item.label} — قريباً`}
                        >
                          <item.icon className="h-5 w-5" strokeWidth={1.8} />
                          <span>{item.label}</span>
                          <span className="ms-auto rounded-md border border-border px-1.5 py-0.5 text-[9px] font-semibold">
                            قريباً
                          </span>
                        </span>
                      ) : (
                        <Link
                          to={item.to}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60"
                          }`}
                        >
                          <item.icon className="h-5 w-5" strokeWidth={1.8} />
                          <span className="font-bold">{item.label}</span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content — fills remaining space */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

      </div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim().length >= 2) {
      navigate({ to: "/search", search: { q: searchQuery.trim() } });
    }
  };

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-8">
      <button
        onClick={onMenu}
        className="rounded-lg border border-border p-2 text-foreground hover:bg-muted lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" style={{ insetInlineStart: "0.75rem" }} />
        <input
          type="search"
          placeholder="ابحث عن حجز، مسافر، رحلة… (اضغط Enter)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          className="w-full rounded-xl border border-input bg-card py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ paddingInlineStart: "2.25rem", paddingInlineEnd: "0.75rem" }}
        />
      </div>

      <div className="ms-auto flex items-center gap-2">
        <BranchSwitcher />
        <Link
          to="/notifications"
          className="relative rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted transition"
          aria-label="التنبيهات"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">تسجيل الخروج</span>
        </button>
      </div>
    </header>
  );
}
