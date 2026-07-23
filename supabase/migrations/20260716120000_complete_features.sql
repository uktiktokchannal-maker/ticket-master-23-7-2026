-- Phase 6: Notifications + Driver-Trip linking

-- 1. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = broadcast to whole agency
    type TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'alert'
    title TEXT NOT NULL,
    description TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications in their agency" ON public.notifications
    FOR SELECT
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ) AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ) AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "Users can insert notifications in their agency" ON public.notifications
    FOR INSERT
    WITH CHECK (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete notifications in their agency" ON public.notifications
    FOR DELETE
    USING (agency_id IN (
        SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    ));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 2. Add driver_id to trips
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'driver_id'
    ) THEN
        ALTER TABLE public.trips ADD COLUMN driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;
    END IF;
END $$;
