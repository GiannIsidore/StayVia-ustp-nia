# Payment Notifications Testing Guide

## Quick Start - 5 Minutes

### Step 1: Run the SQL

```bash
# In Supabase SQL Editor, run:
quick-test-payment-notifications.sql
```

### Step 2: Open Your App

- If app is closed: Open it
- If app is open: Close and reopen, OR minimize and restore

### Step 3: Wait 3 Seconds

The `usePaymentNotifications` hook runs after 3 seconds

### Step 4: Check Notifications

You should see **4 notifications** appear:

```
📱 Notification 1:
💰 Payment Reminder
Payment due in 3 days: ₱5,000 for [Property Name]

📱 Notification 2:
💰 Payment Due Tomorrow
₱5,000 due tomorrow for [Property Name]

📱 Notification 3:
💰 Payment Due Today
₱5,000 due today for [Property Name]

📱 Notification 4:
⚠️ Payment Overdue
₱5,000 for [Property Name] is 2 day(s) overdue
```

---

## Test Scenarios

### ✅ Scenario 1: Immediate Notifications (Fallback System)

**What it tests:** The fallback hook catches missed scheduled notifications

**Steps:**

1. Run `quick-test-payment-notifications.sql`
2. Open app
3. Wait 3 seconds

**Expected Result:**

- ✅ Receive 4 notifications immediately
- ✅ Console logs: "🔍 Checking for payment notifications..."
- ✅ Console logs: "✅ Sent 3-day reminder for payment..."

**Verify in Database:**

```sql
SELECT
  due_date,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent,
  overdue_notif_sent
FROM payments
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

Should show:

- 3-day payment: `reminder_3day_sent = true`
- 1-day payment: `reminder_1day_sent = true`
- Due today: `reminder_duedate_sent = true`
- Overdue: `overdue_notif_sent = true`

---

### ✅ Scenario 2: Navigation from Notifications

**What it tests:** Tapping notifications navigates to correct screen

**Steps:**

1. Wait for notifications to appear
2. Tap the "Payment due in 3 days" notification
3. Note which screen opens

**Expected Result:**

- ✅ **Student account:** Navigate to `/(protected)/ratings/payment-calendar`
- ✅ **Landlord account:** Navigate to `/(protected)/landlord-rentals/payment-calendar`
- ✅ Payment calendar screen shows with payments list

**Test for each notification type:**

- [ ] 3-day reminder → payment calendar
- [ ] 1-day reminder → payment calendar
- [ ] Due today → payment calendar
- [ ] Overdue → payment calendar

---

### ✅ Scenario 3: Mark Payment as Paid

**What it tests:** Cancels scheduled notifications and resets flags

**Setup:**
First, create a payment with scheduled notifications:

```sql
-- Create payment due in future (so notifications are scheduled, not immediate)
INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT
  r.id, p.user_id, r.user_id, r.post_id,
  5000, (CURRENT_DATE + INTERVAL '10 days')::date, 'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1
RETURNING id, due_date;
```

**Steps:**

1. Note the payment ID from above query
2. Open app and confirm rental (this schedules notifications)
3. Check database - should see `notification_3day_id`, `notification_1day_id`, etc. filled
4. Mark payment as paid in the app
5. Check database again

**Expected Result:**

- ✅ Before: notification IDs stored in database
- ✅ After marking paid: `notification_*_id` fields set to `null`
- ✅ After marking paid: All `*_sent` flags set to `false`
- ✅ Console log: "✅ Cancelled notifications for payment: [id]"

**Verify:**

```sql
SELECT
  id,
  status,
  notification_3day_id,
  notification_1day_id,
  notification_duedate_id,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent
FROM payments
WHERE id = 'YOUR_PAYMENT_ID';
```

Should show all notification IDs as `null` and all flags as `false`

---

### ✅ Scenario 4: Scheduled Notifications (Advanced)

**What it tests:** Expo notification scheduler fires at correct time

**Setup:**

```sql
-- Create payment due exactly 3 days from now
INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent,
  notification_3day_id
)
SELECT
  r.id, p.user_id, r.user_id, r.post_id,
  5000, (CURRENT_DATE + INTERVAL '3 days')::date, 'unpaid',
  false, false, false,
  'test-notif-id' -- Dummy ID to simulate scheduled notification
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;
```

**Steps:**

1. Run SQL above
2. Confirm a new rental (to trigger notification scheduling)
3. Wait for 3 days OR manually change device time to 3 days later
4. Check if notification fires at 9:00 AM

**Expected Result:**

- ✅ Notification appears at 9:00 AM (3 days before due date)
- ✅ Notification appears even if app is closed
- ✅ Database flag updates to `reminder_3day_sent = true`

**Note:** This test requires actual waiting or device time manipulation

---

### ✅ Scenario 5: Dual Perspective (Student vs Landlord)

**What it tests:** Different notifications for student and landlord

**Setup:** You need two devices or two user accounts

**Steps:**

1. Run `quick-test-payment-notifications.sql`
2. Open app on **student account** (tenant)
3. Open app on **landlord account** (property owner)

**Expected Result:**

**Student sees:**

```
💰 Payment Reminder
Payment due in 3 days: ₱5,000 for [Property Name]
```

**Landlord sees:**

```
💰 Upcoming Payment
John Student - ₱5,000 due in 3 days
```

- ✅ Student notification mentions property name
- ✅ Landlord notification mentions tenant name
- ✅ Both navigate to their respective payment calendars

---

### ✅ Scenario 6: Multiple Payments

**What it tests:** System handles multiple payments at once

**Setup:**

```sql
-- Create 5 payments all due in 3 days
INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT
  r.id, p.user_id, r.user_id, r.post_id,
  5000, (CURRENT_DATE + INTERVAL '3 days')::date, 'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true
LIMIT 1
CROSS JOIN generate_series(1, 5);
```

**Steps:**

1. Run SQL above
2. Open app
3. Wait 3 seconds

**Expected Result:**

- ✅ Receive 5 notifications (one for each payment)
- ✅ All notifications show correct amounts
- ✅ No duplicate notifications
- ✅ All database flags updated

---

### ✅ Scenario 7: No Duplicate Notifications

**What it tests:** Flags prevent duplicate notifications

**Setup:**

```sql
-- Create payment with 3-day reminder already sent
INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT
  r.id, p.user_id, r.user_id, r.post_id,
  5000, (CURRENT_DATE + INTERVAL '3 days')::date, 'unpaid',
  true, false, false  -- 3-day reminder already sent
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true LIMIT 1;
```

**Steps:**

1. Run SQL above
2. Open app multiple times
3. Minimize and restore app multiple times

**Expected Result:**

- ✅ No notification appears (flag is already true)
- ✅ Console log: "ℹ️ No payments due for reminders"
- ✅ Database flag remains `true`

---

## Troubleshooting

### ❌ No notifications appearing

**Check:**

1. Notification permissions granted?

   ```
   Settings → App → Permissions → Notifications → Allow
   ```

2. Device not in Do Not Disturb mode?

3. App in foreground or background (not force closed)?

4. Check console logs:

   ```
   🔍 Checking for payment notifications...
   📊 Found X rentals due for rating
   ```

5. Verify test payments exist:
   ```sql
   SELECT COUNT(*) FROM payments
   WHERE created_at > NOW() - INTERVAL '5 minutes';
   ```

### ❌ Notifications show wrong content

**Check:**

1. User has first name and last name in database
2. Post has a title
3. Amount is correctly formatted

**Debug query:**

```sql
SELECT
  p.amount,
  t.firstname, t.lastname,
  l.firstname as l_first, l.lastname as l_last,
  po.title
FROM payments p
JOIN users t ON p.tenant_id = t.id
JOIN users l ON p.landlord_id = l.id
JOIN posts po ON p.post_id = po.id
WHERE p.created_at > NOW() - INTERVAL '5 minutes';
```

### ❌ Navigation doesn't work

**Check:**

1. Routes exist in app:
   - `/(protected)/ratings/payment-calendar`
   - `/(protected)/landlord-rentals/payment-calendar`

2. Check notification data:

   ```typescript
   // In useRentalNotifications.ts
   console.log('Notification data:', notification.request.content.data);
   ```

3. Verify action name matches:
   - `open_student_payments`
   - `open_landlord_payments`

### ❌ Database flags not updating

**Check:**

1. Supabase RLS policies allow updates
2. User is authenticated
3. Check console for errors:

   ```
   ❌ Error updating payment: [error message]
   ```

4. Verify update query syntax:
   ```sql
   -- Test manual update
   UPDATE payments
   SET reminder_3day_sent = true
   WHERE id = 'YOUR_PAYMENT_ID';
   ```

---

## Performance Testing

### Test Large Dataset

```sql
-- Create 100 payments
INSERT INTO payments (
  request_id, landlord_id, tenant_id, post_id,
  amount, due_date, status,
  reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent
)
SELECT
  r.id, p.user_id, r.user_id, r.post_id,
  5000, (CURRENT_DATE + INTERVAL '3 days')::date, 'unpaid',
  false, false, false
FROM requests r
JOIN posts p ON r.post_id = p.id
WHERE r.confirmed = true
LIMIT 1
CROSS JOIN generate_series(1, 100);
```

**Expected:**

- ✅ Hook completes within 5 seconds
- ✅ All 100 notifications sent
- ✅ App remains responsive

---

## Success Criteria

### ✅ All Tests Pass

- [ ] Immediate notifications (Scenario 1)
- [ ] Navigation works (Scenario 2)
- [ ] Marking as paid cancels notifications (Scenario 3)
- [ ] Scheduled notifications fire (Scenario 4)
- [ ] Dual perspective works (Scenario 5)
- [ ] Multiple payments handled (Scenario 6)
- [ ] No duplicates (Scenario 7)

### ✅ Code Quality

- [ ] No console errors
- [ ] TypeScript types correct
- [ ] Database queries efficient
- [ ] No memory leaks

### ✅ User Experience

- [ ] Notifications clear and actionable
- [ ] Navigation intuitive
- [ ] No spam (duplicates)
- [ ] Works offline

---

## Cleanup After Testing

```sql
-- Delete all test payments
DELETE FROM payments
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Verify cleanup
SELECT COUNT(*) FROM payments;
```

---

## Next Steps

After successful testing:

1. ✅ **Deploy to Production**
   - Merge code changes
   - Run migration on production database
   - Monitor logs for errors

2. ✅ **User Acceptance Testing**
   - Have real users test the feature
   - Gather feedback on notification timing
   - Adjust reminder schedule if needed

3. ✅ **Monitor Metrics**
   - Track notification open rates
   - Monitor payment punctuality
   - Check for error logs

4. ✅ **Document for Users**
   - Create user guide
   - Add to app onboarding
   - FAQ section

---

## Support

If you encounter issues:

1. Check console logs first
2. Verify database schema matches types
3. Review Expo Notifications documentation
4. Check Supabase RLS policies

**Documentation:**

- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
- Supabase: https://supabase.com/docs
- React Native: https://reactnative.dev/docs/pushnotificationios
