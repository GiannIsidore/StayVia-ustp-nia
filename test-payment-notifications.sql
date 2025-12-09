-- ==========================================
-- TEST SQL FOR PAYMENT NOTIFICATIONS SYSTEM
-- ==========================================
-- This script creates test data to verify the payment notification system
-- Run this in your Supabase SQL editor AFTER the main migration

-- PREREQUISITES:
-- 1. You must have at least one user in the users table
-- 2. You must have at least one post in the posts table
-- 3. The payment notifications migration must be run first

-- ==========================================
-- PART 1: CREATE TEST USERS (if needed)
-- ==========================================
-- Uncomment and modify these if you need test users

/*
-- Test Student (Tenant)
INSERT INTO users (id, email, firstname, lastname, account_type, created_at)
VALUES 
  ('test-student-001', 'student@test.com', 'John', 'Student', 'student', NOW())
ON CONFLICT (id) DO NOTHING;

-- Test Landlord
INSERT INTO users (id, email, firstname, lastname, account_type, created_at)
VALUES 
  ('test-landlord-001', 'landlord@test.com', 'Jane', 'Landlord', 'landlord', NOW())
ON CONFLICT (id) DO NOTHING;
*/

-- ==========================================
-- PART 2: CREATE TEST POST (if needed)
-- ==========================================
-- Uncomment and modify if you need a test property

/*
INSERT INTO posts (id, user_id, title, description, price_per_night, location, availability, created_at)
VALUES 
  (
    'test-post-001',
    'test-landlord-001', -- Replace with actual landlord user_id
    'Test Apartment for Payment Notifications',
    'This is a test property for payment notification system',
    5000,
    'Test Location, Test City',
    true,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;
*/

-- ==========================================
-- PART 3: CREATE TEST RENTAL REQUEST
-- ==========================================
-- Replace the user_id and post_id with actual IDs from your database

-- Uncomment and modify:
/*
INSERT INTO requests (
  id,
  user_id, 
  post_id,
  requested,
  confirmed,
  rental_start_date,
  rental_end_date,
  monthly_rent_amount,
  payment_day_of_month,
  rating_notif_sent,
  created_at,
  confirmed_at
)
VALUES (
  'test-request-001',
  'test-student-001', -- Replace with actual student user_id
  'test-post-001',    -- Replace with actual post_id
  true,
  true,
  NOW(), -- Start today
  NOW() + INTERVAL '3 months', -- End in 3 months
  5000, -- Monthly rent
  15,   -- Payment on 15th of each month
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
*/

-- ==========================================
-- PART 4: CREATE TEST PAYMENTS WITH VARIOUS DUE DATES
-- ==========================================
-- These payments are designed to test different notification scenarios

-- SCENARIO 1: Payment due in 3 days (should trigger 3-day reminder)
INSERT INTO payments (
  request_id,
  landlord_id,
  tenant_id,
  post_id,
  amount,
  due_date,
  status,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent,
  overdue_notif_sent,
  created_at
)
VALUES (
  (SELECT id FROM requests WHERE confirmed = true LIMIT 1), -- Use first confirmed request
  (SELECT user_id FROM posts WHERE id = (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1)), -- Landlord
  (SELECT user_id FROM requests WHERE confirmed = true LIMIT 1), -- Tenant
  (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1), -- Post
  5000, -- Amount
  (CURRENT_DATE + INTERVAL '3 days')::date, -- Due in 3 days
  'unpaid',
  false, -- 3-day reminder not sent yet
  false,
  false,
  false,
  NOW()
);

-- SCENARIO 2: Payment due tomorrow (should trigger 1-day reminder)
INSERT INTO payments (
  request_id,
  landlord_id,
  tenant_id,
  post_id,
  amount,
  due_date,
  status,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent,
  overdue_notif_sent,
  created_at
)
VALUES (
  (SELECT id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT user_id FROM posts WHERE id = (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1)),
  (SELECT user_id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1),
  5000,
  (CURRENT_DATE + INTERVAL '1 day')::date, -- Due tomorrow
  'unpaid',
  true,  -- 3-day reminder already sent
  false, -- 1-day reminder not sent yet
  false,
  false,
  NOW()
);

-- SCENARIO 3: Payment due today (should trigger due date reminder)
INSERT INTO payments (
  request_id,
  landlord_id,
  tenant_id,
  post_id,
  amount,
  due_date,
  status,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent,
  overdue_notif_sent,
  created_at
)
VALUES (
  (SELECT id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT user_id FROM posts WHERE id = (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1)),
  (SELECT user_id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1),
  5000,
  CURRENT_DATE, -- Due today
  'unpaid',
  true, -- 3-day reminder already sent
  true, -- 1-day reminder already sent
  false, -- Due date reminder not sent yet
  false,
  NOW()
);

-- SCENARIO 4: Payment overdue by 2 days (should trigger overdue notification)
INSERT INTO payments (
  request_id,
  landlord_id,
  tenant_id,
  post_id,
  amount,
  due_date,
  status,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent,
  overdue_notif_sent,
  created_at
)
VALUES (
  (SELECT id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT user_id FROM posts WHERE id = (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1)),
  (SELECT user_id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1),
  5000,
  (CURRENT_DATE - INTERVAL '2 days')::date, -- Overdue by 2 days
  'unpaid',
  true, -- All reminders already sent
  true,
  true,
  false, -- Overdue notification not sent yet
  NOW()
);

-- SCENARIO 5: Payment due in 7 days (should not trigger anything yet)
INSERT INTO payments (
  request_id,
  landlord_id,
  tenant_id,
  post_id,
  amount,
  due_date,
  status,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent,
  overdue_notif_sent,
  created_at
)
VALUES (
  (SELECT id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT user_id FROM posts WHERE id = (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1)),
  (SELECT user_id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1),
  5000,
  (CURRENT_DATE + INTERVAL '7 days')::date, -- Due in 7 days
  'unpaid',
  false, -- No reminders sent yet
  false,
  false,
  false,
  NOW()
);

-- ==========================================
-- PART 5: VERIFY TEST DATA
-- ==========================================
-- Run these queries to verify the test payments were created correctly

-- View all test payments with user information
SELECT 
  p.id,
  p.amount,
  p.due_date,
  p.status,
  p.reminder_3day_sent,
  p.reminder_1day_sent,
  p.reminder_duedate_sent,
  p.overdue_notif_sent,
  t.firstname || ' ' || t.lastname as tenant_name,
  l.firstname || ' ' || l.lastname as landlord_name,
  po.title as property_title,
  CASE 
    WHEN p.due_date = CURRENT_DATE THEN 'DUE TODAY'
    WHEN p.due_date < CURRENT_DATE THEN 'OVERDUE (' || (CURRENT_DATE - p.due_date) || ' days)'
    WHEN p.due_date > CURRENT_DATE THEN 'DUE IN ' || (p.due_date - CURRENT_DATE) || ' days'
  END as payment_status
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN users l ON p.landlord_id = l.id
JOIN posts po ON p.post_id = po.id
WHERE p.created_at > NOW() - INTERVAL '1 hour' -- Only show recently created payments
ORDER BY p.due_date;

-- ==========================================
-- PART 6: TESTING INSTRUCTIONS
-- ==========================================

/*
HOW TO TEST:

1. RUN THIS SQL SCRIPT
   - Execute in Supabase SQL editor
   - Verify 5 test payments are created

2. OPEN YOUR APP
   - Wait 3 seconds for the usePaymentNotifications hook to run
   - You should immediately see notifications for:
     * Payment due in 3 days
     * Payment due tomorrow
     * Payment due today
     * Payment overdue by 2 days

3. CHECK NOTIFICATIONS
   - You should receive 4 notifications (one for each scenario)
   - Each notification should show correct amount and due date
   - Test both student and landlord accounts if possible

4. TEST NAVIGATION
   - Tap each notification
   - Verify it navigates to the correct payment screen
   - Student → /(protected)/ratings/payment-calendar
   - Landlord → /(protected)/landlord-rentals/payment-calendar

5. TEST PAYMENT MARKING
   - Mark one payment as paid in the app
   - Verify notification flags are reset
   - Confirm no more reminders for that payment

6. VERIFY DATABASE UPDATES
   - Run the verification query above
   - Check that notification flags are updated to TRUE after notifications are sent

7. TEST SCHEDULED NOTIFICATIONS
   - The payment due in 7 days won't trigger anything yet
   - In 4 days, it should trigger the 3-day reminder
   - To test immediately, update its due_date to 3 days from now

EXPECTED RESULTS:

✅ 4 immediate notifications (3-day, 1-day, due today, overdue)
✅ Each notification has correct messaging
✅ Navigation works from notifications
✅ Database flags updated after notifications sent
✅ No duplicate notifications
✅ Marking payment as paid cancels future reminders

TROUBLESHOOTING:

❌ No notifications appearing?
   - Check notification permissions are granted
   - Verify app is in foreground or background (not force closed)
   - Check console logs for errors

❌ Wrong notification content?
   - Verify user names are in database
   - Check post title exists
   - Verify amounts are correct

❌ Notifications not updating database?
   - Check Supabase RLS policies
   - Verify user has permission to update payments table
   - Check console logs for database errors

❌ Duplicate notifications?
   - Check database flags are being updated
   - Verify hook is only running once
   - Check for duplicate payment records
*/

-- ==========================================
-- PART 7: CLEANUP (Run after testing)
-- ==========================================

/*
-- Delete test payments
DELETE FROM payments 
WHERE created_at > NOW() - INTERVAL '1 hour' 
AND request_id IN (SELECT id FROM requests WHERE id LIKE 'test-%');

-- Delete test request
DELETE FROM requests WHERE id LIKE 'test-%';

-- Delete test post
DELETE FROM posts WHERE id LIKE 'test-%';

-- Delete test users
DELETE FROM users WHERE id LIKE 'test-%';
*/

-- ==========================================
-- PART 8: ADVANCED TESTING SCENARIOS
-- ==========================================

/*
-- Test multiple payments for same tenant (to verify batch notifications work)
INSERT INTO payments (request_id, landlord_id, tenant_id, post_id, amount, due_date, status, reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent, overdue_notif_sent)
SELECT 
  (SELECT id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT user_id FROM posts WHERE id = (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1)),
  (SELECT user_id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1),
  5000,
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  false, false, false, false
FROM generate_series(1, 3); -- Creates 3 duplicate payments

-- Test edge case: Payment due at midnight
INSERT INTO payments (request_id, landlord_id, tenant_id, post_id, amount, due_date, status, reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent, overdue_notif_sent)
VALUES (
  (SELECT id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT user_id FROM posts WHERE id = (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1)),
  (SELECT user_id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1),
  5000,
  CURRENT_DATE, -- Today at midnight
  'unpaid',
  false, false, false, false
);

-- Test large payment amount (formatting test)
INSERT INTO payments (request_id, landlord_id, tenant_id, post_id, amount, due_date, status, reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent, overdue_notif_sent)
VALUES (
  (SELECT id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT user_id FROM posts WHERE id = (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1)),
  (SELECT user_id FROM requests WHERE confirmed = true LIMIT 1),
  (SELECT post_id FROM requests WHERE confirmed = true LIMIT 1),
  999999, -- Large amount to test formatting
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  false, false, false, false
);
*/

-- ==========================================
-- QUICK REFERENCE: Update Due Dates
-- ==========================================

/*
-- To test 3-day reminder immediately:
UPDATE payments 
SET due_date = (CURRENT_DATE + INTERVAL '3 days')::date,
    reminder_3day_sent = false
WHERE id = 'YOUR_PAYMENT_ID';

-- To test 1-day reminder immediately:
UPDATE payments 
SET due_date = (CURRENT_DATE + INTERVAL '1 day')::date,
    reminder_3day_sent = true,
    reminder_1day_sent = false
WHERE id = 'YOUR_PAYMENT_ID';

-- To test due date reminder immediately:
UPDATE payments 
SET due_date = CURRENT_DATE,
    reminder_3day_sent = true,
    reminder_1day_sent = true,
    reminder_duedate_sent = false
WHERE id = 'YOUR_PAYMENT_ID';

-- To test overdue notification immediately:
UPDATE payments 
SET due_date = (CURRENT_DATE - INTERVAL '2 days')::date,
    reminder_3day_sent = true,
    reminder_1day_sent = true,
    reminder_duedate_sent = true,
    overdue_notif_sent = false
WHERE id = 'YOUR_PAYMENT_ID';
*/

-- ==========================================
-- END OF TEST SQL
-- ==========================================

COMMENT ON TABLE payments IS 'Test SQL executed - Check the verification query results above';
