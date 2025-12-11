-- Migration: Add extended student information fields to users table
-- Created: 2025-12-10
-- Description: Adds personal info, address, parent/guardian info, and emergency contact fields

-- Add personal information fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS religion TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT;

-- Add address information fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Add parent/guardian information fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS parent_name TEXT,
ADD COLUMN IF NOT EXISTS parent_contact TEXT,
ADD COLUMN IF NOT EXISTS parent_email TEXT;

-- Add emergency contact information fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_number TEXT;

-- Add comments for documentation
COMMENT ON COLUMN users.date_of_birth IS 'Student date of birth';
COMMENT ON COLUMN users.gender IS 'Student gender (Male, Female, Other, Prefer not to say)';
COMMENT ON COLUMN users.religion IS 'Student religion (free text)';
COMMENT ON COLUMN users.nationality IS 'Student nationality';
COMMENT ON COLUMN users.home_address IS 'Student permanent home address (required for students)';
COMMENT ON COLUMN users.city IS 'Student home city (required for students)';
COMMENT ON COLUMN users.province IS 'Student home province/state (required for students)';
COMMENT ON COLUMN users.postal_code IS 'Student postal/ZIP code';
COMMENT ON COLUMN users.parent_name IS 'Parent or guardian full name (nullable if N/A)';
COMMENT ON COLUMN users.parent_contact IS 'Parent or guardian contact number (nullable if N/A)';
COMMENT ON COLUMN users.parent_email IS 'Parent or guardian email address (nullable if N/A)';
COMMENT ON COLUMN users.emergency_contact_name IS 'Emergency contact person name';
COMMENT ON COLUMN users.emergency_contact_number IS 'Emergency contact phone number';
