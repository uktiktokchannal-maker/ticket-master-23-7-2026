-- Cashier Shifts: Track daily cash register shifts
-- Each cashier opens a shift at the start of their work, and closes it
-- at the end, reconciling expected vs actual cash in the drawer.

CREATE TABLE IF NOT EXISTS public.cashier_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    cashier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMP WITH TIME ZONE,
    opening_balance NUMERIC NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
    expected_cash NUMERIC NOT NULL DEFAULT 0,
    actual_cash NUMERIC,
    difference NUMERIC,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- Prevent a cashier from having more than one open shift at a time
CREATE UNIQUE INDEX IF NOT EXISTS unique_open_shift_per_cashier
ON public.cashier_shifts (cashier_id)
WHERE status = 'open';

-- RLS
ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shifts in their agency" ON public.cashier_shifts
    FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert shifts in their agency" ON public.cashier_shifts
    FOR INSERT
    WITH CHECK (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update shifts in their agency" ON public.cashier_shifts
    FOR UPDATE
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.cashier_shifts TO authenticated;
GRANT ALL ON public.cashier_shifts TO service_role;
