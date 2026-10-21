import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from urllib.parse import quote_plus
load_dotenv()

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Kunal@123")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "army_vehicle_db")

# Construct the SQLAlchemy database connection URL using psycopg driver
DATABASE_URL = os.getenv(
    "DATABASE_URL",
   f"postgresql+psycopg://{DB_USER}:{quote_plus(DB_PASSWORD)}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Ensure psycopg 3 driver is specified if generic postgresql:// is provided
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

def ensure_database_exists():
    """Ensure the target PostgreSQL database exists; create it if missing."""
    if not DB_NAME or DB_NAME == "postgres":
        return
    try:
        import psycopg
        admin_conn_str = f"host={DB_HOST} port={DB_PORT} user={DB_USER} password={DB_PASSWORD} dbname=postgres"
        with psycopg.connect(admin_conn_str, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
                if not cur.fetchone():
                    safe_db_name = DB_NAME.replace('"', '""')
                    cur.execute(f'CREATE DATABASE "{safe_db_name}"')
                    print(f"PostgreSQL database '{DB_NAME}' created automatically.")
    except Exception:
        # Proceed gracefully if user connects with a restricted role or pre-configured DB
        pass

ensure_database_exists()

engine = create_engine(DATABASE_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

