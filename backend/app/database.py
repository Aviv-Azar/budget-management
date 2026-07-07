import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "")

if DATABASE_URL:
    # Render/Neon give postgres:// — SQLAlchemy's psycopg2 dialect wants postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    # Neon closes idle connections server-side; pool_pre_ping tests each pooled
    # connection before reuse and transparently reconnects if it's gone stale,
    # avoiding "SSL connection has been closed unexpectedly" on the first query
    # after a quiet period.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
else:
    DATA_DIR = Path(__file__).resolve().parent.parent / "data"
    DATA_DIR.mkdir(exist_ok=True)
    DATABASE_URL = f"sqlite:///{DATA_DIR / 'budget.db'}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
