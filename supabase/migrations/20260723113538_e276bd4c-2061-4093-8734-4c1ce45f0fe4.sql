
CREATE OR REPLACE FUNCTION public.create_agency_for_current_user(_name text, _currency text DEFAULT 'ج.س')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    UPDATE public.agencies
      SET name = btrim(_name),
          currency = COALESCE(NULLIF(btrim(_currency), ''), currency)
      WHERE id = _existing;
    RETURN _existing;
  END IF;

  INSERT INTO public.agencies (name, owner_id, currency)
  VALUES (btrim(_name), _uid, COALESCE(NULLIF(btrim(_currency), ''), 'ج.س'))
  RETURNING id INTO _agency_id;

  INSERT INTO public.profiles (id, agency_id)
  VALUES (_uid, _agency_id)
  ON CONFLICT (id) DO UPDATE SET agency_id = EXCLUDED.agency_id;

  INSERT INTO public.user_roles (user_id, role, agency_id)
  VALUES (_uid, 'owner', _agency_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _agency_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_agency_for_current_user(text, text) TO authenticated;
