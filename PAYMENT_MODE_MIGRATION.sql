-- Migration: Add payment_mode column to invoices table
-- Description: Adds payment_mode column to track Online or Cash payments
-- Date: 2026-03-26

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'online'));

-- Create index on payment_mode for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_payment_mode ON invoices(payment_mode);

-- Comment: Run this migration in Supabase SQL Editor if you're adding payment mode to an existing database
