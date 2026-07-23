-- Add 'pending' and 'refunded' to booking_status enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'refunded';
