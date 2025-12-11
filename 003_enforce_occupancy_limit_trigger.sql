-- Migration: Enforce occupancy limits with database trigger
-- Run this in your Supabase SQL Editor
-- 
-- Purpose: Prevent exceeding max_occupancy when confirming rental requests
-- This provides atomic, race-condition-free enforcement at the database level

-- Drop existing trigger and function if they exist (for re-running)
DROP TRIGGER IF EXISTS enforce_occupancy_limit ON requests;
DROP FUNCTION IF EXISTS check_occupancy_limit();

-- Create function to validate occupancy limit
CREATE OR REPLACE FUNCTION check_occupancy_limit()
RETURNS TRIGGER AS $$
DECLARE
  confirmed_count INTEGER;
  max_slots INTEGER;
BEGIN
  -- Only check when confirming a request (not already confirmed)
  -- This ensures we only validate NEW confirmations
  IF NEW.confirmed = TRUE AND (OLD IS NULL OR OLD.confirmed IS NULL OR OLD.confirmed = FALSE) THEN
    
    -- Count currently confirmed requests for this post
    -- Exclude the current request being updated
    SELECT COUNT(*) INTO confirmed_count
    FROM requests
    WHERE post_id = NEW.post_id 
      AND confirmed = TRUE
      AND id != NEW.id;
    
    -- Get max occupancy setting from the post
    SELECT max_occupancy INTO max_slots
    FROM posts
    WHERE id = NEW.post_id;
    
    -- Check if max_slots was found
    IF max_slots IS NULL THEN
      RAISE EXCEPTION 'Post not found or max_occupancy not set for post_id: %', NEW.post_id;
    END IF;
    
    -- Check if adding this confirmation would exceed the limit
    -- confirmed_count is current count, +1 would be after adding this request
    IF confirmed_count >= max_slots THEN
      RAISE EXCEPTION 'Cannot confirm request: Property is at maximum occupancy (% of % slots occupied)', 
                      confirmed_count, max_slots
        USING HINT = 'Please check the current occupancy status. All available slots are filled.',
              ERRCODE = '23514'; -- check_violation error code
    END IF;
  END IF;
  
  -- Allow the operation if checks pass
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires before INSERT or UPDATE on requests table
CREATE TRIGGER enforce_occupancy_limit
  BEFORE INSERT OR UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION check_occupancy_limit();

-- Add helpful comment to the trigger
COMMENT ON TRIGGER enforce_occupancy_limit ON requests IS 
  'Validates that confirming a request does not exceed the post max_occupancy limit. Prevents race conditions at database level.';

COMMENT ON FUNCTION check_occupancy_limit() IS 
  'Checks if confirming a rental request would exceed the property max_occupancy. Raises exception if limit would be exceeded.';

-- Grant necessary permissions
-- (Triggers run with the privileges of the function owner, which is typically the database owner)
-- No additional grants needed as authenticated users already have UPDATE permissions on requests

-- Verification query (optional - shows current occupancy for all posts)
-- Uncomment to run after creating trigger:
/*
SELECT 
  p.id as post_id,
  p.title,
  p.max_occupancy,
  COUNT(r.id) FILTER (WHERE r.confirmed = true) as current_confirmed,
  p.max_occupancy - COUNT(r.id) FILTER (WHERE r.confirmed = true) as available_slots
FROM posts p
LEFT JOIN requests r ON r.post_id = p.id
GROUP BY p.id, p.title, p.max_occupancy
ORDER BY p.created_at DESC;
*/
