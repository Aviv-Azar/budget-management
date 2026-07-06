import hashlib
import hmac
import re
from datetime import date

from dateutil import parser as date_parser
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from sqlalchemy import select

from .. import categorize, config, models, ocr, text_parser, whatsapp_client
from ..database import SessionLocal
from ..dedup import make_dedup_key

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

CONFIRM_WORDS = {"yes", "y", "confirm", "ok", "okay", "save", "כן", "אישור", "שמור"}
CANCEL_WORDS = {"no", "n", "cancel", "לא", "ביטול"}
CORRECTION_RE = re.compile(r"^(amount|date|merchant|סכום|תאריך|בית עסק)\s+(.+)$", re.IGNORECASE)
CORRECTION_FIELDS = {
    "amount": "amount", "סכום": "amount",
    "date": "date", "תאריך": "date",
    "merchant": "merchant", "בית עסק": "merchant",
}


@router.get("/debug-config")
def debug_config():
    token = config.WHATSAPP_ACCESS_TOKEN
    return {
        "configured": config.whatsapp_configured(),
        "phone_number_id": config.WHATSAPP_PHONE_NUMBER_ID,
        "phone_number_id_length": len(config.WHATSAPP_PHONE_NUMBER_ID),
        "token_length": len(token),
        "token_last_8": token[-8:] if token else None,
        "allowed_from": config.WHATSAPP_ALLOWED_FROM,
        "graph_version": config.WHATSAPP_GRAPH_VERSION,
    }


@router.get("/webhook")
def verify_webhook(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == config.WHATSAPP_VERIFY_TOKEN:
        return Response(content=params.get("hub.challenge", ""), media_type="text/plain")
    raise HTTPException(403, "Verification failed")


def _verify_signature(raw_body: bytes, signature_header: str | None) -> bool:
    if not config.WHATSAPP_APP_SECRET:
        return True  # not configured yet — allowed only until setup is finished
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(config.WHATSAPP_APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.removeprefix("sha256="))


@router.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    raw_body = await request.body()
    if not _verify_signature(raw_body, request.headers.get("x-hub-signature-256")):
        raise HTTPException(403, "Invalid signature")

    payload = await request.json()
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for message in change.get("value", {}).get("messages", []):
                background_tasks.add_task(handle_message, message)
    return {"status": "ok"}


def handle_message(message: dict):
    db = SessionLocal()
    try:
        message_id = message.get("id")
        if message_id and db.query(models.ProcessedMessage).filter_by(message_id=message_id).first():
            return

        wa_from = message.get("from", "")
        if config.WHATSAPP_ALLOWED_FROM and wa_from != config.WHATSAPP_ALLOWED_FROM:
            return  # ignore anyone who isn't the configured owner

        msg_type = message.get("type")
        if msg_type == "text":
            handle_text_message(db, wa_from, message.get("text", {}).get("body", ""))
        elif msg_type == "image":
            handle_image_message(db, wa_from, message.get("image", {}).get("id"))
        else:
            whatsapp_client.send_text(
                wa_from, 'אני יודע לטפל רק בהודעות טקסט כמו "קפה 15" או בתמונות של קבלות כרגע.'
            )

        if message_id:
            db.add(models.ProcessedMessage(message_id=message_id))
            db.commit()
    except Exception as e:
        print(f"[whatsapp] error handling message: {e}", flush=True)
    finally:
        db.close()


def _default_account_id(db) -> int | None:
    if config.WHATSAPP_DEFAULT_ACCOUNT_ID:
        try:
            return int(config.WHATSAPP_DEFAULT_ACCOUNT_ID)
        except ValueError:
            pass
    first = db.scalars(select(models.Account).order_by(models.Account.id)).first()
    return first.id if first else None


def _latest_pending(db, wa_from: str):
    return db.scalars(
        select(models.PendingReceipt)
        .where(models.PendingReceipt.wa_from == wa_from)
        .order_by(models.PendingReceipt.created_at.desc())
    ).first()


def _format_draft_message(pending: "models.PendingReceipt") -> str:
    merchant = pending.merchant or "(לא נמצא)"
    date_str = pending.date.isoformat() if pending.date else "(לא נמצא)"
    amount_str = f"₪{pending.amount:.2f}" if pending.amount is not None else "(לא נמצא)"
    return (
        "📷 קיבלתי:\n"
        f"בית עסק: {merchant}\n"
        f"תאריך: {date_str}\n"
        f"סכום: {amount_str}\n\n"
        'השיבו "כן" לשמירה, "לא" לביטול, או שלחו תיקון כמו '
        '"סכום 12.50", "תאריך 2026-07-03", או "בית עסק שופרסל".'
    )


def handle_text_message(db, wa_from: str, body: str):
    body = body.strip()
    pending = _latest_pending(db, wa_from)

    if pending:
        _handle_pending_reply(db, pending, body)
        return

    parsed = text_parser.parse_quick_entry(body)
    if not parsed:
        whatsapp_client.send_text(
            wa_from,
            'לא הבנתי את זה. נסו "קפה 15" כדי לרשום הוצאה, '
            '"+2500 משכורת" להכנסה, או שלחו תמונה של קבלה.',
        )
        return

    account_id = _default_account_id(db)
    if account_id is None:
        whatsapp_client.send_text(wa_from, "הוסיפו חשבון באפליקציה קודם, ואז נסו שוב.")
        return

    category_id = categorize.guess_category_id(parsed["description"], db)
    tx_date = date.today()
    dedup_key = make_dedup_key(account_id, tx_date, parsed["amount"], parsed["description"])
    db.add(
        models.Transaction(
            account_id=account_id,
            category_id=category_id,
            date=tx_date,
            amount=parsed["amount"],
            description=parsed["description"],
            source="whatsapp",
            dedup_key=dedup_key,
        )
    )
    db.commit()

    category_name = db.get(models.Category, category_id).name if category_id else None
    sign = "+" if parsed["amount"] > 0 else "-"
    reply = f"✅ נרשם: {parsed['description']} {sign}₪{abs(parsed['amount']):.2f}"
    if category_name:
        reply += f" ({category_name})"
    reply += f" בתאריך {tx_date.isoformat()}"
    whatsapp_client.send_text(wa_from, reply)


def _handle_pending_reply(db, pending, body: str):
    lower = body.strip().lower()
    if lower in CONFIRM_WORDS:
        _save_pending(db, pending)
        return
    if lower in CANCEL_WORDS:
        db.delete(pending)
        db.commit()
        whatsapp_client.send_text(pending.wa_from, "בוטל.")
        return

    match = CORRECTION_RE.match(body)
    if match:
        field, value = CORRECTION_FIELDS[match.group(1).lower()], match.group(2).strip()
        if field == "amount":
            try:
                pending.amount = abs(float(value.replace(",", "")))
            except ValueError:
                whatsapp_client.send_text(pending.wa_from, 'לא הצלחתי לקרוא את הסכום, נסו "סכום 12.50".')
                return
        elif field == "date":
            try:
                pending.date = date_parser.parse(value, fuzzy=True).date()
            except (ValueError, OverflowError):
                whatsapp_client.send_text(pending.wa_from, 'לא הצלחתי לקרוא את התאריך, נסו "תאריך 2026-07-03".')
                return
        elif field == "merchant":
            pending.merchant = value
        db.commit()
        whatsapp_client.send_text(pending.wa_from, _format_draft_message(pending))
        return

    whatsapp_client.send_text(pending.wa_from, _format_draft_message(pending))


def _save_pending(db, pending):
    account_id = _default_account_id(db)
    if account_id is None or pending.amount is None:
        whatsapp_client.send_text(
            pending.wa_from, "חסר סכום, או שעדיין לא הוגדר חשבון — אי אפשר לשמור את זה."
        )
        db.delete(pending)
        db.commit()
        return

    description = pending.merchant or "קבלה"
    tx_date = pending.date or date.today()
    amount = -abs(pending.amount)
    category_id = categorize.guess_category_id(description, db)
    dedup_key = make_dedup_key(account_id, tx_date, amount, description)

    db.add(
        models.Transaction(
            account_id=account_id,
            category_id=category_id,
            date=tx_date,
            amount=amount,
            description=description,
            merchant=pending.merchant,
            source="whatsapp",
            dedup_key=dedup_key,
        )
    )
    wa_from = pending.wa_from
    db.delete(pending)
    db.commit()
    whatsapp_client.send_text(wa_from, f"✅ נשמר: {description} -₪{abs(amount):.2f} בתאריך {tx_date.isoformat()}")


def handle_image_message(db, wa_from: str, media_id: str | None):
    if not media_id:
        whatsapp_client.send_text(wa_from, "מצטער, לא הצלחתי לקרוא את התמונה הזו.")
        return
    try:
        content = whatsapp_client.download_media(media_id)
        result = ocr.scan_receipt_image(content)
    except Exception:
        whatsapp_client.send_text(wa_from, "מצטער, לא הצלחתי לקרוא את הקבלה הזו.")
        return

    pending = models.PendingReceipt(
        wa_from=wa_from,
        merchant=result.get("merchant"),
        date=result.get("date"),
        amount=result.get("amount"),
        raw_text=result.get("raw_text"),
    )
    db.add(pending)
    db.commit()
    whatsapp_client.send_text(wa_from, _format_draft_message(pending))
