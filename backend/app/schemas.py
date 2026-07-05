from datetime import date as date_
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class AccountBase(BaseModel):
    name: str
    type: str = "checking"


class AccountCreate(AccountBase):
    pass


class Account(AccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class CategoryBase(BaseModel):
    name: str
    kind: str = "expense"
    color: str = "#64748b"


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class TransactionBase(BaseModel):
    account_id: int
    category_id: int | None = None
    date: date_
    amount: float
    description: str
    merchant: str | None = None
    notes: str | None = None


class TransactionCreate(TransactionBase):
    source: Literal["manual", "ocr", "whatsapp"] = "manual"


class TransactionUpdate(BaseModel):
    account_id: int | None = None
    category_id: int | None = None
    date: date_ | None = None
    amount: float | None = None
    description: str | None = None
    merchant: str | None = None
    notes: str | None = None


class Transaction(TransactionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source: str
    created_at: datetime
    account: Account
    category: Category | None = None
