from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models

DEFAULT_KEYWORDS = {
    "Groceries": ["grocery", "groceries", "supermarket", "market", "walmart", "costco", "trader joe"],
    "Dining Out": ["coffee", "cafe", "restaurant", "lunch", "dinner", "starbucks", "mcdonald", "pizza"],
    "Transport": ["gas", "fuel", "uber", "lyft", "taxi", "parking", "train", "bus fare"],
    "Utilities": ["electric", "water bill", "internet bill", "phone bill", "utility"],
    "Rent/Mortgage": ["rent", "mortgage"],
    "Shopping": ["amazon", "shopping", "clothes", "mall"],
    "Health": ["pharmacy", "doctor", "gym", "clinic", "hospital"],
    "Entertainment": ["movie", "netflix", "spotify", "cinema", "concert"],
}


def seed_keywords(db: Session):
    if db.query(models.CategoryKeyword).count() > 0:
        return
    categories_by_name = {c.name: c for c in db.scalars(select(models.Category)).all()}
    for category_name, keywords in DEFAULT_KEYWORDS.items():
        category = categories_by_name.get(category_name)
        if not category:
            continue
        for keyword in keywords:
            db.add(models.CategoryKeyword(category_id=category.id, keyword=keyword))
    db.commit()


def guess_category_id(description: str, db: Session) -> int | None:
    text = description.lower()
    for row in db.scalars(select(models.CategoryKeyword)).all():
        if row.keyword in text:
            return row.category_id
    return None
