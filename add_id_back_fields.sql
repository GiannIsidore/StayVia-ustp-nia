-- Add new columns for back ID images to users table
-- This allows both students and landlords to upload front and back of their IDs

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS landlord_proof_id_back TEXT,
ADD COLUMN IF NOT EXISTS student_proof_id_back TEXT;

COMMENT ON COLUMN users.landlord_proof_id_back IS 'Back side of landlord ID proof document';
COMMENT ON COLUMN users.student_proof_id_back IS 'Back side of student ID proof document';
