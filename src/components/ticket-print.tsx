import { QRCodeSVG } from "qrcode.react";
import { Printer, User, Bus, Armchair, CalendarDays, Clock, Ticket as TicketIcon, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-full.png.asset.json";

export type TicketData = {
  id: string;
  passenger_name: string;
  bus_name: string;
  seat_number: number;
  route: string | null;
  departure_at: string | null;
  amount: number;
  currency?: string;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-EG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function formatTime(iso: string | null, offsetMinutes = 0) {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

/** Print-ready ticket matching the tickety mockup. Only variables change. */
export function TicketCard({ t }: { t: TicketData }) {
  const ticketNo = t.id.split("-")[0].toUpperCase();
  return (
    <div
      dir="rtl"
      className="ticket-printable relative mx-auto w-full max-w-[880px] overflow-hidden rounded-[28px] bg-white text-[#062E5B] shadow-[0_20px_60px_-20px_rgba(6,46,91,0.35)]"
      style={{ fontFamily: "Cairo, sans-serif" }}
    >
      {/* Header band */}
      <div className="flex items-center justify-between border-b-4 border-[#008FC7] bg-white px-6 py-3">
        <img src={logo.url} alt="TICKETTY" className="h-12 w-auto object-contain" />
        <p className="text-center font-bold text-[#062E5B] text-base sm:text-lg">
          تطبيق حجز تذاكر البصات السفرية
        </p>
        <div className="flex items-center gap-2 opacity-70">
          <div className="h-9 w-9 rounded-full bg-[#062E5B]/10" />
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 gap-4 bg-[#062E5B] p-5 sm:grid-cols-[1.15fr_1fr]">
        {/* LEFT — Data card */}
        <div className="relative rounded-2xl bg-white p-5 shadow-inner">
          {/* orange arrow accents (decorative) */}
          <div className="pointer-events-none absolute -start-2 top-1/2 -translate-y-1/2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#FF8500] bg-white text-[#FF8500]">
              <ChevronsUpDown className="h-4 w-4" />
            </div>
          </div>

          <ul className="space-y-2.5">
            <Row icon={<User className="h-4 w-4" />} label="اسم الراكب" value={t.passenger_name} />
            <Row icon={<Bus className="h-4 w-4" />} label="اسم الباص" value={t.bus_name} />
            <Row
              icon={<Armchair className="h-4 w-4" />}
              label="رقم المقعد"
              value={String(t.seat_number)}
              highlight
            />
            <Row
              icon={<CalendarDays className="h-4 w-4" />}
              label="التاريخ"
              value={formatDate(t.departure_at)}
            />
            <Row
              icon={<Clock className="h-4 w-4" />}
              label="زمن القيام"
              value={formatTime(t.departure_at)}
            />
            <Row
              icon={<Clock className="h-4 w-4" />}
              label="زمن الحضور"
              value={formatTime(t.departure_at, -30)}
            />
            <Row
              icon={<TicketIcon className="h-4 w-4" />}
              label="رقم التذكرة"
              value={ticketNo}
            />
          </ul>
        </div>

        {/* RIGHT — instructions + QR + confirmation */}
        <div className="relative rounded-2xl bg-white p-5">
          <p className="mb-2 font-extrabold text-[#062E5B]">التعليمات الهامة:</p>
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-[#062E5B]/90">
            {[
              "شنطة واحدة فقط لكل تذكرة.",
              "على الراكب ملء بيانات التذكرة قبل المغادرة من المكتب.",
              "للسائق الحق في تغيير مسار الرحلة إذا دعت الضرورة.",
              "الناقل غير مسؤول عن الأشياء الثمينة كالذهب والمجوهرات والأوراق النقدية.",
              "لا ترد قيمة التذكرة بعد صرفها.",
              "يسمح لكل راكب نقل حقيبة واحدة لا تتعدى 20 كجم.",
              "العفش داخل الباص مسؤولية صاحبه.",
              "أي تذكرة غير مختومة بختم الضرائب لا تعتمد.",
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF8500]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="rounded-lg border border-dashed border-[#062E5B]/30 bg-white p-1.5">
              <QRCodeSVG value={`TICKET:${t.id}`} size={78} level="M" fgColor="#062E5B" />
            </div>
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4FA] px-4 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#16B364]" />
                <span className="text-sm font-extrabold text-[#062E5B]">مؤكد</span>
              </div>
              <p className="mt-2 text-[11px] font-bold text-[#062E5B]/70">
                المسار: {t.route ?? "—"}
              </p>
              <p className="text-[11px] font-bold text-[#062E5B]/70">
                السعر: {t.amount.toLocaleString("ar-EG")} {t.currency ?? ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white py-3 text-center">
        <p className="font-extrabold text-[#062E5B] text-base">
          دقة في المواعيد — <span className="text-[#FF8500]">راحة في الطريق</span>
        </p>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-[#062E5B]/10 bg-[#F5F8FC] px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#008FC7]/10 text-[#008FC7]">
        {icon}
      </span>
      <span className="text-sm font-bold text-[#062E5B]/80">{label}:</span>
      <span
        className={`ms-auto tabular font-extrabold ${highlight ? "text-[#FF8500] text-2xl" : "text-[#062E5B] text-base"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </li>
  );
}

/** Renders a list of tickets and a print button. Used in POS after checkout and in bookings list. */
export function TicketPrintView({
  tickets,
  onClose,
}: {
  tickets: TicketData[];
  onClose?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-foreground">
          تم إصدار {tickets.length} تذكرة — جاهزة للطباعة
        </p>
        <div className="flex gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              إغلاق
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="me-2 h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>
      <div className="tickets-print-area space-y-6">
        {tickets.map((t) => (
          <TicketCard key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}
