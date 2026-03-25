// Supabase Configuration
// This file contains the Supabase credentials and client initialization

const SUPABASE_URL = 'https://hsnlgbtiakdcjydvgkzj.supabase.co/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzbmxnYnRpYWtkY2p5ZHZna3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzA5ODUsImV4cCI6MjA4OTg0Njk4NX0.AE2svfQHqKtvhiVVk2sX1nDvMGAd8xJmCqJa4QPDkgo';

// Initialize Supabase client
let supabaseClient;

try {
    const { createClient } = window.supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✓ Supabase client initialized successfully');
} catch (error) {
    console.error('✗ Failed to initialize Supabase client:', error);
}
