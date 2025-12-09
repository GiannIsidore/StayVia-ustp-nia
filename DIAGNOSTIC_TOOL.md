# 🔍 Student Notifications Diagnostic Tool

## Quick Test Steps

### Step 1: Add Diagnostic Logging to Your App

Replace the import in `app/(protected)/_layout.tsx` temporarily:

```typescript
// Add this at the top of the file
useEffect(() => {
  if (user?.id) {
    console.log('🔍 DIAGNOSTIC: User ID from Clerk:', user.id);

    // Check database directly
    supabase
      .from('users')
      .select('id, firstname, lastname, account_type')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ DIAGNOSTIC: Error fetching user from database:', error);
        } else {
          console.log('✅ DIAGNOSTIC: User in database:', data);
        }
      });

    // Check payments
    supabase
      .from('payments')
      .select('id, amount, due_date, status, tenant_id, landlord_id')
      .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ DIAGNOSTIC: Error fetching payments:', error);
        } else {
          console.log('✅ DIAGNOSTIC: Payments found:', data?.length || 0);
          console.log(
            'Payments as tenant:',
            data?.filter((p) => p.tenant_id === user.id).length || 0
          );
          console.log(
            'Payments as landlord:',
            data?.filter((p) => p.landlord_id === user.id).length || 0
          );
        }
      });
  }
}, [user?.id]);
```

### Step 2: Run SQL Diagnostics

Run this in Supabase SQL Editor:

```sql
-- Replace 'YOUR_USER_ID' with your actual Clerk user ID

-- 1. Check your user record
SELECT id, firstname, lastname, account_type, created_at
FROM users
WHERE id = 'YOUR_USER_ID';

-- 2. Check all payments where you're the tenant
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
  post.title as property_title
FROM payments p
LEFT JOIN posts post ON p.post_id = post.id
WHERE p.tenant_id = 'YOUR_USER_ID';

-- 3. Check if any payments are due soon (for testing)
SELECT
  p.id,
  p.amount,
  p.due_date,
  p.status,
  p.tenant_id,
  CASE
    WHEN p.due_date = CURRENT_DATE THEN 'DUE TODAY'
    WHEN p.due_date = CURRENT_DATE + INTERVAL '1 day' THEN 'DUE TOMORROW'
    WHEN p.due_date = CURRENT_DATE + INTERVAL '3 days' THEN 'DUE IN 3 DAYS'
    ELSE 'OTHER'
  END as notification_type
FROM payments p
WHERE p.tenant_id = 'YOUR_USER_ID'
AND p.status = 'unpaid';

-- 4. Check React Query behavior - verify accountType loading
-- (This helps diagnose timing issues)
```

### Step 3: Test Account Type Detection

Add this temporary logging to `hooks/usePaymentNotifications.ts` right after line 24:

```typescript
const isLandlord = accountType === 'landlord';

// ADD THIS DIAGNOSTIC BLOCK
console.log('🔍 DIAGNOSTIC DETAILS:', {
  rawAccountType: accountType,
  typeofAccountType: typeof accountType,
  isNull: accountType === null,
  isUndefined: accountType === undefined,
  isEmpty: accountType === '',
  isLandlordCheck: isLandlord,
  isStudentCheck: accountType === 'student',
  stringComparison: accountType?.toLowerCase() === 'student',
});
// END DIAGNOSTIC BLOCK
```

## Expected Output

### ✅ Working Student Account

```
🔍 DIAGNOSTIC: User ID from Clerk: user_abc123
✅ DIAGNOSTIC: User in database: {
  id: 'user_abc123',
  firstname: 'John',
  lastname: 'Doe',
  account_type: 'student'
}
✅ DIAGNOSTIC: Payments found: 3
Payments as tenant: 3
Payments as landlord: 0

🔍 Checking for payment notifications... {
  userId: 'user_abc123',
  isLandlord: false,
  accountType: 'student',
  today: '2025-12-09',
  threeDaysDate: '2025-12-12',
  oneDayDate: '2025-12-10'
}

🔍 DIAGNOSTIC DETAILS: {
  rawAccountType: 'student',
  typeofAccountType: 'string',
  isNull: false,
  isUndefined: false,
  isEmpty: false,
  isLandlordCheck: false,
  isStudentCheck: true,
  stringComparison: true
}

👨‍🎓 Running STUDENT notification checks for user: user_abc123
📊 Student 3-day reminders found: 1
```

### ❌ Common Problems

#### Problem 1: Account Type is NULL

```
🔍 DIAGNOSTIC DETAILS: {
  rawAccountType: null,
  typeofAccountType: 'object',
  isNull: true,
  ...
}
```

**Fix:** User not in database or `account_type` not set. Run Step 2 SQL to check.

#### Problem 2: User ID Mismatch

```
✅ DIAGNOSTIC: User in database: null
❌ DIAGNOSTIC: Error fetching user from database: { message: 'No rows returned' }
```

**Fix:** Clerk user ID doesn't match database user ID. Check user creation logic.

#### Problem 3: No Payments as Tenant

```
✅ DIAGNOSTIC: Payments found: 5
Payments as tenant: 0  ← Problem!
Payments as landlord: 5
```

**Fix:** All payments have you as landlord, not tenant. Need to create test payment with you as tenant.

#### Problem 4: Timing Issue (accountType not loaded yet)

```
🔍 DIAGNOSTIC DETAILS: {
  rawAccountType: null,  ← NULL at first
  ...
}

// Then 2 seconds later:
🔍 DIAGNOSTIC DETAILS: {
  rawAccountType: 'student',  ← Now loaded
  ...
}
```

**Fix:** React Query loading delay. Add a check to wait for accountType to load.

## Next Actions Based on Results

### If account_type is NULL or undefined:

1. Check database: `SELECT account_type FROM users WHERE id = 'YOUR_ID'`
2. If NULL, set it: `UPDATE users SET account_type = 'student' WHERE id = 'YOUR_ID'`
3. Restart app

### If no payments as tenant:

1. Create test payment:

```sql
INSERT INTO payments (
  tenant_id,
  landlord_id,
  post_id,
  amount,
  due_date,
  status,
  reminder_3day_sent,
  reminder_1day_sent,
  reminder_duedate_sent
) VALUES (
  'YOUR_USER_ID',  -- You as tenant
  'SOME_LANDLORD_ID',
  'SOME_POST_ID',
  5000,
  CURRENT_DATE + INTERVAL '3 days',  -- Due in 3 days
  'unpaid',
  false,
  false,
  false
);
```

### If accountType loads slowly (timing issue):

Add loading check to `usePaymentNotifications.ts`:

```typescript
const { accountType, isLoading } = useAccountType();

// Add at start of checkAndSendNotifications:
if (isLoading || accountType === null) {
  console.log('⏳ Waiting for account type to load...');
  return;
}
```

## Reset Test Flags

To test repeatedly, reset notification flags:

```sql
UPDATE payments
SET
  reminder_3day_sent = false,
  reminder_1day_sent = false,
  reminder_duedate_sent = false,
  overdue_notif_sent = false
WHERE tenant_id = 'YOUR_USER_ID';
```

## Success Criteria

✅ Console shows `👨‍🎓 Running STUDENT notification checks`
✅ Console shows `📊 Student 3-day reminders found: X` (X > 0)
✅ Console shows `✅ Sent 3-day reminder for payment XXX (student)`
✅ Notification appears on device
