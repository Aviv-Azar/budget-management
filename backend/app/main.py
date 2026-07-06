import socket
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

# Windows consoles default to a codepage (e.g. cp1252) that can't encode emoji;
# reply text and log lines both use them, so force UTF-8 regardless of launcher.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from . import categorize, config, models
from .database import Base, SessionLocal, engine
from .routers import accounts, budgets, categories, dashboard, imports, receipts, transactions, whatsapp

Base.metadata.create_all(bind=engine)


def run_light_migrations():
    """Add columns to tables that already existed before this code was deployed.
    create_all() only creates missing tables, so pre-existing tables need this."""
    inspector = inspect(engine)
    if "categories" in inspector.get_table_names():
        columns = {c["name"] for c in inspector.get_columns("categories")}
        if "group" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE categories ADD COLUMN \"group\" VARCHAR(20) DEFAULT 'variable'"))


run_light_migrations()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()

DEFAULT_CATEGORIES = [
    ("משכורת", "income", "#22c55e", "income"),
    ("מכולת", "expense", "#c2620f", "variable"),
    ("מסעדות", "expense", "#ef4444", "variable"),
    ("תחבורה", "expense", "#3b82f6", "variable"),
    ("חשבונות", "expense", "#b8860b", "bills"),
    ("שכירות/משכנתא", "expense", "#8b5cf6", "bills"),
    ("קניות", "expense", "#ec4899", "variable"),
    ("בריאות", "expense", "#0d9488", "variable"),
    ("בידור", "expense", "#d97706", "variable"),
    ("חיסכון והשקעות", "expense", "#0891b2", "savings"),
    ("הלוואות", "expense", "#a855f7", "loan"),
    ("אחר", "expense", "#c2185b", "variable"),
]


def seed_defaults():
    db = SessionLocal()
    try:
        if db.query(models.Category).count() == 0:
            for name, kind, color, group in DEFAULT_CATEGORIES:
                db.add(models.Category(name=name, kind=kind, color=color, group=group))
            db.commit()
    finally:
        db.close()


def seed_category_keywords():
    db = SessionLocal()
    try:
        categorize.seed_keywords(db)
    finally:
        db.close()


seed_defaults()
seed_category_keywords()

app = FastAPI(title="Budget Management")


@app.on_event("startup")
def print_startup_info():
    if config.IS_CLOUD:
        print("\n  Running on Render — serving on the platform-assigned port.\n", flush=True)
    else:
        print(f"\n  Open on this PC:     http://127.0.0.1:8000", flush=True)
        print(f"  Open from your phone: http://{lan_ip()}:8000  (same Wi-Fi network)\n", flush=True)
    if not config.whatsapp_configured():
        print("  WhatsApp bot: not configured yet (see backend/.env.example)\n", flush=True)


app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(imports.router)
app.include_router(receipts.router)
app.include_router(whatsapp.router)
app.include_router(budgets.router)
app.include_router(dashboard.router)

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
