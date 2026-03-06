from supabase import create_client, Client
from app.core.config import settings

def get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

def get_supabase_admin() -> Client:
    """Admin client with service key — bypasses RLS"""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

supabase: Client = get_supabase()
supabase_admin: Client = get_supabase_admin()
