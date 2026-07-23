
-- cashier_shifts table
CREATE TABLE IF NOT EXISTS public.cashier_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  cashier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_balance numeric NOT NULL DEFAULT 0,
  expected_cash numeric NOT NULL DEFAULT 0,
  actual_cash numeric,
  difference numeric,
  notes text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one open shift per cashier
CREATE UNIQUE INDEX IF NOT EXISTS cashier_shifts_one_open_per_cashier
  ON public.cashier_shifts (cashier_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS cashier_shifts_agency_opened_idx
  ON public.cashier_shifts (agency_id, opened_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashier_shifts TO authenticated;
GRANT ALL ON public.cashier_shifts TO service_role;

ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shifts in own agency"
  ON public.cashier_shifts FOR SELECT TO authenticated
  USING (agency_id = public.current_agency_id());

CREATE POLICY "Cashier can open own shift"
  ON public.cashier_shifts FOR INSERT TO authenticated
  WITH CHECK (
    cashier_id = auth.uid()
    AND agency_id = public.current_agency_id()
  );

CREATE POLICY "Cashier can update own shift"
  ON public.cashier_shifts FOR UPDATE TO authenticated
  USING (cashier_id = auth.uid() AND agency_id = public.current_agency_id())
  WITH CHECK (cashier_id = auth.uid() AND agency_id = public.current_agency_id());

CREATE POLICY "Managers can manage agency shifts"
  ON public.cashier_shifts FOR ALL TO authenticated
  USING (
    agency_id = public.current_agency_id()
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    agency_id = public.current_agency_id()
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE TRIGGER update_cashier_shifts_updated_at
  BEFORE UPDATE ON public.cashier_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
