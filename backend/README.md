ALTER TABLE public.samata_schools_unifrom_cost
ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;# Backend Setup Instructions

This backend connects your frontend with Supabase database.

## Quick Start

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run the Backend Server

```bash
python app.py
```

The server will start at `http://localhost:5000`

---

## Architecture

```
Frontend (index.html + app.js)
    ↓
Backend API (Flask at localhost:5000)
    ↓
Supabase Client
    ↓
Supabase Database
```

---

## API Endpoints

### Authentication
- `POST /login` - User login
- `POST /register` - User registration

### Schools
- `GET /schools` - Get all schools
- `POST /schools` - Create new school
- `GET /schools/<school_id>` - Get specific school

### Students
- `GET /students/school/<school_id>` - Get students by school
- `POST /students` - Create new student
- `GET /students/<student_id>` - Get specific student
- `PUT /students/<student_id>` - Update student
- `POST /students/bulk-delete` - Delete multiple students

### Invoices
- `GET /invoices/school/<school_id>` - Get invoices by school
- `POST /invoices` - Create new invoice
- `GET /create-invoice/<student_id>` - Get invoice draft
- `GET /invoices/<invoice_id>` - Get specific invoice
- `PUT /invoices/<invoice_id>` - Update invoice

---

## Database Schema

The backend expects these tables in Supabase:
- `users` - User authentication
- `schools` - School information
- `students` - Student records
- `uniform_prices` - Product catalog
- `invoices` - Invoice records
- `invoice_items` - Line items for invoices

**Run SUPABASE_INIT.sql in your Supabase SQL editor to create all tables.**

---

## Configuration

Backend configuration is in `backend/config.py`:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `FLASK_ENV` - Environment (development/production)
- `CORS_ORIGINS` - Allowed origins for frontend

---

## Troubleshooting

### Backend won't start
- Check Python is installed: `python --version`
- Check dependencies: `pip list`
- Verify requirements: `pip install -r requirements.txt`

### CORS errors
- Check `CORS_ORIGINS` in `config.py`
- Add your frontend URL if missing

### Supabase connection error
- Verify credentials in `config.py`
- Check internet connection
- Verify Supabase project is active

### 404 errors
- Check endpoint URL matches the routes
- Use the endpoints listed above

---

## Development

### File Structure
```
backend/
├── app.py              # Main Flask app
├── config.py           # Configuration
├── supabase_client.py  # Supabase client utility
├── requirements.txt    # Python dependencies
└── routes/
    ├── auth.py         # Authentication routes
    ├── schools.py      # School routes
    ├── students.py     # Student routes
    └── invoices.py     # Invoice routes
```

### Adding New Routes
1. Create new file in `routes/`
2. Import and register in `app.py` using `app.register_blueprint()`

---

## Important Security Notes

⚠️ **For Production Deployment:**

1. **Password Hashing**: Current implementation uses SHA256. Use bcrypt for production:
   ```bash
   pip install bcrypt
   ```

2. **Environment Variables**: Never commit credentials to git:
   ```bash
   # Create .env file
   SUPABASE_URL=your_url
   SUPABASE_ANON_KEY=your_key
   SECRET_KEY=your_secret
   ```

3. **HTTPS**: Set `SESSION_COOKIE_SECURE = True` and use HTTPS only

4. **CORS**: Restrict to specific domains only

5. **Rate Limiting**: Add rate limiting for production

---

## Need Help?

Check the frontend `app.js` for expected API payload formats.
All API responses follow JSON format with `message`, `data`, or `error` fields.
