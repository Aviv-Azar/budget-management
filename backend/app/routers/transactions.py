from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..dedup import make_dedup_key

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=list[schemas.Transaction])
def list_transactions(
    account_id: int | None = None,
    category_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(models.Transaction).options(
        selectinload(models.Transaction.account),
        selectinload(models.Transaction.category),
    )
    if account_id is not None:
        stmt = stmt.where(models.Transaction.account_id == account_id)
    if category_id is not None:
        stmt = stmt.where(models.Transaction.category_id == category_id)
    if date_from is not None:
        stmt = stmt.where(models.Transaction.date >= date_from)
    if date_to is not None:
        stmt = stmt.where(models.Transaction.date <= date_to)
    stmt = stmt.order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
    return db.scalars(stmt).all()


@router.post("", response_model=schemas.Transaction, status_code=201)
def create_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    dedup_key = make_dedup_key(data["account_id"], data["date"], data["amount"], data["description"])
    transaction = models.Transaction(**data, dedup_key=dedup_key)
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.put("/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(
    transaction_id: int, payload: schemas.TransactionUpdate, db: Session = Depends(get_db)
):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise HTTPException(404, "Transaction not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(transaction, key, value)
    transaction.dedup_key = make_dedup_key(
        transaction.account_id, transaction.date, float(transaction.amount), transaction.description
    )
    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise HTTPException(404, "Transaction not found")
    db.delete(transaction)
    db.commit()
