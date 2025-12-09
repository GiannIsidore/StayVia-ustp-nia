# Payment Notifications - Testing Checklist

## Overview

This checklist helps you systematically test the Payment Due Date Notifications system.

---

## Pre-Testing Setup

### 1. Database Migration ✅

- [x] Ran the ALTER TABLE migration in Supabase
- [x] Confirmed 7 new columns added to `payments` table:
  - `reminder_3day_sent`
  - `reminder_1day_sent`
  - `reminder_duedate_sent`
  - `overdue_notif_sent`
  - `notification_3day_id`
  - `notification_1day_id`
  - `notification_duedate_id`

### 2. Code Deployment ✅

- [x] All code changes committed
- [x] App rebuilt and deployed to device/emulator
- [x] No TypeScript errors
- [x] No build errors

### 3. Device Permissions

- [ ] Notifications enabled for app in device settings
- [ ] App has foreground notification permissions
- [ ] App has background notification permissions (optional but recommended)

---

## Test Suite 1: Basic Notification Delivery

### Setup

1. [ ] Run `complete-test-setup-payment-notifications.sql` in Supabase SQL Editor
2. [ ] Verify test data created (should see 4 payments)
3. [ ] Note the test user emails:
   - Student: `test.student@example.com`
   - Landlord: `test.landlord@example.com`

### Test 1.1: Initial Notification Trigger (Student View)

- [ ] Login as student (`test.student@example.com`)
- [ ] Close app completely
- [ ] Open app
- [ ] Wait 3 seconds
- [ ] **Expected:** Receive 4 notifications:
  - "💰 Payment due in 3 days: ₱5,000 for Test Property..."
  - "💰 Payment due tomorrow: ₱5,000 for Test Property..."
  - "💰 Payment due today: ₱5,000 for Test Property..."
  - "⚠️ Payment overdue: ₱5,000 for Test Property... is 2 day(s) overdue"

### Test 1.2: Notification Tap Navigation (Student View)

- [ ] Tap "due in 3 days" notification → Navigate to student payments screen
- [ ] Tap "due tomorrow" notification → Navigate to student payments screen
- [ ] Tap "due today" notification → Navigate to student payments screen
- [ ] Tap "overdue" notification → Navigate to student payments screen

### Test 1.3: Database Flag Verification

- [ ] Run query #3 from `verify-payment-notifications.sql`
- [ ] **Expected:** All flags should be TRUE:
  - `reminder_3day_sent = TRUE`
  - `reminder_1day_sent = TRUE`
  - `reminder_duedate_sent = TRUE`
  - `overdue_notif_sent = TRUE`

---

## Test Suite 2: Landlord Perspective

### Test 2.1: Landlord Notifications

- [ ] Logout from student account
- [ ] Login as landlord (`test.landlord@example.com`)
- [ ] Close app completely
- [ ] Open app
- [ ] Wait 3 seconds
- [ ] **Expected:** Should NOT receive new notifications (already sent)

### Test 2.2: Reset Flags & Test Landlord View

- [ ] Run this SQL in Supabase:

```sql
UPDATE payments
SET reminder_3day_sent = FALSE,
    reminder_1day_sent = FALSE,
    reminder_duedate_sent = FALSE,
    overdue_notif_sent = FALSE
WHERE post_id IN (SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment');
```

- [ ] Close app
- [ ] Open app as landlord
- [ ] Wait 3 seconds
- [ ] **Expected:** Receive 4 notifications with landlord perspective:
  - "💰 Payment from Test Student due in 3 days: ₱5,000..."
  - "💰 Payment from Test Student due tomorrow: ₱5,000..."
  - "💰 Payment from Test Student due today: ₱5,000..."
  - "⚠️ Payment from Test Student overdue: ₱5,000... is 2 day(s) overdue"

---

## Test Suite 3: No Duplicate Notifications

### Test 3.1: Reopen App (No Duplicates)

- [ ] Close app
- [ ] Open app again
- [ ] Wait 3 seconds
- [ ] **Expected:** NO new notifications (flags already TRUE)

### Test 3.2: Background/Foreground (No Duplicates)

- [ ] Put app in background
- [ ] Wait 5 seconds
- [ ] Bring app to foreground
- [ ] **Expected:** NO new notifications (flags already TRUE)

---

## Test Suite 4: Payment Status Changes

### Test 4.1: Mark Payment as Paid

- [ ] Navigate to student payments screen
- [ ] Find the "due tomorrow" payment
- [ ] Mark it as PAID
- [ ] Run query #4 from `verify-payment-notifications.sql`
- [ ] **Expected:** Payment status changed to "paid"
- [ ] **Expected:** No more reminders for this payment

### Test 4.2: Verify No Further Notifications for Paid Payment

- [ ] Reset all flags to FALSE:

```sql
UPDATE payments
SET reminder_3day_sent = FALSE,
    reminder_1day_sent = FALSE,
    reminder_duedate_sent = FALSE
WHERE status = 'unpaid';
```

- [ ] Close and reopen app
- [ ] **Expected:** Only 3 notifications (paid payment should be skipped)

---

## Test Suite 5: Edge Cases

### Test 5.1: New Payment Created

- [ ] Run `add-missing-payment.sql` to create a new payment due in 2 days
- [ ] Close and reopen app
- [ ] **Expected:** NO notification (2 days is between 1-day and 3-day thresholds)

### Test 5.2: Payment Becomes Due Tomorrow

- [ ] Update the payment to be due tomorrow:

```sql
UPDATE payments
SET due_date = (CURRENT_DATE + INTERVAL '1 day')::date,
    reminder_1day_sent = FALSE
WHERE due_date = (CURRENT_DATE + INTERVAL '2 days')::date
LIMIT 1;
```

- [ ] Close and reopen app
- [ ] **Expected:** Receive 1-day reminder notification

### Test 5.3: Multiple Payments Same Property

- [ ] Create 2 more payments for same property, both due in 3 days
- [ ] Close and reopen app
- [ ] **Expected:** Receive 2 separate notifications (one per payment)

---

## Test Suite 6: Performance & Timing

### Test 6.1: App Startup Speed

- [ ] Cold start: Note time from app launch to notifications
- [ ] **Expected:** < 5 seconds from launch to first notification

### Test 6.2: Background to Foreground

- [ ] Background app for 1 minute
- [ ] Bring to foreground
- [ ] **Expected:** Notifications appear within 3 seconds

### Test 6.3: Large Dataset

- [ ] Create 50 test payments (run script 12 times with different dates)
- [ ] Close and reopen app
- [ ] **Expected:** Only relevant notifications (3-day, 1-day, due today, overdue)
- [ ] **Expected:** No performance degradation

---

## Test Suite 7: Real-World Scenario

### Test 7.1: Create Real Rental Flow

- [ ] Create 2 real users (not test users)
- [ ] Create real property post
- [ ] Send rental request
- [ ] Accept rental request (creates payments)
- [ ] Verify payments created with correct due dates
- [ ] Login as tenant → verify notifications received
- [ ] Login as landlord → verify notifications received

### Test 7.2: Monthly Payment Cycle

- [ ] Mark current month payment as paid
- [ ] Verify next month payment still has active reminders
- [ ] Wait for next reminder window
- [ ] Verify notification received for next payment

---

## Cleanup

### After All Tests Complete

- [ ] Run cleanup script from `complete-test-setup-payment-notifications.sql`:

```sql
DELETE FROM payments WHERE post_id IN (SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment');
DELETE FROM requests WHERE post_id IN (SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment');
DELETE FROM posts WHERE title = 'Test Property - Sunset View Apartment';
DELETE FROM users WHERE email IN ('test.student@example.com', 'test.landlord@example.com');
```

- [ ] Verify test data removed
- [ ] App still functions normally

---

## Results Summary

### Notifications Delivered

- [ ] 3-day reminders: **\_** / **\_** (expected)
- [ ] 1-day reminders: **\_** / **\_** (expected)
- [ ] Due today reminders: **\_** / **\_** (expected)
- [ ] Overdue notifications: **\_** / **\_** (expected)

### Navigation

- [ ] All notification taps navigated correctly: YES / NO
- [ ] Student view works: YES / NO
- [ ] Landlord view works: YES / NO

### Database

- [ ] Flags update correctly: YES / NO
- [ ] No duplicate notifications: YES / NO
- [ ] Paid payments skip notifications: YES / NO

### Performance

- [ ] Notifications appear within 3 seconds: YES / NO
- [ ] No app crashes: YES / NO
- [ ] No performance issues: YES / NO

---

## Issues Found

| Issue | Severity        | Description | Status     |
| ----- | --------------- | ----------- | ---------- |
| 1.    | High/Medium/Low |             | Open/Fixed |
| 2.    | High/Medium/Low |             | Open/Fixed |
| 3.    | High/Medium/Low |             | Open/Fixed |

---

## Sign-off

- [ ] All test suites completed
- [ ] All critical issues resolved
- [ ] System ready for production
- [ ] Documentation reviewed and accurate

**Tested by:** ********\_\_\_********  
**Date:** ********\_\_\_********  
**Build/Version:** ********\_\_\_********

---

## Quick Reference

### SQL Files

- `complete-test-setup-payment-notifications.sql` - Full test data setup
- `verify-payment-notifications.sql` - Verification queries
- `quick-test-payment-notifications.sql` - Quick 5-minute test

### Key Files Modified

- `hooks/usePaymentNotifications.ts` - Main notification logic
- `services/notificationService.ts` - Notification scheduling
- `services/paymentService.ts` - Payment status updates
- `services/requestService.ts` - Payment creation hook
- `app/(protected)/_layout.tsx` - Hook integration

### Test User Credentials

- **Student:** test.student@example.com
- **Landlord:** test.landlord@example.com
- **Test Property:** "Test Property - Sunset View Apartment"
