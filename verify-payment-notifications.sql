-- ==========================================
-- VERIFICATION QUERIES - Payment Notifications
-- ==========================================
-- Run these queries to verify the notification system is working
-- ==========================================

-- ==========================================
-- 1. CHECK ALL PAYMENTS WITH NOTIFICATION STATUS
-- ==========================================

SELECT 
  '📊 ALL PAYMENTS OVERVIEW' as report_type,
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid_count,
  COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
  COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status = 'unpaid') as overdue_count
FROM payments;

-- ==========================================
-- 2. PAYMENTS NEEDING NOTIFICATIONS TODAY
-- ==========================================

-- Payments that should trigger 3-day reminder
SELECT 
  '🟢 3-DAY REMINDERS NEEDED' as notification_type,
  p.id,
  p.amount,
  p.due_date,
  p.due_date - CURRENT_DATE as days_until_due,
  p.reminder_3day_sent,
  p.notification_3day_id,
  t.firstname || ' ' || t.lastname as tenant,
  l.firstname || ' ' || l.lastname as landlord,
  po.title as property
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN users l ON p.landlord_id = l.id
JOIN posts po ON p.post_id = po.id
WHERE p.status = 'unpaid'
  AND p.due_date = (CURRENT_DATE + INTERVAL '3 days')::date
  AND p.reminder_3day_sent = false
ORDER BY p.due_date;

-- Payments that should trigger 1-day reminder
SELECT 
  '🟠 1-DAY REMINDERS NEEDED' as notification_type,
  p.id,
  p.amount,
  p.due_date,
  p.due_date - CURRENT_DATE as days_until_due,
  p.reminder_1day_sent,
  p.notification_1day_id,
  t.firstname || ' ' || t.lastname as tenant,
  l.firstname || ' ' || l.lastname as landlord,
  po.title as property
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN users l ON p.landlord_id = l.id
JOIN posts po ON p.post_id = po.id
WHERE p.status = 'unpaid'
  AND p.due_date = (CURRENT_DATE + INTERVAL '1 day')::date
  AND p.reminder_1day_sent = false
ORDER BY p.due_date;

-- Payments that should trigger due date reminder
SELECT 
  '🟡 DUE TODAY REMINDERS NEEDED' as notification_type,
  p.id,
  p.amount,
  p.due_date,
  p.reminder_duedate_sent,
  p.notification_duedate_id,
  t.firstname || ' ' || t.lastname as tenant,
  l.firstname || ' ' || l.lastname as landlord,
  po.title as property
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN users l ON p.landlord_id = l.id
JOIN posts po ON p.post_id = po.id
WHERE p.status = 'unpaid'
  AND p.due_date = CURRENT_DATE
  AND p.reminder_duedate_sent = false
ORDER BY p.due_date;

-- Payments that should trigger overdue notification
SELECT 
  '🔴 OVERDUE REMINDERS NEEDED' as notification_type,
  p.id,
  p.amount,
  p.due_date,
  CURRENT_DATE - p.due_date as days_overdue,
  p.overdue_notif_sent,
  t.firstname || ' ' || t.lastname as tenant,
  l.firstname || ' ' || l.lastname as landlord,
  po.title as property
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN users l ON p.landlord_id = l.id
JOIN posts po ON p.post_id = po.id
WHERE p.status = 'unpaid'
  AND p.due_date < CURRENT_DATE
  AND p.overdue_notif_sent = false
ORDER BY p.due_date;

-- ==========================================
-- 3. NOTIFICATION STATISTICS
-- ==========================================

SELECT 
  '📈 NOTIFICATION STATISTICS' as report_type,
  COUNT(*) as total_unpaid_payments,
  COUNT(*) FILTER (WHERE reminder_3day_sent = true) as sent_3day_reminders,
  COUNT(*) FILTER (WHERE reminder_1day_sent = true) as sent_1day_reminders,
  COUNT(*) FILTER (WHERE reminder_duedate_sent = true) as sent_duedate_reminders,
  COUNT(*) FILTER (WHERE overdue_notif_sent = true) as sent_overdue_notifications,
  COUNT(*) FILTER (WHERE 
    reminder_3day_sent = false 
    AND due_date = (CURRENT_DATE + INTERVAL '3 days')::date
  ) as pending_3day_reminders,
  COUNT(*) FILTER (WHERE 
    reminder_1day_sent = false 
    AND due_date = (CURRENT_DATE + INTERVAL '1 day')::date
  ) as pending_1day_reminders,
  COUNT(*) FILTER (WHERE 
    reminder_duedate_sent = false 
    AND due_date = CURRENT_DATE
  ) as pending_duedate_reminders,
  COUNT(*) FILTER (WHERE 
    overdue_notif_sent = false 
    AND due_date < CURRENT_DATE
  ) as pending_overdue_notifications
FROM payments
WHERE status = 'unpaid';

-- ==========================================
-- 4. DETAILED PAYMENT VIEW WITH ALL FLAGS
-- ==========================================

SELECT 
  '📋 DETAILED PAYMENT STATUS' as report_type,
  p.id,
  p.amount,
  p.due_date,
  p.status,
  CASE 
    WHEN p.due_date = CURRENT_DATE THEN '🟡 DUE TODAY'
    WHEN p.due_date < CURRENT_DATE THEN '🔴 OVERDUE (' || (CURRENT_DATE - p.due_date) || 'd)'
    WHEN p.due_date - CURRENT_DATE = 1 THEN '🟠 DUE TOMORROW'
    WHEN p.due_date - CURRENT_DATE = 3 THEN '🟢 DUE IN 3 DAYS'
    WHEN p.due_date - CURRENT_DATE <= 7 THEN '⚪ DUE IN ' || (p.due_date - CURRENT_DATE) || ' days'
    ELSE '⚪ DUE IN ' || (p.due_date - CURRENT_DATE) || ' days'
  END as payment_status,
  -- Notification sent flags
  p.reminder_3day_sent as "3day_✓",
  p.reminder_1day_sent as "1day_✓",
  p.reminder_duedate_sent as "due_✓",
  p.overdue_notif_sent as "overdue_✓",
  -- Notification IDs (for debugging)
  CASE 
    WHEN p.notification_3day_id IS NOT NULL THEN '✓ Scheduled'
    ELSE '✗ Not scheduled'
  END as "3day_scheduled",
  CASE 
    WHEN p.notification_1day_id IS NOT NULL THEN '✓ Scheduled'
    ELSE '✗ Not scheduled'
  END as "1day_scheduled",
  CASE 
    WHEN p.notification_duedate_id IS NOT NULL THEN '✓ Scheduled'
    ELSE '✗ Not scheduled'
  END as "duedate_scheduled",
  -- User info
  t.firstname || ' ' || t.lastname as tenant,
  l.firstname || ' ' || l.lastname as landlord,
  po.title as property,
  -- Timestamps
  p.created_at,
  p.updated_at
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN users l ON p.landlord_id = l.id
JOIN posts po ON p.post_id = po.id
WHERE p.status = 'unpaid'
ORDER BY p.due_date;

-- ==========================================
-- 5. RECENT PAYMENT CHANGES (Last 24 hours)
-- ==========================================

SELECT 
  '🕐 RECENT PAYMENT ACTIVITY' as report_type,
  p.id,
  p.amount,
  p.due_date,
  p.status,
  CASE 
    WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN '🆕 Created'
    WHEN p.updated_at > NOW() - INTERVAL '24 hours' THEN '✏️ Updated'
    ELSE '📅 Older'
  END as activity,
  p.reminder_3day_sent,
  p.reminder_1day_sent,
  p.reminder_duedate_sent,
  p.overdue_notif_sent,
  t.firstname || ' ' || t.lastname as tenant,
  po.title as property,
  p.created_at,
  p.updated_at
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN posts po ON p.post_id = po.id
WHERE p.created_at > NOW() - INTERVAL '24 hours'
   OR p.updated_at > NOW() - INTERVAL '24 hours'
ORDER BY COALESCE(p.updated_at, p.created_at) DESC;

-- ==========================================
-- 6. TEST DATA CHECK
-- ==========================================

SELECT 
  '🧪 TEST DATA STATUS' as report_type,
  COUNT(*) as test_payment_count,
  COUNT(*) FILTER (WHERE p.reminder_3day_sent OR p.reminder_1day_sent OR p.reminder_duedate_sent OR p.overdue_notif_sent) as notifications_sent
FROM payments p
JOIN posts po ON p.post_id = po.id
WHERE po.title = 'Test Property - Sunset View Apartment'
   OR p.created_at > NOW() - INTERVAL '1 hour';

-- Show test payments detail
SELECT 
  '🧪 TEST PAYMENTS DETAIL' as report_type,
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
  p.reminder_3day_sent as "3d",
  p.reminder_1day_sent as "1d",
  p.reminder_duedate_sent as "dd",
  p.overdue_notif_sent as "od",
  t.firstname || ' ' || t.lastname as tenant,
  po.title as property
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN posts po ON p.post_id = po.id
WHERE po.title = 'Test Property - Sunset View Apartment'
   OR p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.due_date;

-- ==========================================
-- INSTRUCTIONS
-- ==========================================

/*
HOW TO USE THESE QUERIES:

1. 📊 BEFORE TESTING:
   - Run query #1 to see overall payment statistics
   - Run query #2 to see which notifications should be triggered
   - Run query #3 to see notification statistics

2. 🔔 AFTER OPENING APP:
   - Wait 3 seconds after opening/foregrounding app
   - Run query #3 again to see if notification flags changed to TRUE
   - Run query #5 to see recent payment changes

3. ✅ VERIFY NOTIFICATIONS WERE SENT:
   - Check if reminder_3day_sent changed from FALSE to TRUE
   - Check if reminder_1day_sent changed from FALSE to TRUE
   - Check if reminder_duedate_sent changed from FALSE to TRUE
   - Check if overdue_notif_sent changed from FALSE to TRUE

4. 🐛 DEBUGGING:
   - If no notifications appeared: Check query #2 to confirm payments exist
   - If flags didn't update: Check app logs for errors
   - If notifications scheduled but not sent: Check device notification permissions

5. 🧪 TEST DATA:
   - Run query #6 to verify test data is created
   - Shows payment count and notification status

EXPECTED BEHAVIOR:
✓ App opens/foregrounds → usePaymentNotifications hook runs
✓ Hook scans all unpaid payments → finds ones needing notifications
✓ Sends immediate notifications → updates database flags to TRUE
✓ User receives notifications on device
✓ Tapping notification → navigates to payment screen
*/
