# Configuration for Supabase and Flask
import os
from datetime import timedelta


def _parse_cors_origins(raw_value):
    default_origins = [
        "http://localhost:8000",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:3000",
    ]
    if not raw_value:
        return default_origins

    parts = [part.strip() for part in str(raw_value).split(",") if part.strip()]
    return parts or default_origins


# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://hsnlgbtiakdcjydvgkzj.supabase.co/")
SUPABASE_ANON_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzbmxnYnRpYWtkY2p5ZHZna3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzA5ODUsImV4cCI6MjA4OTg0Njk4NX0.AE2svfQHqKtvhiVVk2sX1nDvMGAd8xJmCqJa4QPDkgo",
)

# Flask Configuration
FLASK_ENV = os.getenv("FLASK_ENV", "development")
DEBUG = os.getenv("DEBUG", "true" if FLASK_ENV == "development" else "false").lower() == "true"
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")

# CORS Configuration (comma-separated via env in production)
CORS_ORIGINS = _parse_cors_origins(os.getenv("CORS_ORIGINS"))

# Session Configuration
PERMANENT_SESSION_LIFETIME = timedelta(days=7)
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
