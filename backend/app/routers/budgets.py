from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


@router.get("", response_model=list[schemas.Budget])
def list_budgets(month: date, db: Session = Depends(get_db)):
    stmt = (
        select(models.Budget)
        .where(models.Budget.month == month)
        .options(selectinload(models.Budget.category))
    )
    return db.scalars(stmt).all()


@router.put("", response_model=schemas.Budget)
def upsert_budget(payload: schemas.BudgetUpsert, db: Session = Depends(get_db)):
    existing = db.scalars(
        select(models.Budget).where(
            models.Budget.category_id == payload.category_id,
            models.Budget.month == payload.month,
        )
    ).first()
    if existing:
        existing.target_amount = payload.target_amount
        budget = existing
    else:
        budget = models.Budget(**payload.model_dump())
        db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget
