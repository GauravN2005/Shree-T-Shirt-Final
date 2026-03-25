# Supabase Setup Guide - Fresh Installation

This project has been cleaned and is ready for fresh redevelopment with new Supabase credentials.

## Current Project Structure

```
Shree-T-Shirt-main/
├── app.js           (Frontend controller - requires Supabase client setup)
├── index.html       (Main HTML interface)
├── style.css        (Styling)
├── img/             (Images)
└── SUPABASE_SETUP.md (This file)
```

## What Was Removed
- ✅ `backend/` directory (Python Flask backend)
- ✅ `app_v2/` directory (Old version files)
- ✅ `.venv/` (Python virtual environment)

## Next Steps for Redevelopment

### 1. Get Your Supabase Credentials
You need to provide:
- **Project URL**: `https://<your-project>.supabase.co`
- **Anon Key**: Your public anon key from Supabase

### 2. Update Frontend Configuration
Create a new file `supabase-config.js` in the project root with your credentials:

```javascript
// supabase-config.js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';

// Initialize Supabase client
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### 3. Database Schema Required
You'll need to create these tables in Supabase:

#### `users`
- id (UUID, primary key)
- email (text, unique)
- username (text)
- role (text: 'admin' or 'worker')
- created_at (timestamp)

#### `schools`
- id (UUID, primary key)
- school_name (text)
- address (text)
- contact_person (text)
- contact_person_number (text)
- academic_year (text)
- created_at (timestamp)

#### `students`
- id (UUID, primary key)
- school_id (UUID, foreign key)
- sr_no (integer)
- std (text)
- student_name (text)
- mobile_no (text)
- parent_name (text)
- gender (text)
- house (text)
- created_at (timestamp)

#### `uniform_prices`
- id (UUID, primary key)
- school_id (UUID, foreign key)
- item_name (text)
- db_field (text)
- sizes (array)
- price_map (jsonb)
- standard_price_map (jsonb)
- default_price (numeric)

#### `invoices`
- id (UUID, primary key)
- student_id (UUID, foreign key)
- school_id (UUID, foreign key)
- status (text: 'Draft' or 'Paid')
- total (numeric)
- invoice_number (text)
- created_at (timestamp)

#### `invoice_items`
- id (UUID, primary key)
- invoice_id (UUID, foreign key)
- item_name (text)
- quantity (integer)
- size (text)
- unit_price (numeric)

### 4. API Integration Points
The current `app.js` expects these backend API calls. You'll need to either:

**Option A**: Rebuild the backend with Python/Flask connecting to Supabase
**Option B**: Convert to direct Supabase client calls in `app.js`

Current API endpoints used:
- `POST /login` - User login
- `POST /register` - User registration
- `GET /schools` - Fetch all schools
- `POST /schools` - Add new school
- `GET /students/school/{id}` - Fetch students for school
- `POST /students` - Add student
- `PUT /students/{id}` - Update student
- `POST /students/bulk` - Bulk import students
- `POST /students/bulk-delete` - Bulk delete students
- `GET /uniform-catalog/{school_id}` - Fetch catalog
- `GET /invoices/school/{school_id}` - Fetch invoices
- `POST /invoices` - Create invoice
- `GET /create-invoice/{student_id}` - Get invoice draft

### 5. Choose Your Development Approach

#### Recommended: Direct Supabase Client Integration
- Remove `API_BASE` from `app.js`
- Install @supabase/supabase-js
- Update CRUD operations to use Supabase client directly
- Benefits: Faster, fewer dependencies, direct frontend access

#### Alternative: Rebuild Python Backend
- Create new backend with Python + Flask
- Connect to Supabase using `supabase-py` library
- Rebuild all API endpoints
- Benefits: Better for complex business logic, API versioning

## Ready to Continue?
Please provide:
1. Your Supabase Project URL
2. Your Supabase Anon Key
3. Which approach you'd like to take (Direct client or rebuild backend)

Then we'll proceed with setting up the development environment!
