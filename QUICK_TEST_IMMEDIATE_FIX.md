# 🚀 Quick Test Guide - Immediate Notification Fix

## What Was Fixed

**Problem**: Landlord gets immediate notification when approving a rental request
**Fix**: Fallback hook now skips payments that already have scheduled notifications

## 30-Second Test

### Setup

1. Open the app as a landlord
2. Have a pending rental request in notifications

### Test Steps

1. **Click "Acknowledge"** on a rental request
   - This just marks it as "requested"
   - No notifications should fire

2. **Click "Approve"** on the same request
   - You'll see a modal to set rental dates
   - Set the dates and payment day
   - Click "Save" or "Approve"

3. **Check Your Device**
   - ❌ You should NOT get an immediate notification
   - ✅ Check console logs for:
     ```
     🏠 Creating payments for rental request
     ✅ Payments created successfully
     📅 Scheduling notifications for X payments
     ✅ Scheduled 3-day reminder for payment XXX
     ```

4. **Verify Scheduled Notifications**
   - Notifications will fire at 9 AM on the scheduled dates
   - 3 days before due date
   - 1 day before due date
   - On due date

## What to Look For

### ✅ GOOD (Expected Behavior)

```
Console shows:
- "Creating payments for rental request"
- "Payments created successfully"
- "Scheduled 3-day reminder for payment XXX"

Device:
- No immediate notification pops up
- Notification appears later at scheduled time (9 AM)
```

### ❌ BAD (Bug Still Exists)

```
Console shows:
- "Creating payments for rental request"
- "Payments created successfully"
- "✅ Sent 3-day reminder for payment XXX (landlord)"  ← This means fallback fired

Device:
- Immediate notification pops up right after approval
```

## Debug Commands

If you still see immediate notifications, run these checks:

### Check Payment Record

```sql
SELECT
  id,
  due_date,
  notification_3day_id,
  notification_1day_id,
  notification_duedate_id,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent
FROM payments
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**

- `notification_3day_id` should have a value (not NULL)
- `notification_1day_id` should have a value (not NULL)
- `notification_duedate_id` should have a value (not NULL)
- All `reminder_*_sent` flags should be `false` initially

### Check Console Logs

Look for this in the console:

```
🔍 Checking for payment notifications... {
  userId: 'user_xxx',
  isLandlord: true,
  accountType: 'landlord',
  today: '2025-12-09',
  threeDaysDate: '2025-12-12',
  oneDayDate: '2025-12-10'
}
```

**If you don't see "✅ Sent 3-day reminder" immediately after approval, the fix is working!**

## Alternative Test (Faster)

Don't want to wait 3 days? Create a payment that matches today's criteria:

1. **Create Test Payment**:

```sql
INSERT INTO payments (
  landlord_id,
  tenant_id,
  post_id,
  amount,
  due_date,
  status,
  notification_3day_id,
  reminder_3day_sent
) VALUES (
  'YOUR_LANDLORD_ID',
  'SOME_TENANT_ID',
  'SOME_POST_ID',
  5000,
  CURRENT_DATE + INTERVAL '3 days',
  'unpaid',
  'test-notification-id',  -- Has scheduled notification
  false
);
```

2. **Open App**
3. **Expected**: NO immediate notification (because `notification_3day_id` is set)

4. **Test Fallback**:

```sql
-- Update to simulate missed notification
UPDATE payments
SET notification_3day_id = NULL
WHERE id = 'PAYMENT_ID';
```

5. **Close and reopen app**
6. **Expected**: Immediate notification fires (because no scheduled notification exists)

## Troubleshooting

### Issue: Still getting immediate notifications

**Check 1**: Verify the code change was applied

```bash
grep "is('notification_3day_id', null)" hooks/usePaymentNotifications.ts
```

Should return 6 matches (3 for landlord, 3 for student)

**Check 2**: Verify app reloaded

- Make sure you saved the file
- Make sure Metro bundler rebuilt
- Try force-quit and restart

**Check 3**: Check database columns exist

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'payments'
AND column_name LIKE 'notification_%';
```

Should show: `notification_3day_id`, `notification_1day_id`, `notification_duedate_id`

### Issue: No notifications at all

**Check**: Scheduled notifications might be disabled

```typescript
// In app/(protected)/_layout.tsx
usePaymentNotificationListeners(true); // Should be enabled
usePaymentNotifications(true); // Should be enabled
```

### Issue: Notifications fire but flags don't update

**This is the separate issue we fixed earlier**. Make sure:

- `usePaymentNotificationListeners` is imported and enabled in `_layout.tsx`

## Summary

✅ **Fix Applied**: Fallback hook now skips payments with scheduled notifications
✅ **Test**: Approve a rental and verify no immediate notification
✅ **Verify**: Console logs show scheduled notifications, not immediate ones
✅ **Result**: Notifications fire at correct scheduled times (9 AM, X days before due date)

---

**If you still see immediate notifications after this fix, check the console logs and database values to debug further.**
