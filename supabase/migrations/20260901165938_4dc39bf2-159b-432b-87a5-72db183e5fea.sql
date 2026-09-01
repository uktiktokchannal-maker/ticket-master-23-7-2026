-- ============ TRIPS: conflict + sanity validation ============
CREATE OR REPLACE FUNCTION public.validate_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _win interval := interval '4 hours';
  _conflict record;
  _bus record;
  _driver record;
  _sold int;
BEGIN
  IF NEW.price < 0 THEN
    RAISE EXCEPTION 'لا يمكن أن يكون سعر الرحلة سالباً';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.departure_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'لا يمكن جدولة رحلة في وقت مضى';
  END IF;

  SELECT * INTO _bus FROM public.buses WHERE id = NEW.bus_id;
  IF _bus IS NULL THEN
    RAISE EXCEPTION 'الحافلة غير موجودة';
  END IF;

  IF NEW.status NOT IN ('cancelled', 'completed') AND _bus.status <> 'active' THEN
    RAISE EXCEPTION 'الحافلة % غير متاحة (حالتها: %)', _bus.plate_number,
      CASE _bus.status::text WHEN 'maintenance' THEN 'صيانة' ELSE 'غير نشطة' END;
  END IF;

  IF NEW.driver_id IS NOT NULL AND NEW.status NOT IN ('cancelled', 'completed') THEN
    SELECT * INTO _driver FROM public.drivers WHERE id = NEW.driver_id;
    IF _driver IS NULL THEN
      RAISE EXCEPTION 'السائق غير موجود';
    END IF;
    IF _driver.status = 'inactive' THEN
      RAISE EXCEPTION 'السائق % غير نشط ولا يمكن إسناد رحلة له', _driver.name;
    END IF;
  END IF;

  -- capacity vs sold seats (on bus change)
  IF TG_OP = 'UPDATE' AND NEW.bus_id IS DISTINCT FROM OLD.bus_id THEN
    SELECT count(*) INTO _sold FROM public.bookings
      WHERE trip_id = NEW.id AND status = 'confirmed';
    IF _sold > _bus.seat_count THEN
      RAISE EXCEPTION 'لا يمكن اختيار حافلة سعتها % مقعد بينما عدد المقاعد المباعة %', _bus.seat_count, _sold;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE trip_id = NEW.id AND status = 'confirmed' AND seat_number > _bus.seat_count
    ) THEN
      RAISE EXCEPTION 'توجد مقاعد مباعة أرقامها أكبر من سعة الحافلة الجديدة (% مقعد)', _bus.seat_count;
    END IF;
  END IF;

  IF NEW.status IN ('cancelled', 'completed') THEN
    RETURN NEW;
  END IF;

  -- bus conflict
  SELECT t.id, t.departure_at INTO _conflict
  FROM public.trips t
  WHERE t.id <> NEW.id
    AND t.bus_id = NEW.bus_id
    AND t.status NOT IN ('cancelled', 'completed')
    AND t.departure_at > NEW.departure_at - _win
    AND t.departure_at < NEW.departure_at + _win
  LIMIT 1;
  IF _conflict.id IS NOT NULL THEN
    RAISE EXCEPTION 'تعارض: الحافلة % مرتبطة برحلة أخرى بتاريخ % — يجب ترك 4 ساعات على الأقل بين الرحلتين',
      _bus.plate_number, to_char(_conflict.departure_at, 'YYYY-MM-DD HH24:MI');
  END IF;

  -- driver conflict
  IF NEW.driver_id IS NOT NULL THEN
    SELECT t.id, t.departure_at INTO _conflict
    FROM public.trips t
    WHERE t.id <> NEW.id
      AND t.driver_id = NEW.driver_id
      AND t.status NOT IN ('cancelled', 'completed')
      AND t.departure_at > NEW.departure_at - _win
      AND t.departure_at < NEW.departure_at + _win
    LIMIT 1;
    IF _conflict.id IS NOT NULL THEN
      RAISE EXCEPTION 'تعارض: السائق % مرتبط برحلة أخرى بتاريخ % — يجب ترك 4 ساعات على الأقل بين الرحلتين',
        (SELECT name FROM public.drivers WHERE id = NEW.driver_id),
        to_char(_conflict.departure_at, 'YYYY-MM-DD HH24:MI');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_trip_trg ON public.trips;
CREATE TRIGGER validate_trip_trg
BEFORE INSERT OR UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.validate_trip();

-- ============ BOOKINGS: seat range, trip state, amount ============
CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _trip record;
  _cap int;
BEGIN
  IF NEW.amount < 0 THEN
    RAISE EXCEPTION 'لا يمكن أن يكون مبلغ التذكرة سالباً';
  END IF;

  SELECT t.*, b.seat_count INTO _trip
  FROM public.trips t JOIN public.buses b ON b.id = t.bus_id
  WHERE t.id = NEW.trip_id;

  IF _trip IS NULL THEN
    RAISE EXCEPTION 'الرحلة غير موجودة';
  END IF;

  _cap := _trip.seat_count;

  IF NEW.seat_number < 1 OR NEW.seat_number > _cap THEN
    RAISE EXCEPTION 'رقم المقعد يجب أن يكون بين 1 و % حسب سعة الحافلة', _cap;
  END IF;

  IF NEW.status = 'confirmed' THEN
    IF _trip.status IN ('cancelled', 'completed', 'departed') THEN
      RAISE EXCEPTION 'لا يمكن الحجز على رحلة حالتها %',
        CASE _trip.status::text
          WHEN 'cancelled' THEN 'ملغاة'
          WHEN 'completed' THEN 'منتهية'
          ELSE 'انطلقت'
        END;
    END IF;
    IF TG_OP = 'INSERT' AND _trip.departure_at < now() THEN
      RAISE EXCEPTION 'لا يمكن الحجز على رحلة انقضى موعد انطلاقها';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_booking_trg ON public.bookings;
CREATE TRIGGER validate_booking_trg
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_booking();

-- cancelled seats should become available again
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_trip_id_seat_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_seat_uniq
  ON public.bookings (trip_id, seat_number)
  WHERE status IN ('confirmed', 'pending');

-- ============ ROUTES ============
CREATE OR REPLACE FUNCTION public.validate_route()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.origin := btrim(NEW.origin);
  NEW.destination := btrim(NEW.destination);
  IF NEW.origin = '' OR NEW.destination = '' THEN
    RAISE EXCEPTION 'يجب تحديد نقطة الانطلاق والوجهة';
  END IF;
  IF lower(NEW.origin) = lower(NEW.destination) THEN
    RAISE EXCEPTION 'لا يمكن أن تكون نقطة الانطلاق هي نفسها الوجهة';
  END IF;
  IF NEW.default_price < 0 THEN
    RAISE EXCEPTION 'لا يمكن أن يكون السعر سالباً';
  END IF;
  IF NEW.distance_km IS NOT NULL AND NEW.distance_km < 0 THEN
    RAISE EXCEPTION 'لا يمكن أن تكون المسافة سالبة';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_route_trg ON public.routes;
CREATE TRIGGER validate_route_trg
BEFORE INSERT OR UPDATE ON public.routes
FOR EACH ROW EXECUTE FUNCTION public.validate_route();

CREATE UNIQUE INDEX IF NOT EXISTS routes_agency_origin_dest_uniq
  ON public.routes (agency_id, lower(origin), lower(destination));

-- ============ BUSES / DRIVERS ============
ALTER TABLE public.buses DROP CONSTRAINT IF EXISTS buses_seat_count_positive;
ALTER TABLE public.buses ADD CONSTRAINT buses_seat_count_positive CHECK (seat_count >= 1);

CREATE UNIQUE INDEX IF NOT EXISTS drivers_agency_license_uniq
  ON public.drivers (agency_id, lower(license_number))
  WHERE license_number IS NOT NULL AND btrim(license_number) <> '';

-- ============ SHIFTS ============
CREATE UNIQUE INDEX IF NOT EXISTS cashier_shifts_one_open_uniq
  ON public.cashier_shifts (cashier_id)
  WHERE status = 'open';

-- ============ EXPENSES ============
CREATE OR REPLACE FUNCTION public.validate_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.amount < 0 THEN
    RAISE EXCEPTION 'لا يمكن أن يكون مبلغ المصروف سالباً';
  END IF;
  IF NEW.date > (CURRENT_DATE + 1) THEN
    RAISE EXCEPTION 'لا يمكن تسجيل مصروف بتاريخ مستقبلي';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_expense_trg ON public.expenses;
CREATE TRIGGER validate_expense_trg
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.validate_expense();