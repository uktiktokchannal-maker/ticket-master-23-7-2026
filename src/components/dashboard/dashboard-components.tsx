import React from "react";
import { Link } from "@tanstack/react-router";
import {
  TrendingUp,
  TrendingDown,
  Ticket,
  ArrowUpRight,
} from "lucide-react";
import { motion } from "framer-motion";

export type BusStatus = "active" | "maintenance" | "inactive";
export type BookingStatus = "confirmed" | "pending" | "cancelled" | "refunded" | string;

export type Tone = "primary" | "success" | "accent" | "warning" | "destructive";
export const toneMap: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success/15 text-success",
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning/20 text-warning-foreground",
  destructive: "bg-destructive/15 text-destructive",
};

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`glass-card interactive-glow rounded-3xl p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function QuickAction({
  to,
  icon: Icon,
  label,
  primary,
}: {
  to: string;
  icon: typeof Ticket;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        primary
          ? "inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground shadow-card transition hover:brightness-105"
          : "inline-flex items-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-4 py-2.5 text-sm font-bold text-primary-foreground backdrop-blur transition hover:bg-primary-foreground/15"
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function DeltaPill({ delta, inverted }: { delta: number | null; inverted?: boolean }) {
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-bold text-primary-foreground/70">
        بيانات جديدة
      </span>
    );
  }
  const up = delta >= 0;
  const good = up;
  const base = inverted
    ? good
      ? "bg-success/20 text-success-foreground border border-success/30"
      : "bg-destructive/20 text-primary-foreground border border-destructive/30"
    : good
      ? "text-success"
      : "text-destructive";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${base}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(delta)}% مقارنة بالأمس
    </span>
  );
}

export function FleetRow({
  icon: Icon,
  tone,
  label,
  value,
  total,
}: {
  icon: typeof Ticket;
  tone: Tone;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${toneMap[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="ms-auto tabular text-xs font-bold text-foreground">{value}</span>
      <span className="w-10 text-end text-[10px] tabular text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  delta,
  hint,
  sparkline,
  progress,
}: {
  label: string;
  value: string;
  icon: typeof Ticket;
  tone: Tone;
  delta?: number | null;
  hint?: string;
  sparkline?: number[];
  progress?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="group glass-card interactive-glow relative overflow-hidden ticket-shape p-5 transition-shadow hover:shadow-xl hover:shadow-primary/10"
    >
      <div className="brand-pattern absolute inset-0 z-0"></div>
      <div className="relative z-10 flex items-start justify-between">
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        {typeof delta === "number" && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              delta >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}
          >
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-extrabold text-foreground tabular">{value}</span>
        </div>
        {hint && <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>

      {sparkline && sparkline.length > 1 && (
        <div className="relative z-10">
          <Sparkline values={sparkline} className="mt-3" />
        </div>
      )}

      {typeof progress === "number" && (
        <div className="relative z-10 mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}

export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  const w = 100;
  const h = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const linePath = "M " + points.join(" L ");
  const areaPath = `M 0,${h} L ${points.join(" L ")} L ${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`h-7 w-full ${className}`}>
      <path d={areaPath} fill="var(--primary)" fillOpacity="0.1" />
      <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RevenueChart({
  series,
  currency,
}: {
  series: Array<{ day: string; label: string; revenue: number; bookings: number }>;
  currency: string;
}) {
  const w = 640;
  const h = 200;
  const padY = 16;
  const max = Math.max(...series.map((s) => s.revenue), 1);
  const step = series.length > 1 ? w / (series.length - 1) : w;

  const pts = series.map((s, i) => {
    const x = i * step;
    const y = h - padY - (s.revenue / max) * (h - padY * 2);
    return { x, y, s };
  });

  const linePath = "M " + pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L ");
  const areaPath =
    `M 0,${h} L ` +
    pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L ") +
    ` L ${w},${h} Z`;

  const total = series.reduce((s, x) => s + x.revenue, 0);
  const bookingsTotal = series.reduce((s, x) => s + x.bookings, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            إجمالي الأسبوع
          </p>
          <p className="font-display text-xl font-extrabold tabular text-foreground">
            {total.toLocaleString("ar-EG")}{" "}
            <span className="text-xs font-semibold text-muted-foreground">{currency}</span>
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {bookingsTotal} تذكرة مؤكدة
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-48 w-full">
          {/* grid */}
          {[0.25, 0.5, 0.75].map((r) => (
            <line
              key={r}
              x1={0}
              x2={w}
              y1={padY + r * (h - padY * 2)}
              y2={padY + r * (h - padY * 2)}
              stroke="var(--border)"
              strokeDasharray="2 4"
              strokeWidth="1"
            />
          ))}
          <defs>
            <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#revGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="var(--card)" stroke="var(--primary)" strokeWidth="2" />
              {i === pts.length - 1 && (
                <circle cx={p.x} cy={p.y} r="6" fill="var(--accent)" opacity="0.35" />
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex justify-between text-[11px] font-semibold text-muted-foreground">
        {series.map((s) => (
          <span key={s.day}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

export function FleetDonut({
  active,
  maintenance,
  inactive,
}: {
  active: number;
  maintenance: number;
  inactive: number;
}) {
  const total = active + maintenance + inactive;
  const R = 42;
  const C = 2 * Math.PI * R;
  const segs = [
    { v: active, color: "var(--success)" },
    { v: maintenance, color: "var(--warning)" },
    { v: inactive, color: "var(--destructive)" },
  ];
  let offset = 0;
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--muted)" strokeWidth="12" />
        {segs.map((seg, i) => {
          if (seg.v === 0 || total === 0) return null;
          const len = (seg.v / total) * C;
          const dash = `${len} ${C - len}`;
          const el = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth="12"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-extrabold tabular text-foreground">
          {total > 0 ? Math.round((active / total) * 100) : 0}%
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">جاهزية</span>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed: { label: "مؤكد", cls: "bg-success/15 text-success" },
    pending: { label: "معلّق", cls: "bg-warning/25 text-warning-foreground" },
    cancelled: { label: "ملغى", cls: "bg-destructive/15 text-destructive" },
    refunded: { label: "مسترد", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  cta,
}: {
  icon: typeof Ticket;
  title: string;
  desc: string;
  cta?: { to: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-2 text-sm font-bold text-foreground">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{desc}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:brightness-110"
        >
          {cta.label}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
