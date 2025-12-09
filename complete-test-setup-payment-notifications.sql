-- ==========================================
-- COMPLETE TEST SETUP - Payment Notifications
-- ==========================================
-- This script creates ALL test data from scratch
-- No prerequisites needed - works with empty database
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==========================================
-- STEP 1: CREATE TEST USERS
-- ==========================================

-- Create Test Student (Tenant)
INSERT INTO users (
  id,
  firstname,
  lastname,
  email,
  contact,
  accountType,
  created_at
) VALUES (
  'test-student-' || gen_random_uuid()::text,
  'Test',
  'Student',
  'test.student@example.com',
  '09123456789',
  'student',
  NOW()
)
ON CONFLICT (email) DO UPDATE 
  SET firstname = EXCLUDED.firstname
RETURNING id as student_id;

-- Store student ID (you'll need to copy this)
DO $$
DECLARE
  v_student_id TEXT;
BEGIN
  SELECT id INTO v_student_id 
  FROM users 
  WHERE email = 'test.student@example.com';
  
  RAISE NOTICE 'Student ID: %', v_student_id;
END $$;

-- Create Test Landlord
INSERT INTO users (
  id,
  firstname,
  lastname,
  email,
  contact,
  accountType,
  created_at
) VALUES (
  'test-landlord-' || gen_random_uuid()::text,
  'Test',
  'Landlord',
  'test.landlord@example.com',
  '09187654321',
  'landlord',
  NOW()
)
ON CONFLICT (email) DO UPDATE 
  SET firstname = EXCLUDED.firstname
RETURNING id as landlord_id;

-- ==========================================
-- STEP 2: CREATE TEST PROPERTY POST
-- ==========================================

INSERT INTO posts (
  id,
  user_id,
  title,
  body,
  address,
  houseType,
  bedrooms,
  bathrooms,
  monthlyRent,
  latitude,
  longitude,
  created_at
)
SELECT 
  gen_random_uuid(),
  u.id,
  'Test Property - Sunset View Apartment',
  'Beautiful 2-bedroom apartment for testing notifications',
  'USTP Campus, Cagayan de Oro',
  'Apartment',
  2,
  1,
  5000,
  8.4857,
  124.6565,
  NOW()
FROM users u
WHERE u.email = 'test.landlord@example.com'
RETURNING id as post_id, title;

-- ==========================================
-- STEP 3: CREATE CONFIRMED RENTAL REQUEST
-- ==========================================

INSERT INTO requests (
  id,
  user_id,
  post_id,
  requestTime,
  endTime,
  confirmed,
  created_at
)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM users WHERE email = 'test.student@example.com'),
  p.id,
  CURRENT_DATE,
  (CURRENT_DATE + INTERVAL '6 months')::date,
  true,
  NOW()
FROM posts p
WHERE p.title = 'Test Property - Sunset View Apartment'
RETURNING id as request_id;

-- ==========================================
-- STEP 4: CREATE TEST PAYMENTS
-- ==========================================

-- Get the IDs we need
DO $$
DECLARE
  v_request_id UUID;
  v_post_id UUID;
  v_landlord_id TEXT;
  v_tenant_id TEXT;
BEGIN
  -- Get the test request
  SELECT r.id, r.post_id, p.user_id, r.user_id
  INTO v_request_id, v_post_id, v_landlord_id, v_tenant_id
  FROM requests r
  JOIN posts p ON r.post_id = p.id
  WHERE p.title = 'Test Property - Sunset View Apartment'
  AND r.confirmed = true
  LIMIT 1;

  -- 1. Payment due in 3 days (triggers 3-day reminder)
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
    overdue_notif_sent
  ) VALUES (
    v_request_id,
    v_landlord_id,
    v_tenant_id,
    v_post_id,
    5000,
    (CURRENT_DATE + INTERVAL '3 days')::date,
    'unpaid',
    false, false, false, false
  );

  -- 2. Payment due tomorrow (triggers 1-day reminder)
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
    overdue_notif_sent
  ) VALUES (
    v_request_id,
    v_landlord_id,
    v_tenant_id,
    v_post_id,
    5000,
    (CURRENT_DATE + INTERVAL '1 day')::date,
    'unpaid',
    true, false, false, false
  );

  -- 3. Payment due today (triggers due date reminder)
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
    overdue_notif_sent
  ) VALUES (
    v_request_id,
    v_landlord_id,
    v_tenant_id,
    v_post_id,
    5000,
    CURRENT_DATE,
    'unpaid',
    true, true, false, false
  );

  -- 4. Payment overdue (triggers overdue notification)
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
    overdue_notif_sent
  ) VALUES (
    v_request_id,
    v_landlord_id,
    v_tenant_id,
    v_post_id,
    5000,
    (CURRENT_DATE - INTERVAL '2 days')::date,
    'unpaid',
    true, true, true, false
  );

  RAISE NOTICE 'Created 4 test payments!';
END $$;

-- ==========================================
-- STEP 5: VERIFY TEST DATA
-- ==========================================

SELECT 
  '✅ TEST DATA CREATED SUCCESSFULLY!' as status;

-- Show test users
SELECT 
  '👥 TEST USERS' as section,
  u.id,
  u.firstname || ' ' || u.lastname as name,
  u.email,
  u.accountType
FROM users u
WHERE u.email IN ('test.student@example.com', 'test.landlord@example.com')
ORDER BY u.accountType;

-- Show test property
SELECT 
  '🏠 TEST PROPERTY' as section,
  p.id,
  p.title,
  p.address,
  p.monthlyRent,
  u.firstname || ' ' || u.lastname as landlord
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.title = 'Test Property - Sunset View Apartment';

-- Show test rental request
SELECT 
  '📋 TEST RENTAL REQUEST' as section,
  r.id,
  r.confirmed,
  r.requestTime,
  r.endTime,
  p.title as property,
  t.firstname || ' ' || t.lastname as tenant
FROM requests r
JOIN posts p ON r.post_id = p.id
JOIN users t ON r.user_id = t.id
WHERE p.title = 'Test Property - Sunset View Apartment';

-- Show test payments with notification status
SELECT 
  '💰 TEST PAYMENTS' as section,
  p.id,
  p.amount,
  p.due_date,
  CASE 
    WHEN p.due_date = CURRENT_DATE THEN '🟡 DUE TODAY'
    WHEN p.due_date < CURRENT_DATE THEN '🔴 OVERDUE (' || (CURRENT_DATE - p.due_date) || 'd)'
    WHEN p.due_date - CURRENT_DATE = 1 THEN '🟠 DUE TOMORROW'
    WHEN p.due_date - CURRENT_DATE = 3 THEN '🟢 DUE IN 3 DAYS'
    ELSE '⚪ DUE IN ' || (p.due_date - CURRENT_DATE) || ' days'
  END as payment_status,
  p.reminder_3day_sent as "3day_sent",
  p.reminder_1day_sent as "1day_sent",
  p.reminder_duedate_sent as "due_sent",
  p.overdue_notif_sent as "overdue_sent",
  t.firstname || ' ' || t.lastname as tenant,
  po.title as property
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN posts po ON p.post_id = po.id
WHERE po.title = 'Test Property - Sunset View Apartment'
ORDER BY p.due_date;

-- ==========================================
-- INSTRUCTIONS
-- ==========================================

/*
✅ SETUP COMPLETE!

WHAT TO DO NEXT:

1. ✅ Test data is now created (4 payments with different due dates)

2. 📱 OPEN YOUR APP:
   - If app is closed: Open it
   - If app is open: Close and reopen it
   - Or: Put app in background and bring to foreground

3. ⏱️ WAIT 3 SECONDS

4. 🔔 YOU SHOULD RECEIVE 4 NOTIFICATIONS:
   • 💰 Payment due in 3 days: ₱5,000 for Test Property - Sunset View Apartment
   • 💰 Payment due tomorrow: ₱5,000 for Test Property - Sunset View Apartment
   • 💰 Payment due today: ₱5,000 for Test Property - Sunset View Apartment
   • ⚠️ Payment overdue: ₱5,000 for Test Property - Sunset View Apartment is 2 day(s) overdue

5. ✅ TEST CHECKLIST:
   □ Receive all 4 notifications
   □ Tap each notification → should navigate to payment screen
   □ Check notifications appear for both perspectives:
     - Student view: "Your payment..."
     - Landlord view: "Payment from [Student Name]..."
   □ Mark one payment as paid → verify no more reminders for it
   □ Re-run verification query → see notification flags updated to TRUE

6. 🔄 TEST LOGIN AS BOTH USERS:

   For STUDENT perspective:
   - Email: test.student@example.com
   - You'll see: "Your payment due in X days..."
   
   For LANDLORD perspective:
   - Email: test.landlord@example.com
   - You'll see: "Payment from Test Student due in X days..."

7. 🧹 CLEANUP AFTER TESTING:
   Run the cleanup script below to remove all test data
*/

-- ==========================================
-- CLEANUP SCRIPT (Run after testing)
-- ==========================================

/*
-- Delete test payments
DELETE FROM payments 
WHERE post_id IN (
  SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment'
);

-- Delete test rental request
DELETE FROM requests 
WHERE post_id IN (
  SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment'
);

-- Delete test property
DELETE FROM posts WHERE title = 'Test Property - Sunset View Apartment';

-- Delete test users
DELETE FROM users WHERE email IN ('test.student@example.com', 'test.landlord@example.com');

SELECT '✅ TEST DATA CLEANED UP!' as status;
*/
