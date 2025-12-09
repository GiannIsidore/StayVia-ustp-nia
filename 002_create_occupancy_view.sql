-- Migration: Create post_occupancy view for tracking available slots
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE VIEW post_occupancy AS
SELECT 
  p.id as post_id,
  p.title,
  p.max_occupancy,
  COUNT(r.id) FILTER (WHERE r.confirmed = true) as current_occupancy,
  (p.max_occupancy - COUNT(r.id) FILTER (WHERE r.confirmed = true)) as available_slots,
  CASE 
    WHEN COUNT(r.id) FILTER (WHERE r.confirmed = true) >= p.max_occupancy THEN false
    ELSE true
  END as has_available_slots
FROM posts p
LEFT JOIN requests r ON r.post_id = p.id
GROUP BY p.id, p.title, p.max_occupancy;

-- Grant permissions
GRANT SELECT ON post_occupancy TO authenticated;
GRANT SELECT ON post_occupancy TO anon;
