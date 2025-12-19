ALTER TABLE payments
ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;
COMMENT ON COLUMN payments.amount_paid IS 'The amount actually paid by the tenant so far.';