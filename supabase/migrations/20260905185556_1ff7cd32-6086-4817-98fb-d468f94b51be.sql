-- 1) Owner-only agency update inside the SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.create_agency_for_current_user(_name text, _currency text DEFAULT 'ج.س'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
  _agency_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'Agency name is required';
  END IF;

  SELECT agency_id INTO _existing FROM public.profiles WHERE id = _uid;
  IF _existing IS NOT NULL THEN
    IF NOT public.has_role(_uid, 'owner') THEN
      RAISE EXCEPTION 'فقط مالك الوكالة يمكنه تعديل بياناتها';
    END IF;
    UPDATE public.agencies
      SET name = btrim(_name),
          currency = COALESCE(NULLIF(btrim(_currency), ''), currency)
      WHERE id = _existing;
    RETURN _existing;
  END IF;

  INSERT INTO public.agencies (name, owner_id, currency)
  VALUES (btrim(_name), _uid, COALESCE(NULLIF(btrim(_currency), ''), 'ج.س'))
  RETURNING id INTO _agency_id;

  INSERT INTO public.branches (agency_id, name, is_main)
  VALUES (_agency_id, 'الفرع الرئيسي', true);

  INSERT INTO public.profiles (id, agency_id, branch_id)
  VALUES (_uid, _agency_id, NULL)
  ON CONFLICT (id) DO UPDATE SET agency_id = EXCLUDED.agency_id;

  INSERT INTO public.user_roles (user_id, role, agency_id)
  VALUES (_uid, 'owner', _agency_id)
  ON CONFLICT (user_id, role, agency_id) DO NOTHING;

  RETURN _agency_id;
END;
$function$;

-- 2) Server-side amount enforcement against the trip's real price (max 50% discount)
CREATE OR REPLACE FUNCTION public.validate_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  -- Amount integrity: never above the trip price, discount capped at 50%
  IF NEW.status = 'confirmed' THEN
    IF NEW.amount > _trip.price THEN
      RAISE EXCEPTION 'مبلغ التذكرة لا يمكن أن يتجاوز سعر الرحلة (%)', _trip.price;
    END IF;
    IF NEW.amount < _trip.price * 0.5 THEN
      RAISE EXCEPTION 'الخصم لا يمكن أن يتجاوز 50%% من سعر الرحلة (%)', _trip.price;
    END IF;
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
$function$;

-- 3) Tighten EXECUTE privileges on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.create_agency_for_current_user(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_agency_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_branch_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_branch(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;