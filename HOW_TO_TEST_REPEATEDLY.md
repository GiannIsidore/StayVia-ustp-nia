# 🔁 How to Test Notifications (Multiple Times)

## Simple 3-Step Process

### 🎬 First Time Setup (Do Once)

```
1. Open Supabase SQL Editor
2. Copy & paste: repeatable-test-notifications.sql
3. Click "Run" ▶️
```

You'll see:

```
✅ TEST PAYMENTS CREATED!
payment_count: 4
```

---

## 📱 Testing Cycle (Repeat as many times as you want!)

### Cycle 1️⃣

**A) Run the SQL** (creates 4 test payments)

```sql
-- Just run repeatable-test-notifications.sql in Supabase
```

**B) Open your app**

- Close app completely (swipe away)
- Open app fresh
- Wait 3 seconds ⏱️

**C) You should receive 4 notifications!**

```
💰 Payment due in 3 days: ₱5,000...
💰 Payment due tomorrow: ₱5,000...
💰 Payment due today: ₱5,000...
⚠️ Payment overdue: ₱5,000... is 2 day(s) overdue
```

**D) Verify it worked** (optional)

```sql
-- Run this query in Supabase:
SELECT
  COUNT(*) FILTER (WHERE reminder_3day_sent = true) as "3day_sent",
  COUNT(*) FILTER (WHERE reminder_1day_sent = true) as "1day_sent",
  COUNT(*) FILTER (WHERE reminder_duedate_sent = true) as "due_sent",
  COUNT(*) FILTER (WHERE overdue_notif_sent = true) as "overdue_sent"
FROM payments p
JOIN posts po ON p.post_id = po.id
WHERE po.title = 'Test Property - Sunset View Apartment'
  AND p.created_at > NOW() - INTERVAL '5 minutes';
```

Should show: `3day_sent: 1, 1day_sent: 2, due_sent: 2, overdue_sent: 1`

**E) Clean up**

```sql
-- Run this in Supabase to delete test payments:
DELETE FROM payments
WHERE post_id IN (
  SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment'
)
AND created_at > NOW() - INTERVAL '5 minutes';
```

You'll see: `🧹 Test payments deleted! Ready for next test.`

---

### Cycle 2️⃣ (Repeat!)

**A) Run SQL again** → Creates 4 new test payments  
**B) Open app** → Wait 3 seconds  
**C) Get 4 notifications!** 🔔  
**D) Verify** (optional)  
**E) Clean up** → Ready for next test

---

### Cycle 3️⃣, 4️⃣, 5️⃣... (Repeat as many times as you want!)

Just repeat: **SQL → Open App → Notifications → Cleanup → Repeat!**

---

## 🎯 Quick Reference

### What triggers notifications?

Opening the app (or bringing to foreground) runs the notification check hook.

### How long does it take?

~3 seconds from opening app to notifications appearing.

### Can I test without cleanup?

Yes! But the same payments won't send notifications again (flags are TRUE).
Cleanup resets everything so you get fresh notifications.

### Can I test different scenarios?

Yes! Edit the SQL to create payments with different due dates:

- `CURRENT_DATE + INTERVAL '3 days'` → 3-day reminder
- `CURRENT_DATE + INTERVAL '1 day'` → 1-day reminder
- `CURRENT_DATE` → Due today
- `CURRENT_DATE - INTERVAL '2 days'` → Overdue

---

## 🧪 Test Variations

### Test only 1 notification at a time:

```sql
-- Create only a payment due tomorrow:
INSERT INTO payments (request_id, landlord_id, tenant_id, post_id, amount, due_date, status, reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent, overdue_notif_sent)
SELECT r.id, p.user_id, r.user_id, r.post_id, 5000, (CURRENT_DATE + INTERVAL '1 day')::date, 'unpaid', true, false, false, false
FROM requests r JOIN posts p ON r.post_id = p.id
WHERE p.title = 'Test Property - Sunset View Apartment' LIMIT 1;
```

### Test with different amounts:

```sql
-- Change amount to 8000:
amount, due_date, status
8000, (CURRENT_DATE + INTERVAL '3 days')::date, 'unpaid'
```

### Test with real property:

```sql
-- Replace 'Test Property - Sunset View Apartment' with your real property title
WHERE p.title = 'Your Real Property Name'
```

---

## 🐛 Troubleshooting

### No notifications appear?

1. Check device notification permissions
2. Check if app is in foreground (notifications won't show if app is open)
3. Run verification query to check if flags changed to TRUE
4. Check app logs for errors

### Notifications appear but navigation doesn't work?

1. Tap notification
2. Should navigate to payment screen
3. Check app logs for navigation errors

### Getting duplicate notifications?

1. Make sure you ran cleanup between tests
2. Flags should be FALSE for new notifications

---

## ✅ Success Indicators

- ✅ Notifications appear within 3 seconds
- ✅ All 4 notifications received
- ✅ Tapping notifications navigates to payment screen
- ✅ Database flags change from FALSE to TRUE
- ✅ No duplicate notifications after cleanup

---

## 🧹 Final Cleanup (After All Testing)

When you're completely done testing:

```sql
DELETE FROM payments WHERE post_id IN (SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment');
DELETE FROM requests WHERE post_id IN (SELECT id FROM posts WHERE title = 'Test Property - Sunset View Apartment');
DELETE FROM posts WHERE title = 'Test Property - Sunset View Apartment';
DELETE FROM users WHERE email IN ('test.student@example.com', 'test.landlord@example.com');
```

---

## 📞 Quick Help

**Q: How many times can I test?**  
A: Unlimited! Just run SQL → Open App → Cleanup → Repeat

**Q: Do I need to login as test user?**  
A: The hook runs for ANY logged-in user. The notifications will show for whoever is logged in, but will be personalized based on their role (student vs landlord).

**Q: Can I test while developing?**  
A: Yes! Use this for quick testing during development. No need to wait for real payments.

**Q: Will this affect production data?**  
A: No! Test data uses specific test user emails and property title. Just remember to cleanup after testing.
