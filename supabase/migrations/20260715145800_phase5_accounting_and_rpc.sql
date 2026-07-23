-- Phase 5: Accounting & Concurrency Control

-- 1. Prevent double booking on the same seat for a trip if it's confirmed or pending
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_seat_per_trip 
ON public.bookings (trip_id, seat_number) 
WHERE status IN ('confirmed', 'pending');

-- 2. Create expenses table for the accounting module
CREATE TYPE public.expense_category AS ENUM ('fuel', 'maintenance', 'salary', 'office', 'other');

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    bus_id UUID REFERENCES public.buses(id) ON DELETE CASCADE, -- Optional, if expense is bus-related
    category public.expense_category NOT NULL DEFAULT 'other'::public.expense_category,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expenses in their agency" ON public.expenses
    FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert expenses in their agency" ON public.expenses
    FOR INSERT
    WITH CHECK (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update expenses in their agency" ON public.expenses
    FOR UPDATE
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete expenses in their agency" ON public.expenses
    FOR DELETE
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at_expenses
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.moddatetime('updated_at');
