-- Add terms_and_conditions column to posts table
-- This allows landlords to set custom terms that students must agree to before inquiring

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

-- Add a comment to the column for documentation
COMMENT ON COLUMN posts.terms_and_conditions IS 'Custom terms and conditions set by the landlord that students must agree to before inquiring about the property';
