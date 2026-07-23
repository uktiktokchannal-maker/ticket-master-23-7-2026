
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'refunded';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;
