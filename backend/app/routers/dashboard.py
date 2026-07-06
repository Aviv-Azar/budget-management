import calendar
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

GROUP_ORDER = ["income", "savings", "bills", "variable", "loan"]


@router.get("")
def get_dashboard(month: date, db: Session = Depends(get_db)):
    month_start = month.replace(day=1)
    month_end = month_start.replace(day=calendar.monthrange(month_start.year, month_start.month)[1])

    categories = db.scalars(select(models.Category)).all()
    budgets = db.scalars(select(models.Budget).where(models.Budget.month == month_start)).all()
    target_by_category = {b.category_id: float(b.target_amount) for b in budgets}

    transactions = db.scalars(
        select(models.Transaction).where(
            models.Transaction.date >= month_start,
            models.Transaction.date <= month_end,
        )
    ).all()
    actual_by_category = {}
    for t in transactions:
        if t.category_id is None:
            continue
        actual_by_category.setdefault(t.category_id, 0.0)
        actual_by_category[t.category_id] += float(t.amount)

    groups = {g: {"group": g, "target": 0.0, "actual": 0.0, "categories": []} for g in GROUP_ORDER}
    for c in categories:
        target = target_by_category.get(c.id, 0.0)
        raw_actual = actual_by_category.get(c.id, 0.0)
        actual = raw_actual if c.kind == "income" else abs(min(raw_actual, 0.0))
        bucket = groups.setdefault(c.group, {"group": c.group, "target": 0.0, "actual": 0.0, "categories": []})
        bucket["target"] += target
        bucket["actual"] += actual
        bucket["categories"].append(
            {"category_id": c.id, "name": c.name, "color": c.color, "target": target, "actual": actual}
        )

    income = groups["income"]
    expense_groups = [groups[g] for g in GROUP_ORDER if g != "income"]
    expense_target = sum(g["target"] for g in expense_groups)
    expense_actual = sum(g["actual"] for g in expense_groups)

    all_expense_categories = [c for g in expense_groups for c in g["categories"] if c["actual"] > 0]
    all_expense_categories.sort(key=lambda c: c["actual"], reverse=True)
    top_expenses = [
        {**c, "percent": round((c["actual"] / expense_actual * 100), 1) if expense_actual else 0}
        for c in all_expense_categories[:10]
    ]

    return {
        "month": month_start.isoformat(),
        "income": {"target": income["target"], "actual": income["actual"]},
        "expense": {"target": expense_target, "actual": expense_actual},
        "remaining": income["actual"] - expense_actual,
        "groups": [groups[g] for g in GROUP_ORDER],
        "top_expenses": top_expenses,
    }
