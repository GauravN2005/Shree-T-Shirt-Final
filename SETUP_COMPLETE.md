# 🚀 Project Setup Complete - Full Integration Guide

Your School Uniform & Stationery Billing System is ready! Here's your complete setup.

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (Browser)                         │
│              http://localhost:8000                           │
│     (index.html + app.js + supabase-config.js)             │
└─────────────────────────────────┬───────────────────────────┘
                                  │ HTTP API Calls
                                  ↓
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND (Flask App)                          │
│              http://localhost:5000                           │
│    - Authentication (Login/Register)                         │
│    - School Management                                       │
│    - Student Management                                      │
│    - Invoice Management                                      │
└─────────────────────────────────┬───────────────────────────┘
                                  │ Supabase Client
                                  ↓
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE                          │
│        https://hsnlgbtiakdcjydvgkzj.supabase.co            │
│    - users (Authentication)                                 │
│    - schools (School Information)                           │
│    - students (Student Records)                             │
│    - invoices (Billing Invoices)                            │
│    - uniform_prices (Product Catalog)                       │
│    - invoice_items (Line Items)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Setup

### Step 1: Create Database Tables in Supabase ✅

1. Go to: https://supabase.com/dashboard
2. Open your project: `hsnlgbtiakdcjydvgkzj`
3. Go to **SQL Editor**
4. Copy all SQL from **`SUPABASE_INIT.sql`** file
5. Paste into SQL Editor and click **RUN**

✅ All tables will be created!

### Step 2: Keep Frontend Server Running ✅

```bash
# Should already be running on http://localhost:8000
# If not, run:
cd c:\Shree-T-Shirt-main
python -m http.server 8000
```

### Step 3: Start the Backend Server ✅

```bash
# In a NEW PowerShell window, run:
cd c:\Shree-T-Shirt-main\backend
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
 * Press CTRL+C to quit
```

### Step 4: Test Everything

1. Open browser: http://localhost:8000
2. You should see the login screen
3. Try to register a new user
4. Try to login

---

## 🔌 Connection Details

### Frontend
- **URL**: http://localhost:8000
- **Files**: 
  - `index.html` - Main page
  - `app.js` - Application logic
  - `supabase-config.js` - Supabase credentials
  - `style.css` - Styling

### Backend
- **URL**: http://localhost:5000
- **Location**: `backend/` folder
- **Main File**: `app.py`
- **Routes**: `backend/routes/`

### Database
- **URL**: https://hsnlgbtiakdcjydvgkzj.supabase.co/
- **Anon Key**: Pre-configured in `supabase-config.js` and `backend/config.py`

---

## 📁 Project Structure

```
Shree-T-Shirt-main/
├── index.html                  ← Main HTML
├── app.js                       ← Frontend logic
├── style.css                    ← Styling
├── supabase-config.js           ← Supabase client config
├── SUPABASE_INIT.sql            ← Database schema (run this in Supabase!)
├── SUPABASE_SETUP.md            ← Setup instructions
├── API_MIGRATION_REFERENCE.md   ← API endpoints reference
├── backend/
│   ├── app.py                   ← Flask application
│   ├── config.py                ← Configuration (Supabase URL & Key)
│   ├── requirements.txt         ← Python dependencies
│   ├── supabase_client.py       ← Supabase client utility
│   ├── README.md                ← Backend documentation
│   └── routes/
│       ├── auth.py              ← Login/Register endpoints
│       ├── schools.py           ← School management endpoints
│       ├── students.py          ← Student management endpoints
│       └── invoices.py          ← Invoice management endpoints
├── img/                         ← Images
└── .gitignore                   ← Git ignore rules
```

---

## 🔐 Credentials (Already Configured)

**✅ Supabase URL:**
```
https://hsnlgbtiakdcjydvgkzj.supabase.co/
```

**✅ Anon Key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzbmxnYnRpYWtkY2p5ZHZna3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzA5ODUsImV4cCI6MjA4OTg0Njk4NX0.AE2svfQHqKtvhiVVk2sX1nDvMGAd8xJmCqJa4QPDkgo
```

Located in:
- Frontend: `supabase-config.js`
- Backend: `backend/config.py`

---

## 🧪 API Endpoints (Backend)

### Authentication
```
POST   /login          - User login
POST   /register       - User registration
```

### Schools
```
GET    /schools        - Get all schools
POST   /schools        - Create school
GET    /schools/<id>   - Get specific school
```

### Students
```
GET    /students/school/<id>    - Get students by school
POST   /students                - Create student
GET    /students/<id>           - Get student
PUT    /students/<id>           - Update student
POST   /students/bulk-delete    - Delete students
```

### Invoices
```
GET    /invoices/school/<id>        - Get invoices
POST   /invoices                    - Create invoice
GET    /create-invoice/<student_id> - Get invoice draft
GET    /invoices/<id>               - Get invoice
PUT    /invoices/<id>               - Update invoice
```

---

## ✅ Checklist for First Run

- [ ] Backend SQL tables created in Supabase (from SUPABASE_INIT.sql)
- [ ] Frontend running on http://localhost:8000
- [ ] Backend running on http://localhost:5000
- [ ] Can load login page in browser
- [ ] Can create a new user account
- [ ] Can login with created account

---

## 🐛 Troubleshooting

### Frontend won't load
```
Error: Check if http://localhost:8000 is running
Fix: cd c:\Shree-T-Shirt-main && python -m http.server 8000
```

### Backend won't start
```
Error: Module not found
Fix: cd backend && pip install -r requirements.txt
```

### Supabase connection error
```
Error: Invalid credentials
Fix: Check SUPABASE_URL and SUPABASE_ANON_KEY in:
  - backend/config.py
  - supabase-config.js
```

### CORS errors in console
```
Error: CORS policy issue
Fix: Backend already configured with localhost:8000 in CORS_ORIGINS
```

### Database tables don't exist
```
Error: Table 'users' does not exist
Fix: Run SUPABASE_INIT.sql in Supabase SQL Editor
```

---

## 🚀 Quick Start Commands

**Terminal 1 - Frontend:**
```bash
cd c:\Shree-T-Shirt-main
python -m http.server 8000
```

**Terminal 2 - Backend:**
```bash
cd c:\Shree-T-Shirt-main\backend
python app.py
```

**Then open:** http://localhost:8000

---

## 📝 Next Steps

1. ✅ Run the database SQL
2. ✅ Start frontend server
3. ✅ Start backend server
4. ✅ Test login/registration
5. 🔄 Create schools and students
6. 🔄 Generate invoices

---

## 💡 Important Notes

- **Password Storage**: Currently uses SHA256. For production, use bcrypt.
- **Environment Variables**: For production, store credentials in `.env` file
- **HTTPS**: Enable `SESSION_COOKIE_SECURE = True` for HTTPS
- **Rate Limiting**: Add rate limiting for production
- **Security**: Never commit credentials to git

---

## 📞 Support

Check these files for more info:
- `backend/README.md` - Backend documentation
- `SUPABASE_SETUP.md` - Database setup guide
- `API_MIGRATION_REFERENCE.md` - API endpoints reference

---

**🎉 You're all set! Start the servers and open http://localhost:8000 in your browser!**
