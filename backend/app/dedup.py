import hashlib
from datetime import date


def make_dedup_key(account_id: int, tx_date: date, amount: float, description: str) -> str:
    normalized = f"{account_id}|{tx_date.isoformat()}|{amount:.2f}|{description.strip().lower()}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:32]
