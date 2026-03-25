# Supabase Client Utility
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_ANON_KEY

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def get_supabase():
    """Return the Supabase client instance"""
    return supabase
