from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models

DEFAULT_KEYWORDS = {
    "מכולת": ["grocery", "groceries", "supermarket", "market", "שופרסל", "רמי לוי", "סופר", "מכולת"],
    "מסעדות": ["coffee", "cafe", "restaurant", "starbucks", "pizza", "קפה", "מסעדה", "בית קפה", "פיצה"],
    "תחבורה": ["gas", "fuel", "uber", "taxi", "parking", "bus fare", "דלק", "מונית", "חניה", "אוטובוס", "רכבת"],
    "חשבונות": ["electric", "water bill", "internet bill", "phone bill", "utility", "חשמל", "מים", "אינטרנט", "סלולר"],
    "שכירות/משכנתא": ["rent", "mortgage", "שכירות", "משכנתא", "דירה"],
    "קניות": ["amazon", "shopping", "clothes", "mall", "קניות", "בגדים", "קניון"],
    "בריאות": ["pharmacy", "doctor", "gym", "clinic", "hospital", "בית מרקחת", "רופא", "חדר כושר", "קופת חולים"],
    "בידור": ["movie", "netflix", "spotify", "cinema", "concert", "קולנוע", "סרט", "הופעה"],
}


def seed_keywords(db: Session):
    categories_by_name = {c.name: c for c in db.scalars(select(models.Category)).all()}
    existing = {(k.category_id, k.keyword) for k in db.scalars(select(models.CategoryKeyword)).all()}
    added = False
    for category_name, keywords in DEFAULT_KEYWORDS.items():
        category = categories_by_name.get(category_name)
        if not category:
            continue
        for keyword in keywords:
            if (category.id, keyword) in existing:
                continue
            db.add(models.CategoryKeyword(category_id=category.id, keyword=keyword))
            added = True
    if added:
        db.commit()


def guess_category_id(description: str, db: Session) -> int | None:
    text = description.lower()
    for row in db.scalars(select(models.CategoryKeyword)).all():
        if row.keyword in text:
            return row.category_id
    return None
