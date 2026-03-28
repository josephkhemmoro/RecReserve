-- Add credit_balance column to users table for admin-issued credits
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance numeric DEFAULT 0 NOT NULL;
