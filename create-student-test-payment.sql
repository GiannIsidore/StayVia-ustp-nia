-- ====================================================
-- CREATE TEST PAYMENT FOR STUDENT NOTIFICATION TESTING
-- ====================================================

-- STEP 1: Find your user ID (run this first)
SELECT 
  id,
  firstname,
  lastname,
  account_type,
  email
FROM users
WHERE account_type = 'student'
ORDER BY created_at DESC
LIMIT 5;

-- STEP 2: Find a landlord and post (for test data)
SELECT 
  u.id as landlord_id,
  u.firstname || ' ' || u.lastname as landlord_name,
  p.id as post_id,
  p.title as property_title
FROM users u
LEFT JOIN posts p ON p.userId = u.id
WHERE u.account_type = 'landlord'
AND p.id IS NOT NULL
LIMIT 5;

-- STEP 3: Create test payment due in 3 days
-- Replace these values with actual IDs from steps 1 and 2:
-- - YOUR_STUDENT_USER_ID: Your user ID from Step 1
-- - LANDLORD_USER_ID: Any landlord ID from Step 2
-- - POST_ID: Any post ID from Step 2

INSERT INTO payments (
  tenant_id,
  landlord_id,
  post_id,
  amount,
  due_date,
  status,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent,
  overdue_notif_sent,
  created_at
) VALUES (
  'YOUR_STUDENT_USER_ID',  -- ← Replace with your user ID
  'LANDLORD_USER_ID',       -- ← Replace with any landlord ID
  'POST_ID',                -- ← Replace with any post ID
  5000.00,                  -- ₱5,000 test amount
  CURRENT_DATE + INTERVAL '3 days',  -- Due in 3 days (triggers 3-day reminder)
  'unpaid',
  false,  -- Will trigger notification
  false,
  false,
  false,
  NOW()
);

-- STEP 4: Verify the payment was created
SELECT 
  p.id,
  p.amount,
  p.due_date,
  p.status,
  p.reminder_3day_sent,
  tenant.firstname || ' ' || tenant.lastname as tenant_name,
  landlord.firstname || ' ' || landlord.lastname as landlord_name,
  post.title as property_title,
  -- Check what notification should fire
  CASE 
    WHEN p.due_date = CURRENT_DATE + INTERVAL '3 days' THEN '🔔 3-DAY REMINDER (should fire now)'
    WHEN p.due_date = CURRENT_DATE + INTERVAL '1 day' THEN '🔔 1-DAY REMINDER'
    WHEN p.due_date = CURRENT_DATE THEN '🔔 DUE TODAY'
    WHEN p.due_date < CURRENT_DATE THEN '🔔 OVERDUE'
    ELSE 'No notification yet'
  END as notification_status
FROM payments p
LEFT JOIN users tenant ON p.tenant_id = tenant.id
LEFT JOIN users landlord ON p.landlord_id = landlord.id
LEFT JOIN posts post ON p.post_id = post.id
WHERE p.tenant_id = 'YOUR_STUDENT_USER_ID'  -- ← Replace with your user ID
ORDER BY p.due_date;

-- ====================================================
-- CREATE COMPLETE TEST SUITE (all notification types)
-- ====================================================

-- Run this to create payments for all notification scenarios:
INSERT INTO payments (tenant_id, landlord_id, post_id, amount, due_date, status, reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent, overdue_notif_sent)
VALUES 
  -- 3-day reminder
  ('YOUR_STUDENT_USER_ID', 'LANDLORD_USER_ID', 'POST_ID', 5000, CURRENT_DATE + INTERVAL '3 days', 'unpaid', false, false, false, false),
  
  -- 1-day reminder
  ('YOUR_STUDENT_USER_ID', 'LANDLORD_USER_ID', 'POST_ID', 6000, CURRENT_DATE + INTERVAL '1 day', 'unpaid', true, false, false, false),
  
  -- Due today
  ('YOUR_STUDENT_USER_ID', 'LANDLORD_USER_ID', 'POST_ID', 7000, CURRENT_DATE, 'unpaid', true, true, false, false),
  
  -- Overdue
  ('YOUR_STUDENT_USER_ID', 'LANDLORD_USER_ID', 'POST_ID', 8000, CURRENT_DATE - INTERVAL '2 days', 'unpaid', true, true, true, false);

-- ====================================================
-- RESET TEST FLAGS (to test repeatedly)
-- ====================================================

-- Run this to reset notification flags and test again:
UPDATE payments 
SET 
  reminder_3day_sent = false,
  reminder_1day_sent = false,
  reminder_duedate_sent = false,
  overdue_notif_sent = false
WHERE tenant_id = 'YOUR_STUDENT_USER_ID';

-- ====================================================
-- CLEANUP (delete test payments)
-- ====================================================

-- Run this when done testing:
DELETE FROM payments 
WHERE tenant_id = 'YOUR_STUDENT_USER_ID'
AND amount IN (5000, 6000, 7000, 8000);
