# Quick Start Guide: Enhanced Student Registration

## 🚀 Getting Started

### Step 1: Apply Database Migration

You need to run the SQL migration to add new columns to your database.

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `add_student_extended_fields.sql` from your project
4. Copy and paste the entire content
5. Click **Run** to execute the migration
6. Verify success message appears

#### Option B: Using Supabase CLI

```bash
# Make sure you're in the project directory
cd /home/giann/Downloads/new/StayVia-ustp

# Push the migration (if you've set up migrations folder)
supabase db push
```

#### Option C: Manual SQL Execution

```sql
-- Connect to your database and run:
-- Contents of add_student_extended_fields.sql

ALTER TABLE users
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS religion TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS parent_name TEXT,
ADD COLUMN IF NOT EXISTS parent_contact TEXT,
ADD COLUMN IF NOT EXISTS parent_email TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_number TEXT;
```

### Step 2: Verify Database Changes

Run this query in Supabase SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN (
  'date_of_birth', 'gender', 'religion', 'nationality',
  'home_address', 'city', 'province', 'postal_code',
  'parent_name', 'parent_contact', 'parent_email',
  'emergency_contact_name', 'emergency_contact_number'
)
ORDER BY column_name;
```

You should see 13 rows with all columns as nullable.

### Step 3: Test the Application

#### Start the Development Server

```bash
# Install dependencies (if needed)
npm install
# or
bun install

# Start the development server
npm start
# or
bun start
```

#### Test Scenarios

**1. New Student Registration:**

- Select "Student" role
- Fill in Step 1 (Personal Info)
  - Test the date picker
  - Test the gender dropdown
- Fill in Step 2 (Address Info)
  - All fields should be required
- Fill in Step 3 (Parent Info)
  - Try the "not available" checkbox
- Fill in Step 4 (School & Emergency)
  - Upload student ID proof
- Submit and verify account creation

**2. Existing Student Profile Edit:**

- Login as an existing student
- Check if completion banner appears
- Navigate to Edit Profile
- Verify all new sections appear
- Update some fields
- Save and verify data persists

**3. Landlord Registration (Should be unchanged):**

- Select "Landlord" role
- Verify single-step form still works
- Upload valid ID proof
- Complete registration

---

## 📱 How to Use New Features

### For Students During Registration:

**Step 1: Personal Information**

- Enter basic details (name, contact)
- Optional: Select date of birth from calendar
- Optional: Choose gender from dropdown
- Optional: Enter religion and nationality

**Step 2: Address Information**

- **Required:** Enter complete home address
- **Required:** Enter city
- **Required:** Enter province/state
- Optional: Enter postal code

**Step 3: Parent/Guardian Information**

- If parent info available: Fill in name, contact, email
- If not available: Check "Parent/Guardian information not available"
- All fields optional

**Step 4: School & Emergency Contact**

- **Required:** Enter student ID
- **Required:** Enter school name
- **Required:** Upload student ID proof photo
- Optional: Enter emergency contact details

### For Students Editing Profile:

1. Navigate to Profile → Edit Profile
2. Scroll through organized sections:
   - Personal Information
   - Address Information
   - Parent/Guardian Information
   - School Information
   - Emergency Contact
3. Update any field
4. Click "Update Account"

### Completion Banner:

- Appears at top of home screen for students with incomplete profiles
- Shows completion percentage
- Displays progress bar
- Click to go directly to edit profile
- Auto-hides when profile is 100% complete

---

## 🎨 UI Components Overview

### DatePicker

```tsx
<DatePicker
  label="Date of Birth"
  value={dateValue}
  onChange={setDateValue}
  placeholder="Select your date of birth"
/>
```

- Opens native date picker
- Can clear selection
- Max date is today
- Formats as "MMM dd, yyyy"

### GenderPicker

```tsx
<GenderPicker
  label="Gender"
  value={genderValue}
  onChange={setGenderValue}
  placeholder="Select your gender"
/>
```

- Modal with 4 options
- Visual selection indicator
- Can clear selection

### MultiStepStudentForm

```tsx
<MultiStepStudentForm control={control} watch={watch} onSubmit={onSubmit} isPending={isPending}>
  {/* Student proof upload goes here */}
</MultiStepStudentForm>
```

- Handles 4-step flow
- Validates each step
- Back/Next navigation
- Progress tracking

---

## 🔍 Troubleshooting

### Issue: Migration fails

**Solution:**

- Check if you have permission to ALTER TABLE
- Verify table name is correct (should be "users")
- Try running each ALTER statement separately

### Issue: Fields not showing in form

**Solution:**

- Clear app cache
- Restart development server
- Verify database migration completed
- Check TypeScript types are up to date

### Issue: Date picker not opening

**Solution:**

- Verify `@react-native-community/datetimepicker` is installed
- Check platform-specific settings
- Test on both iOS and Android

### Issue: Data not saving

**Solution:**

- Check Supabase connection
- Verify mutation function is called
- Check browser/app console for errors
- Verify field names match database columns

### Issue: Completion banner not appearing

**Solution:**

- Verify user is a student (account_type = 'student')
- Check if profile is actually incomplete
- Verify ProfileCompletionBanner is imported on home page

---

## 📊 Field Validation Rules

| Field             | Required | Validation             |
| ----------------- | -------- | ---------------------- |
| Firstname         | Yes      | Min 2 chars            |
| Lastname          | Yes      | Min 2 chars            |
| Contact           | Yes      | Numeric, 10-11 digits  |
| Date of Birth     | No       | Valid date, not future |
| Gender            | No       | One of 4 options       |
| Religion          | No       | Any text               |
| Nationality       | No       | Any text               |
| Home Address      | Yes\*    | Min 10 chars           |
| City              | Yes\*    | Min 2 chars            |
| Province          | Yes\*    | Min 2 chars            |
| Postal Code       | No       | Alphanumeric           |
| Student ID        | Yes      | Numeric                |
| School            | Yes      | Min 2 chars            |
| Student Proof     | Yes      | Image file             |
| Parent Info       | No       | Optional, can be NULL  |
| Emergency Contact | No       | Optional               |

\*Required only for students during registration

---

## 💾 Data Storage

### How Parent Info "Not Available" Works:

- When checkbox is checked: Fields are hidden from UI
- When submitting: NULL values stored in database (not empty strings)
- When editing: If NULL in DB, fields show empty

### Date Format:

- UI: Displays as "MMM dd, yyyy" (e.g., "Dec 10, 2025")
- Database: Stores as DATE type (YYYY-MM-DD)
- Conversion handled automatically

### NULL vs Empty String:

- All new fields store NULL when not provided
- Parent fields: NULL when "not available" checkbox checked
- Optional fields: NULL when left empty
- This allows proper "data not provided" vs "data is empty" distinction

---

## 🎯 Next Steps After Testing

1. **Deploy to Production:**
   - Run migration on production database
   - Deploy updated app code
   - Monitor for errors

2. **User Communication:**
   - Notify existing students about new profile fields
   - Provide instructions on completing profile
   - Highlight benefits of complete profile

3. **Analytics:**
   - Track profile completion rates
   - Monitor student registration flow
   - Identify drop-off points in multi-step form

4. **Optional Enhancements:**
   - Add ProfileCompletionBanner to home screen
   - Create profile viewing page showing all fields
   - Add search/filter by new fields
   - Implement field-specific validation (email format)

---

## 📞 Support

For issues or questions:

1. Check `STUDENT_REGISTRATION_ENHANCEMENT.md` for detailed documentation
2. Review component source code in:
   - `components/ui/date-picker.tsx`
   - `components/ui/gender-picker.tsx`
   - `components/auth/MultiStepStudentForm.tsx`
   - `components/ProfileCompletionBanner.tsx`
3. Test in development environment thoroughly
4. Check console logs for errors

---

**Ready to go!** 🎉

Your enhanced student registration system is fully implemented and ready for testing.
