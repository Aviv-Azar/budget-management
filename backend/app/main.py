import socket
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# Windows consoles default to a codepage (e.g. cp1252) that can't encode emoji;
# reply text and log lines both use them, so force UTF-8 regardless of launcher.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from . import categorize, config, models
from .database import Base, SessionLocal, engine
from .routers import accounts, categories, imports, receipts, transactions, whatsapp

Base.metadata.create_all(bind=engine)


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
    ("Salary", "income", "#22c55e"),
    ("Groceries", "expense", "#f97316"),
    ("Dining Out", "expense", "#ef4444"),
    ("Transport", "expense", "#3b82f6"),
    ("Utilities", "expense", "#eab308"),
    ("Rent/Mortgage", "expense", "#8b5cf6"),
    ("Shopping", "expense", "#ec4899"),
    ("Health", "expense", "#14b8a6"),
    ("Entertainment", "expense", "#f59e0b"),
    ("Other", "expense", "#64748b"),
]


def seed_defaults():
    db = SessionLocal()
    try:
        if db.query(models.Category).count() == 0:
            for name, kind, color in DEFAULT_CATEGORIES:
                db.add(models.Category(name=name, kind=kind, color=color))
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

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
