import { createFileRoute } from "@tanstack/react-router";
import { TicketPrintView } from "@/components/ticket-print";

export const Route = createFileRoute("/_authenticated/ticket-test")({
  component: () => (
    <div className="p-6">
      <TicketPrintView
        tickets={[
          {
            id: "a1b2c3d4-0000-4000-8000-000000000001",
            passenger_name: "أحمد محمد علي",
            bus_name: "باص النيل السريع",
            seat_number: 40,
            route: "الخرطوم — عطبرة",
            departure_at: new Date(Date.now() + 86400000).toISOString(),
            amount: 15000,
            currency: "SDG",
          },
          {
            id: "b2c3d4e5-0000-4000-8000-000000000002",
            passenger_name: "سارة إبراهيم",
            bus_name: "باص النيل السريع",
            seat_number: 12,
            route: "الخرطوم — عطبرة",
            departure_at: new Date(Date.now() + 86400000).toISOString(),
            amount: 15000,
            currency: "SDG",
          },
        ]}
      />
    </div>
  ),
});
