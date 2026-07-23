CREATE TYPE public.driver_status AS ENUM ('active', 'inactive', 'on_trip');

CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    license_number TEXT,
    status public.driver_status NOT NULL DEFAULT 'active'::public.driver_status,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view drivers in their agency" ON public.drivers
    FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert drivers in their agency" ON public.drivers
    FOR INSERT
    WITH CHECK (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update drivers in their agency" ON public.drivers
    FOR UPDATE
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete drivers in their agency" ON public.drivers
    FOR DELETE
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at_drivers
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION public.moddatetime('updated_at');
