-- ==========================================
-- QUICK TEST SQL - Payment Notifications
-- ==========================================
-- Simple version for immediate testing
-- Run this in Supabase SQL Editor

-- Prerequisites: You need at least one confirmed rental request in your database

-- ==========================================
-- CREATE 4 TEST PAYMENTS
-- ==========================================

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
)
SELECT 
  r.id,
  p.user_id,
  r.user_id,
  r.post_id,
  5000,
  (CURRENT_DATE + INTERVAL '3 days')::date,
  'unpaid',
  false, false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true
LIMIT 1;

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
)
SELECT 
  r.id,
  p.user_id,
  r.user_id,
  r.post_id,
  5000,
  (CURRENT_DATE + INTERVAL '1 day')::date,
  'unpaid',
  true, false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true
LIMIT 1;

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
)
SELECT 
  r.id,
  p.user_id,
  r.user_id,
  r.post_id,
  5000,
  CURRENT_DATE,
  'unpaid',
  true, true, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true
LIMIT 1;

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
)
SELECT 
  r.id,
  p.user_id,
  r.user_id,
  r.post_id,
  5000,
  (CURRENT_DATE - INTERVAL '2 days')::date,
  'unpaid',
  true, true, true, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true
LIMIT 1;

-- ==========================================
-- VERIFY TEST DATA
-- ==========================================

SELECT 
  p.id,
  p.amount,
  p.due_date,
  CASE 
    WHEN p.due_date = CURRENT_DATE THEN '🟡 DUE TODAY'
    WHEN p.due_date < CURRENT_DATE THEN '🔴 OVERDUE'
    WHEN p.due_date - CURRENT_DATE = 1 THEN '🟠 DUE TOMORROW'
    WHEN p.due_date - CURRENT_DATE = 3 THEN '🟢 DUE IN 3 DAYS'
    ELSE '⚪ DUE IN ' || (p.due_date - CURRENT_DATE) || ' days'
  END as status,
  p.reminder_3day_sent as "3day✓",
  p.reminder_1day_sent as "1day✓",
  p.reminder_duedate_sent as "due✓",
  p.overdue_notif_sent as "over✓",
  t.firstname || ' ' || t.lastname as tenant,
  po.title as property
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN posts po ON p.post_id = po.id
WHERE p.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY p.due_date;

-- ==========================================
-- INSTRUCTIONS
-- ==========================================

/*
WHAT TO DO NEXT:

1. Run this SQL above ☝️
2. Open your app (or bring to foreground if already open)
3. Wait 3 seconds
4. You should receive 4 notifications immediately!

EXPECTED NOTIFICATIONS:
• 💰 Payment due in 3 days: ₱5,000 for [Property Name]
• 💰 Payment due tomorrow: ₱5,000 for [Property Name]
• 💰 Payment due today: ₱5,000 for [Property Name]
• ⚠️ Payment overdue: ₱5,000 for [Property Name] is 2 day(s) overdue

TEST CHECKLIST:
□ Receive all 4 notifications
□ Tap each notification → navigates to payment screen
□ Mark one payment as paid → no more reminders for it
□ Check database (run verification query) → flags updated to TRUE

CLEANUP AFTER TESTING:
Run this to delete test payments:

DELETE FROM payments WHERE created_at > NOW() - INTERVAL '5 minutes';

*/
