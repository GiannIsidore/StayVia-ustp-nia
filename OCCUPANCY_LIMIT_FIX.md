# Occupancy Limit Fix - Implementation Guide

## 🎯 Problem Solved

**Issue:** Landlords could approve more rental requests than the property's `max_occupancy` setting, causing overbooking.

**Root Cause:** No validation when confirming requests (`confirmed=true`). Race conditions allowed multiple simultaneous approvals to exceed the limit.

**Solution:** Multi-layer protection with database trigger (primary) + application-level check (secondary).

---

## 🔧 Implementation Details

### 1. Database Trigger (Primary Protection)

**File:** `003_enforce_occupancy_limit_trigger.sql`

**What it does:**

- Creates a PostgreSQL trigger on the `requests` table
- Fires BEFORE INSERT/UPDATE operations
- Validates occupancy only when setting `confirmed=true` for the first time
- Counts current confirmed requests and checks against `posts.max_occupancy`
- Raises exception if limit would be exceeded
- **Prevents race conditions** - atomic database-level enforcement

**To deploy:**

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `003_enforce_occupancy_limit_trigger.sql`
3. Execute the SQL
4. Verify success (should see "Success" message)

**How it works:**

```sql
-- Pseudocode:
IF request is being confirmed (new confirmation, not already confirmed) THEN
  Count existing confirmed requests for this post
  Get max_occupancy from posts table
  IF count >= max_occupancy THEN
    RAISE ERROR
  END IF
END IF
```

---

### 2. Application-Level Check (Secondary Validation)

**File:** `services/requestService.ts` (lines 170-181)

**What it does:**

- Checks available slots before confirming a request
- Uses existing `checkAvailableSlots()` function
- Throws error with user-friendly message if no slots available
- Provides **fast failure** without database round-trip

**Benefits:**

- Better UX - immediate feedback to landlord
- Reduces unnecessary database operations
- Clear error messages for the UI layer

---

### 3. UI Error Handling

**File:** `app/(protected)/notification/index.tsx` (lines 335-350)

**What it does:**

- Catches occupancy errors in `approveRequestMutation`
- Shows specific Alert for occupancy issues
- Generic error message for other failures
- Refreshes request list after error

**User Experience:**

- Landlord clicks "Approve" on a request
- If property is full, sees: "Cannot Approve Request - This property is at maximum occupancy"
- Request list refreshes to show current status

---

## 🧪 Testing Guide

### Prerequisites

1. Deploy database trigger: Run `003_enforce_occupancy_limit_trigger.sql`
2. Deploy application changes (done automatically)
3. Have test accounts: 1 landlord, 3+ student accounts

### Test Scenario 1: Basic Occupancy Limit

**Goal:** Verify limit is enforced

**Steps:**

1. Create a post with `max_occupancy = 2` (e.g., "2 beds" when creating)
2. Have 3 different students send requests for this post
3. As landlord, go to Notifications tab
4. Approve 1st request → ✅ Should succeed
5. Approve 2nd request → ✅ Should succeed
6. Approve 3rd request → ❌ Should show error: "Property is at maximum occupancy"

**Expected Result:**

- Only 2 requests confirmed
- 3rd request shows error alert
- Post shows "2 of 2 slots occupied"

---

### Test Scenario 2: Race Condition Protection

**Goal:** Verify concurrent approvals are handled safely

**Steps:**

1. Create post with `max_occupancy = 2`
2. Have 4 students send requests
3. Open landlord account on 2 different devices/browsers
4. Try approving multiple requests simultaneously from both devices
5. Verify final count

**Expected Result:**

- Only 2 requests end up confirmed (even with concurrent attempts)
- Other attempts show occupancy error
- Database prevents overbooking

---

### Test Scenario 3: Single Tenant Property

**Goal:** Verify works for `max_occupancy = 1`

**Steps:**

1. Create post with `max_occupancy = 1` (e.g., "1 bed")
2. Have 2 students send requests
3. Approve 1st request → ✅ Should succeed
4. Approve 2nd request → ❌ Should fail with error

**Expected Result:**

- Only 1 request confirmed
- Post shows "1 of 1 slots occupied"
- "Fully Occupied" badge visible

---

### Test Scenario 4: Changing Max Occupancy

**Goal:** Verify dynamic occupancy changes work correctly

**Steps:**

1. Create post with `max_occupancy = 2`
2. Have 3 students send requests
3. Approve 2 requests (fills capacity)
4. Try approving 3rd → ❌ Should fail
5. As landlord, edit the post and change beds to "3 beds" (increases max_occupancy to 3)
6. Try approving 3rd request again → ✅ Should now succeed

**Expected Result:**

- After increasing max_occupancy, additional slot becomes available
- Trigger respects current max_occupancy value from posts table

---

### Test Scenario 5: Request Creation Still Works

**Goal:** Verify students can still request even when near capacity

**Steps:**

1. Create post with `max_occupancy = 2`
2. Approve 1 request (1 slot left)
3. Have 5 different students send requests
4. All 5 should succeed in creating requests
5. Only the first approved request should succeed
6. Remaining approvals should fail

**Expected Result:**

- Students can create requests freely (no blocking)
- Landlord approval is where limit is enforced
- Clear error when trying to approve beyond limit

---

## 🔍 Verification Queries

### Check Current Occupancy for All Posts

Run in Supabase SQL Editor:

```sql
SELECT
  p.id as post_id,
  p.title,
  p.max_occupancy,
  COUNT(r.id) FILTER (WHERE r.confirmed = true) as current_confirmed,
  p.max_occupancy - COUNT(r.id) FILTER (WHERE r.confirmed = true) as available_slots,
  CASE
    WHEN COUNT(r.id) FILTER (WHERE r.confirmed = true) >= p.max_occupancy THEN '🔴 FULL'
    ELSE '🟢 Available'
  END as status
FROM posts p
LEFT JOIN requests r ON r.post_id = p.id
GROUP BY p.id, p.title, p.max_occupancy
ORDER BY p.created_at DESC;
```

### Check Trigger Exists

```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'enforce_occupancy_limit';
```

### Test Trigger Manually

```sql
-- This should fail if post is at max occupancy
UPDATE requests
SET confirmed = true
WHERE id = 'some-request-id';
-- Expected: Exception if limit exceeded
```

---

## 📊 What Changed

### Files Created

1. `003_enforce_occupancy_limit_trigger.sql` - Database trigger migration
2. `OCCUPANCY_LIMIT_FIX.md` - This documentation file

### Files Modified

1. `services/requestService.ts`
   - Added occupancy check before confirming (lines 170-181)
2. `app/(protected)/notification/index.tsx`
   - Added error handling for occupancy errors (lines 335-350)

### Database Changes

1. New function: `check_occupancy_limit()`
2. New trigger: `enforce_occupancy_limit` on `requests` table

---

## ⚠️ Important Notes

### Backward Compatibility

✅ **Safe to deploy** - No breaking changes

- Existing confirmed requests are NOT re-validated
- Only NEW confirmations are checked
- No data migration required

### Performance

✅ **Minimal impact**

- Trigger runs a simple COUNT query
- Uses existing indexes on `post_id` and `confirmed`
- No impact on read operations (only INSERT/UPDATE)

### Error Handling

- Database returns clear error with slot counts
- Application catches and shows user-friendly message
- UI refreshes to show current state

### Edge Cases Handled

✅ Re-confirming already confirmed request → Ignored (no error)
✅ Concurrent approval attempts → Database serializes safely
✅ Changing max_occupancy → Always checks current post setting
✅ Deleting requests → No validation needed
✅ Acknowledging requests (requested=true) → No validation

---

## 🚀 Deployment Checklist

- [ ] **Step 1:** Run `003_enforce_occupancy_limit_trigger.sql` in Supabase SQL Editor
- [ ] **Step 2:** Verify trigger created (run verification query above)
- [ ] **Step 3:** Deploy application changes (automatic with your deployment)
- [ ] **Step 4:** Test Scenario 1 (Basic limit enforcement)
- [ ] **Step 5:** Test Scenario 2 (Race condition protection)
- [ ] **Step 6:** Monitor production logs for any issues
- [ ] **Step 7:** Run occupancy verification query to check all posts

---

## 📈 Expected Behavior After Fix

### Before Fix ❌

- Landlords could approve unlimited requests
- `max_occupancy` was just a display value
- Race conditions caused overbooking
- Students could be approved beyond capacity

### After Fix ✅

- Database **enforces** max_occupancy limit
- Impossible to exceed limit (even with race conditions)
- Clear error messages to landlords
- Occupancy counter always accurate
- Multi-layer protection (database + application)

---

## 🆘 Troubleshooting

### Issue: "Function check_occupancy_limit() does not exist"

**Solution:** Run the SQL migration file again in Supabase

### Issue: Trigger not firing

**Solution:**

1. Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'enforce_occupancy_limit';`
2. Re-run migration SQL
3. Check Supabase logs for errors

### Issue: Error message not showing in app

**Solution:**

1. Check application changes deployed
2. Verify error handling in notification/index.tsx
3. Check browser/app console for error details

### Issue: Can't approve any requests

**Solution:**

1. Run occupancy verification query
2. Check post's max_occupancy value
3. Verify confirmed requests count
4. May need to increase max_occupancy or remove existing confirmed requests

---

## 📞 Support

If you encounter any issues:

1. Check Supabase logs (Settings → Logs)
2. Check application console errors
3. Run verification queries above
4. Review test scenarios to isolate the issue

---

## ✅ Success Criteria

The fix is working correctly when:

- ✅ Cannot confirm more requests than max_occupancy
- ✅ Error message appears when limit exceeded
- ✅ Occupancy counter shows accurate counts
- ✅ Race conditions don't cause overbooking
- ✅ Students can still create requests freely
- ✅ Changing max_occupancy allows more approvals

---

**Implementation Date:** December 10, 2025  
**Status:** ✅ Ready for Deployment
