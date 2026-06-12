# src/rental_intel/cleaning/db.py

from dotenv import load_dotenv
import os

from supabase import create_client, Client


def get_supabase_client() -> Client:
    load_dotenv()

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_KEY. Check your .env file."
        )

    return create_client(url, key)