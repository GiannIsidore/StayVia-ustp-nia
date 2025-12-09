-- ==========================================
-- EDGE CASES TEST SQL - Payment Notifications
-- ==========================================
-- Tests edge cases and boundary conditions

-- ==========================================
-- 1. EDGE CASE: Payment at month boundary
-- ==========================================
-- Test payment due on the last day of month vs first day of next month

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT 
  r.id, p.user_id, r.user_id, r.post_id,
  5000,
  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day', -- Last day of current month
  'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 2. EDGE CASE: Very large payment amount
-- ==========================================
-- Test number formatting with large amounts

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT 
  r.id, p.user_id, r.user_id, r.post_id,
  999999999, -- Nearly 1 billion pesos
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 3. EDGE CASE: Zero amount payment
-- ==========================================
-- Test handling of free/promotional rentals

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT 
  r.id, p.user_id, r.user_id, r.post_id,
  0, -- Free payment
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 4. EDGE CASE: Payment already paid but flag not set
-- ==========================================
-- Test system doesn't send notification for paid payments

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status, payment_date,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT 
  r.id, p.user_id, r.user_id, r.post_id,
  5000,
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'paid',
  CURRENT_DATE,
  false, false, false -- Flags false but status is paid
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 5. EDGE CASE: Payment due on leap day
-- ==========================================
-- Test date handling for Feb 29 (only runs in leap years)

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT 
  r.id, p.user_id, r.user_id, r.post_id,
  5000,
  CASE 
    WHEN EXTRACT(YEAR FROM CURRENT_DATE) % 4 = 0 THEN -- Is leap year
      date_trunc('year', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '28 days'
    ELSE
      date_trunc('year', CURRENT_DATE) + INTERVAL '1 year' + INTERVAL '1 month' + INTERVAL '28 days'
  END,
  'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 6. EDGE CASE: Multiple payments same day
-- ==========================================
-- Test batching notifications for multiple payments due same day

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT 
  r.id, p.user_id, r.user_id, r.post_id,
  5000 + (gs * 1000), -- Different amounts: 6000, 7000, 8000
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true
LIMIT 1
CROSS JOIN generate_series(1, 3) as gs;

-- ==========================================
-- 7. EDGE CASE: Payment extremely overdue
-- ==========================================
-- Test notification for payment 100 days overdue

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent, overdue_notif_sent
)
SELECT 
  r.id, p.user_id, r.user_id, r.post_id,
  5000,
  (CURRENT_DATE - INTERVAL '100 days')::date,
  'unpaid',
  true, true, true, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 8. EDGE CASE: Payment with null/missing user data
-- ==========================================
-- Test graceful handling of missing user information

-- First create a test user with minimal data
INSERT INTO users (id, email, firstname, lastname)
VALUES ('test-minimal-user', 'minimal@test.com', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Create payment with this user
INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT 
  r.id, 
  p.user_id,
  'test-minimal-user', -- User with null names
  r.post_id,
  5000,
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 9. EDGE CASE: Payment with very long property title
-- ==========================================
-- Test notification truncation/handling of long text

-- Create test post with long title
INSERT INTO posts (id, user_id, title, price_per_night, availability)
SELECT 
  'test-long-title-post',
  user_id,
  'This is an extremely long property title that tests whether the notification system can handle very long strings without breaking or causing UI issues in the notification banner which has limited space',
  5000,
  true
FROM posts
WHERE availability = true LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Create payment for this post
INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT 
  r.id,
  p.user_id,
  r.user_id,
  'test-long-title-post',
  5000,
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 10. EDGE CASE: All flags already true
-- ==========================================
-- Test that no notifications are sent when all flags are true

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent, overdue_notif_sent
)
SELECT 
  r.id, p.user_id, r.user_id, r.post_id,
  5000,
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  true, true, true, true -- All flags already true
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 11. EDGE CASE: Payment due in past but all reminders not sent
-- ==========================================
-- Test system catches up on missed reminders

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent, overdue_notif_sent
)
SELECT 
  r.id, p.user_id, r.user_id, r.post_id,
  5000,
  (CURRENT_DATE - INTERVAL '5 days')::date, -- 5 days overdue
  'unpaid',
  false, false, false, false -- No reminders sent at all
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- 12. EDGE CASE: Payment with special characters in title
-- ==========================================
-- Test handling of special characters

INSERT INTO posts (id, user_id, title, price_per_night, availability)
SELECT 
  'test-special-chars-post',
  user_id,
  'Property with "Special" Characters & Symbols: $100/night!',
  5000,
  true
FROM posts
WHERE availability = true LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT 
  r.id, p.user_id, r.user_id,
  'test-special-chars-post',
  5000,
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;

-- ==========================================
-- VERIFICATION QUERY
-- ==========================================
-- View all edge case test payments

SELECT 
  p.id,
  p.amount,
  p.due_date,
  p.status,
  CASE 
    WHEN p.amount > 1000000 THEN '💰 LARGE AMOUNT'
    WHEN p.amount = 0 THEN '🎁 FREE'
    WHEN p.due_date < CURRENT_DATE - INTERVAL '50 days' THEN '🔴 VERY OVERDUE'
    WHEN p.status = 'paid' AND NOT p.reminder_3day_sent THEN '✅ PAID BUT FLAGS FALSE'
    WHEN p.reminder_3day_sent AND p.reminder_1day_sent AND p.reminder_duedate_sent THEN '🚫 ALL FLAGS TRUE'
    ELSE '📋 NORMAL'
  END as edge_case_type,
  p.reminder_3day_sent,
  p.reminder_1day_sent,
  p.reminder_duedate_sent,
  p.overdue_notif_sent,
  t.firstname || ' ' || t.lastname as tenant,
  po.title as property
FROM payments p
LEFT JOIN users t ON p.tenant_id = t.id
LEFT JOIN posts po ON p.post_id = po.id
WHERE p.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY p.amount DESC;

-- ==========================================
-- EXPECTED BEHAVIORS
-- ==========================================

/*
EDGE CASE TEST RESULTS:

1. ✅ Month Boundary Payment
   - Should handle date correctly
   - No timezone issues

2. ✅ Large Amount (999,999,999)
   - Should format as: ₱999,999,999
   - No number overflow errors

3. ✅ Zero Amount
   - Should show: ₱0
   - No division by zero errors

4. ❌ Paid Payment with False Flags
   - Should NOT send notification (status is 'paid')
   - System respects status over flags

5. ✅ Leap Day Payment
   - Should handle Feb 29 correctly
   - No date calculation errors

6. ✅ Multiple Payments Same Day
   - Should send 3 separate notifications
   - Each with different amount

7. ✅ Very Overdue (100 days)
   - Should show: "100 day(s) overdue"
   - No calculation errors

8. ✅ Missing User Data
   - Should show: "Tenant" as fallback
   - No null reference errors

9. ✅ Long Property Title
   - Should truncate gracefully in notification
   - No UI breaking

10. ❌ All Flags True
    - Should NOT send any notification
    - System respects flags

11. ✅ Missed All Reminders (5 days overdue)
    - Should send overdue notification only
    - Not 3-day, 1-day, or due date reminders

12. ✅ Special Characters
    - Should display correctly in notification
    - No encoding issues

CLEANUP:
DELETE FROM payments WHERE created_at > NOW() - INTERVAL '5 minutes';
DELETE FROM posts WHERE id IN ('test-long-title-post', 'test-special-chars-post');
DELETE FROM users WHERE id = 'test-minimal-user';
*/
