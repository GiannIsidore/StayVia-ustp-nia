# Quick Start: Multi-Tenant Implementation

## ✅ You Already Did (Step 1)
- Added `max_occupancy` column to posts table
- Migrated existing data
- Added constraints

---

## 🎯 What To Do Now

### Step 2: Create the View (2 minutes)

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy and paste this SQL (also saved in `002_create_occupancy_view.sql`):

```sql
CREATE OR REPLACE VIEW post_occupancy AS
SELECT 
  p.id as post_id,
  p.title,
  p.max_occupancy,
  COUNT(r.id) FILTER (WHERE r.confirmed = true) as current_occupancy,
  (p.max_occupancy - COUNT(r.id) FILTER (WHERE r.confirmed = true)) as available_slots,
  CASE 
    WHEN COUNT(r.id) FILTER (WHERE r.confirmed = true) >= p.max_occupancy THEN false
    ELSE true
  END as has_available_slots
FROM posts p
LEFT JOIN requests r ON r.post_id = p.id
GROUP BY p.id, p.title, p.max_occupancy;

GRANT SELECT ON post_occupancy TO authenticated;
GRANT SELECT ON post_occupancy TO anon;
```

4. Click **Run**
5. You should see "Success. No rows returned"

---

## 🧪 Step 3: Test It! (5 minutes)

### Test 1: Create a Multi-Tenant Post
1. Launch your app
2. Log in as a landlord
3. Create a new post with **"2 Persons"** occupancy
4. Verify it's created successfully

### Test 2: Multiple Students Can Request
1. Log in as **Student A**
2. View the post you created
3. You should see: **"Request Rental (2 slots left)"**
4. Click to request rental

5. Log in as **Student B** (different account)
6. View the same post
7. You should still see: **"Request Rental (1 slot left)"** ✅
8. Click to request rental

9. Log in as **Student C** (third account)
10. View the same post
11. You should now see: **"Fully Occupied"** ✅

### Test 3: Landlord Sees All Tenants
1. Log back in as the landlord
2. Go to the requests/notifications page
3. Approve both Student A and Student B requests
4. Go to **My Rentals** page
5. You should see both tenants grouped under one property ✅

---

## ✅ Success Indicators

- ✅ Multiple students can request the same post
- ✅ Button shows remaining slots ("X slots left")
- ✅ Button says "Fully Occupied" when max reached
- ✅ Blue info card shows "Multi-Tenant Property" for 2+ occupancy
- ✅ Landlord dashboard groups tenants by property
- ✅ Single occupancy posts still work as before

---

## 🐛 If Something Doesn't Work

### Problem: TypeScript errors
**Solution**: Restart your development server
```bash
# Stop the server (Ctrl+C)
# Then restart:
npm start
# or
npx expo start
```

### Problem: "max_occupancy is not defined"
**Solution**: Make sure you ran the Step 1 SQL migration correctly
```sql
-- Verify the column exists:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posts' AND column_name = 'max_occupancy';
```

### Problem: View doesn't exist
**Solution**: Run the Step 2 SQL migration above

### Problem: Still blocking after one request
**Solution**: Clear your app cache or reinstall the app

---

## 📊 Verify Everything Is Working

Run this query in Supabase SQL Editor:

```sql
-- Check a few posts and their occupancy
SELECT 
  p.id,
  p.title,
  p.beds,
  p.max_occupancy,
  COUNT(r.id) FILTER (WHERE r.confirmed = true) as confirmed_tenants
FROM posts p
LEFT JOIN requests r ON r.post_id = p.id
GROUP BY p.id
LIMIT 10;
```

You should see:
- `beds` column: "Single Occupancy", "2 Persons", etc.
- `max_occupancy` column: 1, 2, 4
- `confirmed_tenants`: actual count of approved tenants

---

## 📚 More Information

- **Full Design Document**: See the design document in `/tmp/MULTI_TENANT_DESIGN.md` for complete details
- **Implementation Summary**: See `MULTI_TENANT_IMPLEMENTATION_SUMMARY.md` for what was changed
- **Testing Checklist**: Use the checklist in the summary document

---

## 🎉 You're Done!

Your app now supports multiple tenants per post! The occupancy field finally works as intended.

**Files You Can Reference:**
- `002_create_occupancy_view.sql` - The SQL to run (Step 2)
- `MULTI_TENANT_IMPLEMENTATION_SUMMARY.md` - What changed
- All code has been updated and is ready to use!
