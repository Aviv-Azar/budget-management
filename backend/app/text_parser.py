import re

AMOUNT_TOKEN_RE = re.compile(r"[+-]?\d+(?:\.\d{1,2})?")


def parse_quick_entry(message: str) -> dict | None:
    text = message.strip()
    if not text:
        return None

    is_income = text.startswith("+")
    if is_income:
        text = text[1:].strip()

    tokens = text.split()
    if not tokens:
        return None

    if AMOUNT_TOKEN_RE.fullmatch(tokens[0]):
        amount_index = 0
    elif AMOUNT_TOKEN_RE.fullmatch(tokens[-1]):
        amount_index = len(tokens) - 1
    else:
        return None

    amount = float(tokens[amount_index])
    if amount == 0:
        return None

    description = " ".join(tokens[:amount_index] + tokens[amount_index + 1 :]).strip()
    if not description:
        description = "רשומת וואטסאפ"

    return {"description": description, "amount": amount if is_income else -abs(amount)}
