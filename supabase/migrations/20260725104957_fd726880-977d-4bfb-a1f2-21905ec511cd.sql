
-- 1) branches table
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state TEXT,
  address TEXT,
  phone TEXT,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX branches_agency_idx ON public.branches(agency_id);
CREATE UNIQUE INDEX branches_one_main_per_agency ON public.branches(agency_id) WHERE is_main;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) add branch_id columns (nullable first, backfill, then constrain where needed)
ALTER TABLE public.profiles       ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles     ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE public.bookings       ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;
ALTER TABLE public.cashier_shifts ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;
ALTER TABLE public.expenses       ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT;
ALTER TABLE public.notifications  ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

-- 4) create a main branch per existing agency and backfill
INSERT INTO public.branches (agency_id, name, is_main)
SELECT id, 'الفرع الرئيسي', true FROM public.agencies
ON CONFLICT DO NOTHING;

UPDATE public.bookings b SET branch_id = br.id
FROM public.branches br WHERE br.agency_id = b.agency_id AND br.is_main AND b.branch_id IS NULL;

UPDATE public.cashier_shifts s SET branch_id = br.id
FROM public.branches br WHERE br.agency_id = s.agency_id AND br.is_main AND s.branch_id IS NULL;

UPDATE public.expenses e SET branch_id = br.id
FROM public.branches br WHERE br.agency_id = e.agency_id AND br.is_main AND e.branch_id IS NULL;

-- profiles: only assign non-owners to main branch by default
UPDATE public.profiles p SET branch_id = br.id
FROM public.branches br, public.agencies a
WHERE br.agency_id = p.agency_id
  AND br.is_main
  AND a.id = p.agency_id
  AND a.owner_id <> p.id
  AND p.branch_id IS NULL;

-- 5) enforce NOT NULL on operational tables
ALTER TABLE public.bookings       ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE public.cashier_shifts ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE public.expenses       ALTER COLUMN branch_id SET NOT NULL;

-- indexes
CREATE INDEX bookings_branch_idx       ON public.bookings(branch_id);
CREATE INDEX cashier_shifts_branch_idx ON public.cashier_shifts(branch_id);
CREATE INDEX expenses_branch_idx       ON public.expenses(branch_id);
CREATE INDEX profiles_branch_idx       ON public.profiles(branch_id);

-- 6) helper functions
CREATE OR REPLACE FUNCTION public.current_branch_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid()
$$;

-- true if user is owner of the agency (sees everything) or their branch_id matches
CREATE OR REPLACE FUNCTION public.user_can_access_branch(_branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _branch_id IS NULL
    OR public.has_role(auth.uid(), 'owner')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.branch_id = _branch_id
    )
$$;

-- 7) RLS: branches
CREATE POLICY "Users can view branches in own agency"
  ON public.branches FOR SELECT TO authenticated
  USING (agency_id = public.current_agency_id());

CREATE POLICY "Owners can manage branches"
  ON public.branches FOR ALL TO authenticated
  USING (agency_id = public.current_agency_id() AND public.has_role(auth.uid(), 'owner'))
  WITH CHECK (agency_id = public.current_agency_id() AND public.has_role(auth.uid(), 'owner'));

-- 8) update RLS on operational tables to enforce branch scoping for non-owners
-- bookings
DROP POLICY IF EXISTS "Agency members can view bookings"   ON public.bookings;
DROP POLICY IF EXISTS "Agency members can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Agency members can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Agency members can delete bookings" ON public.bookings;

CREATE POLICY "Branch members can view bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (agency_id = public.current_agency_id() AND public.user_can_access_branch(branch_id));

CREATE POLICY "Branch members can insert bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_agency_id() AND public.user_can_access_branch(branch_id));

CREATE POLICY "Branch members can update bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (agency_id = public.current_agency_id() AND public.user_can_access_branch(branch_id))
  WITH CHECK (agency_id = public.current_agency_id() AND public.user_can_access_branch(branch_id));

CREATE POLICY "Branch members can delete bookings"
  ON public.bookings FOR DELETE TO authenticated
  USING (agency_id = public.current_agency_id() AND public.user_can_access_branch(branch_id));

-- cashier_shifts
DROP POLICY IF EXISTS "Users can view shifts in own agency" ON public.cashier_shifts;
DROP POLICY IF EXISTS "Cashier can open own shift"          ON public.cashier_shifts;
DROP POLICY IF EXISTS "Cashier can update own shift"        ON public.cashier_shifts;
DROP POLICY IF EXISTS "Managers can manage agency shifts"   ON public.cashier_shifts;

CREATE POLICY "Branch members can view shifts"
  ON public.cashier_shifts FOR SELECT TO authenticated
  USING (agency_id = public.current_agency_id() AND public.user_can_access_branch(branch_id));

CREATE POLICY "Cashier can open own shift"
  ON public.cashier_shifts FOR INSERT TO authenticated
  WITH CHECK (
    cashier_id = auth.uid()
    AND agency_id = public.current_agency_id()
    AND public.user_can_access_branch(branch_id)
  );

CREATE POLICY "Cashier can update own shift"
  ON public.cashier_shifts FOR UPDATE TO authenticated
  USING (cashier_id = auth.uid() AND agency_id = public.current_agency_id())
  WITH CHECK (cashier_id = auth.uid() AND agency_id = public.current_agency_id());

CREATE POLICY "Managers can manage branch shifts"
  ON public.cashier_shifts FOR ALL TO authenticated
  USING (
    agency_id = public.current_agency_id()
    AND public.user_can_access_branch(branch_id)
    AND (public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    agency_id = public.current_agency_id()
    AND public.user_can_access_branch(branch_id)
    AND (public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'manager'))
  );

-- expenses
DROP POLICY IF EXISTS "agency members access expenses" ON public.expenses;

CREATE POLICY "Branch members access expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (agency_id = public.current_agency_id() AND public.user_can_access_branch(branch_id))
  WITH CHECK (agency_id = public.current_agency_id() AND public.user_can_access_branch(branch_id));

-- notifications: keep agency-scoped (branch optional)
DROP POLICY IF EXISTS "agency members access notifications" ON public.notifications;
CREATE POLICY "Branch members access notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (
    agency_id = public.current_agency_id()
    AND (branch_id IS NULL OR public.user_can_access_branch(branch_id))
  )
  WITH CHECK (agency_id = public.current_agency_id());

-- 9) update handle_new_user to also create a main branch and link owner
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _agency_id UUID;
  _branch_id UUID;
  _agency_name TEXT;
  _full_name TEXT;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  _agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'وكالتي');

  INSERT INTO public.agencies (name, owner_id)
  VALUES (_agency_name, NEW.id)
  RETURNING id INTO _agency_id;

  INSERT INTO public.branches (agency_id, name, is_main)
  VALUES (_agency_id, 'الفرع الرئيسي', true)
  RETURNING id INTO _branch_id;

  INSERT INTO public.profiles (id, full_name, agency_id, branch_id)
  VALUES (NEW.id, _full_name, _agency_id, NULL);

  INSERT INTO public.user_roles (user_id, role, agency_id, branch_id)
  VALUES (NEW.id, 'owner', _agency_id, NULL);

  RETURN NEW;
END;
$function$;

-- 10) update create_agency_for_current_user to also seed the main branch
CREATE OR REPLACE FUNCTION public.create_agency_for_current_user(_name text, _currency text DEFAULT 'ج.س'::text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
