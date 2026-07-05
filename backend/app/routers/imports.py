import json
import re
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..dedup import make_dedup_key

router = APIRouter(prefix="/api/import", tags=["import"])

AMOUNT_CLEAN_RE = re.compile(r"[^0-9.\-]")


def read_table(filename: str, content: bytes) -> pd.DataFrame:
    lower = filename.lower()
    if lower.endswith((".xlsx", ".xls")):
        return pd.read_excel(BytesIO(content), dtype=str)
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            return pd.read_csv(BytesIO(content), dtype=str, encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(400, "Could not decode file as CSV or Excel")


def clean_records(df: pd.DataFrame, limit: int | None = None) -> list[dict]:
    subset = df.head(limit) if limit else df
    return json.loads(subset.where(pd.notnull(subset), None).to_json(orient="records"))


def parse_amount(raw) -> float | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    negative = text.startswith("(") and text.endswith(")")
    text = AMOUNT_CLEAN_RE.sub("", text)
    if not text or text in ("-", "."):
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return -abs(value) if negative else value


@router.post("/preview")
async def preview_import(
    file: UploadFile,
    account_id: int = Form(...),
    db: Session = Depends(get_db),
):
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    content = await file.read()
    df = read_table(file.filename, content)
    if df.empty:
        raise HTTPException(400, "The file has no rows")

    saved_mapping = json.loads(account.import_mapping) if account.import_mapping else None

    return {
        "columns": list(df.columns),
        "rows": clean_records(df, limit=8),
        "row_count": len(df),
        "saved_mapping": saved_mapping,
    }


@router.post("/commit")
async def commit_import(
    file: UploadFile,
    account_id: int = Form(...),
    mapping: str = Form(...),
    db: Session = Depends(get_db),
):
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    try:
        m = json.loads(mapping)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid mapping JSON")

    required = ["date_col", "description_col", "amount_mode"]
    if any(m.get(k) in (None, "") for k in required):
        raise HTTPException(400, f"Mapping must include: {', '.join(required)}")
    if m["amount_mode"] == "single" and not m.get("amount_col"):
        raise HTTPException(400, "amount_col is required for amount_mode=single")
    if m["amount_mode"] == "debit_credit" and not (m.get("debit_col") or m.get("credit_col")):
        raise HTTPException(400, "debit_col and/or credit_col required for amount_mode=debit_credit")

    content = await file.read()
    df = read_table(file.filename, content)
    records = clean_records(df)

    existing_keys = set(
        db.scalars(
            select(models.Transaction.dedup_key).where(
                models.Transaction.account_id == account_id,
                models.Transaction.dedup_key.is_not(None),
            )
        ).all()
    )

    imported, skipped_duplicates, errors = 0, 0, []
    new_transactions = []

    for i, row in enumerate(records, start=2):  # start=2: row 1 is the header in the source file
        raw_date = row.get(m["date_col"])
        tx_date = pd.to_datetime(raw_date, dayfirst=bool(m.get("dayfirst")), errors="coerce")
        if pd.isna(tx_date):
            errors.append({"row": i, "reason": f"Could not parse date '{raw_date}'"})
            continue

        if m["amount_mode"] == "single":
            amount = parse_amount(row.get(m["amount_col"]))
            if amount is not None and m.get("flip_sign"):
                amount = -amount
        else:
            debit = parse_amount(row.get(m.get("debit_col"))) or 0
            credit = parse_amount(row.get(m.get("credit_col"))) or 0
            amount = credit - debit

        if amount is None:
            errors.append({"row": i, "reason": "Could not parse amount"})
            continue

        description = str(row.get(m["description_col"]) or "").strip()
        if not description:
            errors.append({"row": i, "reason": "Missing description"})
            continue
        merchant = None
        if m.get("merchant_col"):
            merchant = str(row.get(m["merchant_col"]) or "").strip() or None

        tx_date = tx_date.date()
        dedup_key = make_dedup_key(account_id, tx_date, amount, description)
        if dedup_key in existing_keys:
            skipped_duplicates += 1
            continue
        existing_keys.add(dedup_key)

        new_transactions.append(
            models.Transaction(
                account_id=account_id,
                category_id=None,
                date=tx_date,
                amount=amount,
                description=description,
                merchant=merchant,
                source="import",
                dedup_key=dedup_key,
            )
        )
        imported += 1

    db.add_all(new_transactions)
    account.import_mapping = json.dumps(m)
    db.commit()

    return {
        "total_rows": len(records),
        "imported": imported,
        "skipped_duplicates": skipped_duplicates,
        "skipped_errors": len(errors),
        "errors": errors[:20],
    }
