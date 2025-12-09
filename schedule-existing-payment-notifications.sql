-- ==========================================
-- SCHEDULE NOTIFICATIONS FOR EXISTING PAYMENTS
-- ==========================================
-- This script is for testing System 1 (Expo Scheduled Notifications)
-- It helps you schedule notifications for payments that were created
-- before the notification system was implemented.
--
-- IMPORTANT: This is a HELPER script for testing.
-- In production, notifications are automatically scheduled when
-- rental requests are confirmed.
-- ==========================================

-- ==========================================
-- STEP 1: VIEW PAYMENTS THAT NEED SCHEDULING
-- ==========================================

SELECT 
  p.id,
  p.amount,
  p.due_date,
  p.status,
  CASE 
    WHEN p.due_date = CURRENT_DATE THEN '🟡 DUE TODAY'
    WHEN p.due_date < CURRENT_DATE THEN '🔴 OVERDUE (' || (CURRENT_DATE - p.due_date) || 'd)'
    WHEN p.due_date - CURRENT_DATE = 1 THEN '🟠 DUE TOMORROW'
    WHEN p.due_date - CURRENT_DATE = 3 THEN '🟢 DUE IN 3 DAYS'
    WHEN p.due_date > CURRENT_DATE THEN '⚪ DUE IN ' || (p.due_date - CURRENT_DATE) || ' days'
    ELSE '❓ UNKNOWN'
  END as payment_status,
  -- Check if notifications are already scheduled
  CASE 
    WHEN p.notification_3day_id IS NOT NULL THEN '✅ Has 3-day notif'
    ELSE '❌ Missing 3-day notif'
  END as "3day_notif",
  CASE 
    WHEN p.notification_1day_id IS NOT NULL THEN '✅ Has 1-day notif'
    ELSE '❌ Missing 1-day notif'
  END as "1day_notif",
  CASE 
    WHEN p.notification_duedate_id IS NOT NULL THEN '✅ Has due date notif'
    ELSE '❌ Missing due date notif'
  END as "duedate_notif",
  -- Check flag status
  p.reminder_3day_sent as "3day_sent",
  p.reminder_1day_sent as "1day_sent",
  p.reminder_duedate_sent as "due_sent",
  p.overdue_notif_sent as "overdue_sent",
  -- User info
  t.firstname || ' ' || t.lastname as tenant,
  l.firstname || ' ' || l.lastname as landlord,
  po.title as property
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN users l ON p.landlord_id = l.id
JOIN posts po ON p.post_id = po.id
WHERE p.status = 'unpaid'
  AND p.due_date >= CURRENT_DATE - INTERVAL '7 days'  -- Only payments from last 7 days forward
ORDER BY p.due_date;

-- ==========================================
-- WHAT TO DO NEXT
-- ==========================================

/*
⚠️ IMPORTANT: You CANNOT schedule Expo notifications from SQL!

Expo notifications must be scheduled from your React Native app.
This is because expo-notifications requires JavaScript runtime.

TO SCHEDULE NOTIFICATIONS FOR EXISTING PAYMENTS:

Option 1: Use the Fallback System (Recommended for Testing)
----------------------------------------------------------
The fallback system (usePaymentNotifications hook) already handles
existing payments. It will send immediate notifications when you 
open the app.

Steps:
1. Reset flags: UPDATE payments SET reminder_3day_sent = FALSE, ...
2. Open your app
3. Notifications sent immediately
4. Done!

Option 2: Create Payments Through the App (Production Flow)
------------------------------------------------------------
The proper way is to create payments through the rental confirmation flow:
1. Landlord confirms rental request
2. App calls createPaymentsForRental()
3. App calls schedulePaymentNotifications() for each payment
4. Notifications automatically scheduled for 9 AM on correct dates
5. Done!

Option 3: Add a "Re-schedule All Notifications" Feature
--------------------------------------------------------
You could add a button in your app that:
1. Fetches all unpaid payments
2. Calls schedulePaymentNotifications() for each one
3. Stores notification IDs in database

Would you like me to create this feature? Let me know!


TESTING THE DUAL SYSTEM:
-------------------------

Test System 1 (Scheduled Notifications):
1. Create a NEW payment through rental confirmation
2. Notifications will be scheduled for 9 AM
3. Wait until 9 AM or change device time to test
4. Notification fires → Listener updates database flag
5. Open app → Fallback sees flag = TRUE, skips duplicate ✅

Test System 2 (Fallback):
1. Use existing payments (like your current 6 payments)
2. Reset flags to FALSE
3. Open app
4. Fallback sends immediate notifications
5. Flags updated to TRUE
6. Done! ✅

Test Both Systems Together:
1. Create payment with due date = tomorrow
2. Scheduled notification for tomorrow 9 AM
3. If notification fires → Flag = TRUE → No duplicate ✅
4. If notification fails → Flag = FALSE → Fallback sends when app opens ✅
5. Bulletproof! 🛡️

*/

-- ==========================================
-- HELPER: Reset Flags for Testing
-- ==========================================

/*
-- Reset all notification flags to FALSE (use for testing):
UPDATE payments 
SET reminder_3day_sent = FALSE,
    reminder_1day_sent = FALSE,
    reminder_duedate_sent = FALSE,
    overdue_notif_sent = FALSE
WHERE status = 'unpaid';

-- Reset flags for specific tenant:
UPDATE payments 
SET reminder_3day_sent = FALSE,
    reminder_1day_sent = FALSE,
    reminder_duedate_sent = FALSE,
    overdue_notif_sent = FALSE
WHERE tenant_id = (SELECT id FROM users WHERE firstname = 'Giann' AND lastname = 'Asdff')
AND status = 'unpaid';
*/

-- ==========================================
-- VERIFICATION: Check System Status
-- ==========================================

-- Check how many payments have scheduled notifications:
SELECT 
  COUNT(*) as total_unpaid,
  COUNT(*) FILTER (WHERE notification_3day_id IS NOT NULL) as has_3day_scheduled,
  COUNT(*) FILTER (WHERE notification_1day_id IS NOT NULL) as has_1day_scheduled,
  COUNT(*) FILTER (WHERE notification_duedate_id IS NOT NULL) as has_duedate_scheduled,
  COUNT(*) FILTER (WHERE 
    notification_3day_id IS NULL 
    AND notification_1day_id IS NULL 
    AND notification_duedate_id IS NULL
  ) as no_scheduled_notifications
FROM payments
WHERE status = 'unpaid'
AND due_date >= CURRENT_DATE;

-- Check flag status:
SELECT 
  COUNT(*) as total_unpaid,
  COUNT(*) FILTER (WHERE reminder_3day_sent = TRUE) as sent_3day,
  COUNT(*) FILTER (WHERE reminder_1day_sent = TRUE) as sent_1day,
  COUNT(*) FILTER (WHERE reminder_duedate_sent = TRUE) as sent_duedate,
  COUNT(*) FILTER (WHERE overdue_notif_sent = TRUE) as sent_overdue,
  COUNT(*) FILTER (WHERE 
    reminder_3day_sent = FALSE 
    AND reminder_1day_sent = FALSE 
    AND reminder_duedate_sent = FALSE
  ) as no_flags_set
FROM payments
WHERE status = 'unpaid'
AND due_date >= CURRENT_DATE;

/*
INTERPRETING THE RESULTS:

If "no_scheduled_notifications" > 0:
→ Some payments don't have scheduled notifications
→ They rely on System 2 (fallback) for notifications
→ This is OKAY - fallback will handle them! ✅

If "no_flags_set" > 0 AND due date is near:
→ Notifications haven't been sent yet
→ Either waiting for scheduled time OR
→ Waiting for user to open app (fallback)
→ This is EXPECTED - system is working correctly! ✅

If "sent_3day" > "has_3day_scheduled":
→ More notifications sent than scheduled
→ Fallback system filled the gap! ✅
→ This proves the dual system is working! 🎉
*/
