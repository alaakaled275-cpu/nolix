import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env.local")

DB_URL = os.getenv("DATABASE_URL", "postgresql://support:nolix_admin_123@127.0.0.1:5432/support")

def get_db_connection():
    return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
