-- Add payment_method column to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';

-- Add discount column to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
