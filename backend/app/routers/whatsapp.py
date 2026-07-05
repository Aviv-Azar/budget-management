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

CONFIRM_WORDS = {"yes", "y", "confirm", "ok", "okay", "save"}
CANCEL_WORDS = {"no", "n", "cancel"}
CORRECTION_RE = re.compile(r"^(amount|date|merchant)\s+(.+)$", re.IGNORECASE)


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
                wa_from, "I can only handle text entries like \"Coffee 15\" or receipt photos right now."
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
    merchant = pending.merchant or "(not found)"
    date_str = pending.date.isoformat() if pending.date else "(not found)"
    amount_str = f"${pending.amount:.2f}" if pending.amount is not None else "(not found)"
    return (
        "📷 Got it:\n"
        f"Merchant: {merchant}\n"
        f"Date: {date_str}\n"
        f"Amount: {amount_str}\n\n"
        'Reply "yes" to save, "no" to cancel, or send a correction like '
        '"amount 12.50", "date 2026-07-03", or "merchant Trader Joe\'s".'
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
            'I didn\'t understand that. Try "Coffee 15" to log an expense, '
            '"+2500 salary" for income, or send a receipt photo.',
        )
        return

    account_id = _default_account_id(db)
    if account_id is None:
        whatsapp_client.send_text(wa_from, "Add an account in the app first, then try again.")
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
    reply = f"✅ Logged: {parsed['description']} {sign}${abs(parsed['amount']):.2f}"
    if category_name:
        reply += f" ({category_name})"
    reply += f" on {tx_date.isoformat()}"
    whatsapp_client.send_text(wa_from, reply)


def _handle_pending_reply(db, pending, body: str):
    lower = body.lower()
    if lower in CONFIRM_WORDS:
        _save_pending(db, pending)
        return
    if lower in CANCEL_WORDS:
        db.delete(pending)
        db.commit()
        whatsapp_client.send_text(pending.wa_from, "Cancelled.")
        return

    match = CORRECTION_RE.match(body)
    if match:
        field, value = match.group(1).lower(), match.group(2).strip()
        if field == "amount":
            try:
                pending.amount = abs(float(value.replace(",", "")))
            except ValueError:
                whatsapp_client.send_text(pending.wa_from, 'Couldn\'t read that amount, try "amount 12.50".')
                return
        elif field == "date":
            try:
                pending.date = date_parser.parse(value, fuzzy=True).date()
            except (ValueError, OverflowError):
                whatsapp_client.send_text(pending.wa_from, 'Couldn\'t read that date, try "date 2026-07-03".')
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
            pending.wa_from, "Missing an amount, or no account is set up yet — can't save this one."
        )
        db.delete(pending)
        db.commit()
        return

    description = pending.merchant or "Receipt"
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
    whatsapp_client.send_text(wa_from, f"✅ Saved: {description} -${abs(amount):.2f} on {tx_date.isoformat()}")


def handle_image_message(db, wa_from: str, media_id: str | None):
    if not media_id:
        whatsapp_client.send_text(wa_from, "Sorry, I couldn't read that image.")
        return
    try:
        content = whatsapp_client.download_media(media_id)
        result = ocr.scan_receipt_image(content)
    except Exception:
        whatsapp_client.send_text(wa_from, "Sorry, I couldn't read that receipt image.")
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
