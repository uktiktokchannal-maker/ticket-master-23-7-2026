
-- Enums
CREATE TYPE public.bus_status AS ENUM ('active', 'maintenance', 'inactive');
CREATE TYPE public.trip_status AS ENUM ('scheduled', 'boarding', 'departed', 'completed', 'cancelled');
CREATE TYPE public.booking_status AS ENUM ('confirmed', 'cancelled');

-- Buses
CREATE TABLE public.buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  model TEXT,
  seat_count INT NOT NULL DEFAULT 45,
  status public.bus_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, plate_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buses TO authenticated;
GRANT ALL ON public.buses TO service_role;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency members can view buses" ON public.buses FOR SELECT USING (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can insert buses" ON public.buses FOR INSERT WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can update buses" ON public.buses FOR UPDATE USING (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can delete buses" ON public.buses FOR DELETE USING (agency_id = public.current_agency_id());
CREATE TRIGGER update_buses_updated_at BEFORE UPDATE ON public.buses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Routes
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km NUMERIC,
  default_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency members can view routes" ON public.routes FOR SELECT USING (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can insert routes" ON public.routes FOR INSERT WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can update routes" ON public.routes FOR UPDATE USING (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can delete routes" ON public.routes FOR DELETE USING (agency_id = public.current_agency_id());
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trips
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE RESTRICT,
  departure_at TIMESTAMPTZ NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  status public.trip_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trips_agency_departure ON public.trips (agency_id, departure_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency members can view trips" ON public.trips FOR SELECT USING (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can insert trips" ON public.trips FOR INSERT WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can update trips" ON public.trips FOR UPDATE USING (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can delete trips" ON public.trips FOR DELETE USING (agency_id = public.current_agency_id());
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bookings / tickets
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  seat_number INT NOT NULL,
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, seat_number)
);
CREATE INDEX idx_bookings_agency_created ON public.bookings (agency_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency members can view bookings" ON public.bookings FOR SELECT USING (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can insert bookings" ON public.bookings FOR INSERT WITH CHECK (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can update bookings" ON public.bookings FOR UPDATE USING (agency_id = public.current_agency_id());
CREATE POLICY "Agency members can delete bookings" ON public.bookings FOR DELETE USING (agency_id = public.current_agency_id());
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
