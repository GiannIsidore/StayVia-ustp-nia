-- ==========================================
-- QUICK REPEATABLE TEST - Payment Notifications
-- ==========================================
-- Run this multiple times to test notifications
-- Each run is independent and can be repeated
-- ==========================================

-- ==========================================
-- STEP 1: SETUP (Run once, or if cleanup was done)
-- ==========================================

-- Create test users (if they don't exist)
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
ON CONFLICT (email) DO NOTHING;

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
ON CONFLICT (email) DO NOTHING;

-- Create test property (if it doesn't exist)
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
  AND NOT EXISTS (SELECT 1 FROM posts WHERE title = 'Test Property - Sunset View Apartment');

-- Create test rental request (if it doesn't exist)
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
  AND NOT EXISTS (
    SELECT 1 FROM requests r 
    WHERE r.post_id = p.id 
    AND r.confirmed = true
  );

-- ==========================================
-- STEP 2: CREATE TEST PAYMENTS (Run each time)
-- ==========================================

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

  -- Create 4 test payments
  INSERT INTO payments (
    request_id, landlord_id, tenant_id, post_id,
    amount, due_date, status,
    reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent, overdue_notif_sent
  ) VALUES
  -- Payment due in 3 days
  (v_request_id, v_landlord_id, v_tenant_id, v_post_id,
   5000, (CURRENT_DATE + INTERVAL '3 days')::date, 'unpaid',
   false, false, false, false),
  -- Payment due tomorrow
  (v_request_id, v_landlord_id, v_tenant_id, v_post_id,
   5000, (CURRENT_DATE + INTERVAL '1 day')::date, 'unpaid',
   true, false, false, false),
  -- Payment due today
  (v_request_id, v_landlord_id, v_tenant_id, v_post_id,
   5000, CURRENT_DATE, 'unpaid',
   true, true, false, false),
  -- Payment overdue
  (v_request_id, v_landlord_id, v_tenant_id, v_post_id,
   5000, (CURRENT_DATE - INTERVAL '2 days')::date, 'unpaid',
   true, true, true, false);

  RAISE NOTICE '✅ Created 4 test payments!';
END $$;

-- ==========================================
-- VERIFY: Check what was created
-- ==========================================

SELECT 
  '✅ TEST PAYMENTS CREATED!' as status,
  COUNT(*) as payment_count
FROM payments p
JOIN posts po ON p.post_id = po.id
WHERE po.title = 'Test Property - Sunset View Apartment'
  AND p.created_at > NOW() - INTERVAL '1 minute';

-- Show the payments
SELECT 
  p.id,
  '₱' || p.amount as amount,
  p.due_date,
  CASE 
    WHEN p.due_date = CURRENT_DATE THEN '🟡 DUE TODAY'
    WHEN p.due_date < CURRENT_DATE THEN '🔴 OVERDUE (' || (CURRENT_DATE - p.due_date) || ' days)'
    WHEN p.due_date - CURRENT_DATE = 1 THEN '🟠 DUE TOMORROW'
    WHEN p.due_date - CURRENT_DATE = 3 THEN '🟢 DUE IN 3 DAYS'
    ELSE '⚪ ' || (p.due_date - CURRENT_DATE) || ' days'
  END as status,
  p.reminder_3day_sent as "3d",
  p.reminder_1day_sent as "1d",
  p.reminder_duedate_sent as "dd",
  p.overdue_notif_sent as "od"
FROM payments p
JOIN posts po ON p.post_id = po.id
WHERE po.title = 'Test Property - Sunset View Apartment'
  AND p.created_at > NOW() - INTERVAL '1 minute'
ORDER BY p.due_date;

-- ==========================================
-- 📱 NOW: OPEN YOUR APP!
-- ==========================================
-- Close your app completely, then open it
-- Wait 3 seconds
-- You should receive 4 notifications!
-- ==========================================

-- ==========================================
-- AFTER TESTING: Check if notifications were sent
-- ==========================================

/*
-- Run this query AFTER opening the app:

SELECT 
  '📊 NOTIFICATION STATUS' as check,
  COUNT(*) FILTER (WHERE reminder_3day_sent = true) as "3day_sent",
  COUNT(*) FILTER (WHERE reminder_1day_sent = true) as "1day_sent",
  COUNT(*) FILTER (WHERE reminder_duedate_sent = true) as "due_sent",
  COUNT(*) FILTER (WHERE overdue_notif_sent = true) as "overdue_sent"
FROM payments p
JOIN posts po ON p.post_id = po.id
WHERE po.title = 'Test Property - Sunset View Apartment'
  AND p.created_at > NOW() - INTERVAL '2 minutes';

-- All values should be > 0 if notifications were sent!
*/

-- ==========================================
-- CLEANUP: Delete test payments (run between tests)
-- ==========================================

/*
-- Run this when you want to test again:

DELETE FROM payments 
WHERE post_id IN (
  SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment'
)
AND created_at > NOW() - INTERVAL '5 minutes';

SELECT '🧹 Test payments deleted! Ready for next test.' as status;

-- Now you can run this script again from STEP 2!
*/

-- ==========================================
-- FULL CLEANUP: Remove everything (after all testing)
-- ==========================================

/*
-- Run this when completely done testing:

DELETE FROM payments WHERE post_id IN (SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment');
DELETE FROM requests WHERE post_id IN (SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment');
DELETE FROM posts WHERE title = 'Test Property - Sunset View Apartment';
DELETE FROM users WHERE email IN ('test.student@example.com', 'test.landlord@example.com');

SELECT '✅ All test data removed!' as status;
*/
