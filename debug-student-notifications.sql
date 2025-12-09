-- ==========================================
-- DEBUG STUDENT NOTIFICATIONS
-- ==========================================
-- Run this to debug why student notifications aren't working
-- ==========================================

-- 1. Check your user's account type
SELECT 
  id,
  firstname,
  lastname,
  email,
  accountType as account_type
FROM users
WHERE firstname = 'Giann' AND lastname = 'Asdff';

-- 2. Check if you have payments as a tenant
SELECT 
  p.id,
  p.amount,
  p.due_date,
  p.status,
  p.tenant_id,
  p.landlord_id,
  p.reminder_3day_sent,
  p.reminder_1day_sent,
  p.reminder_duedate_sent,
  CASE 
    WHEN p.due_date = CURRENT_DATE THEN '🟡 DUE TODAY'
    WHEN p.due_date < CURRENT_DATE THEN '🔴 OVERDUE'
    WHEN p.due_date - CURRENT_DATE = 1 THEN '🟠 DUE TOMORROW'
    WHEN p.due_date - CURRENT_DATE = 3 THEN '🟢 DUE IN 3 DAYS'
    ELSE '⚪ DUE IN ' || (p.due_date - CURRENT_DATE) || ' days'
  END as payment_status
FROM payments p
WHERE p.tenant_id = (SELECT id FROM users WHERE firstname = 'Giann' AND lastname = 'Asdff')
AND p.status = 'unpaid'
ORDER BY p.due_date;

-- 3. Check what Clerk user ID is being used
-- Run this in your app console:
-- console.log('Clerk User ID:', user?.id);
-- console.log('Account Type:', accountType);

-- 4. Verify the tenant_id matches your Clerk ID
SELECT 
  'Checking if tenant_id matches Clerk user ID' as check_description,
  p.tenant_id,
  u.id as user_id_from_db,
  CASE 
    WHEN p.tenant_id = u.id THEN '✅ MATCH'
    ELSE '❌ MISMATCH - This is the problem!'
  END as match_status
FROM payments p
JOIN users u ON u.firstname = 'Giann' AND u.lastname = 'Asdff'
WHERE p.tenant_id = u.id
LIMIT 1;

/*
COMMON ISSUES:

Issue 1: Account Type Detection
--------------------------------------------------
Problem: accountType is 'landlord' when it should be 'student'
Fix: Check users table accountType column
    
Expected Console Log:
  🔍 Checking for payment notifications... { userId: 'xxx', isLandlord: false }

If you see isLandlord: true, that's the problem!

Issue 2: User ID Mismatch
--------------------------------------------------
Problem: Clerk user.id doesn't match payments.tenant_id
Fix: Payments might be created with different user ID

Check: Your Clerk ID vs tenant_id in payments table

Issue 3: Flags Already Set
--------------------------------------------------
Problem: All flags are TRUE from previous test
Fix: Reset flags with:
    UPDATE payments SET reminder_3day_sent = FALSE, 
    reminder_1day_sent = FALSE, reminder_duedate_sent = FALSE 
    WHERE tenant_id = (SELECT id FROM users WHERE firstname = 'Giann');

Issue 4: Date Calculation
--------------------------------------------------
Problem: Due dates don't match the calculated notification dates
Example: If payment is due Dec 12, and today is Dec 9:
  - threeDaysDate = Dec 12 ✅ (should match)
  - oneDayDate = Dec 10 ❌ (won't match until Dec 11)
  
This is CORRECT behavior - notifications fire on specific days!

WHAT TO DO NEXT:
1. Run the queries above
2. Share the results
3. Check console logs for:
   - 🔍 Checking for payment notifications... { userId: 'xxx', isLandlord: ? }
   - ✅ Sent 3-day reminder for payment xxx (student)
4. Tell me what you see!
*/
