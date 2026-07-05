import httpx

from . import config


def _base_url() -> str:
    return f"https://graph.facebook.com/{config.WHATSAPP_GRAPH_VERSION}/{config.WHATSAPP_PHONE_NUMBER_ID}"


def send_text(to: str, body: str) -> None:
    # A reply is best-effort — a failure here must never roll back or re-trigger
    # the transaction write that already happened, so every path is swallowed.
    try:
        if not config.whatsapp_configured():
            print(f"[whatsapp] not configured, would have sent to {to}: {body}", flush=True)
            return
        resp = httpx.post(
            f"{_base_url()}/messages",
            headers={"Authorization": f"Bearer {config.WHATSAPP_ACCESS_TOKEN}"},
            json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": body}},
            timeout=15,
        )
        if resp.status_code >= 400:
            print(f"[whatsapp] send failed ({resp.status_code}): {resp.text}", flush=True)
    except Exception as e:
        print(f"[whatsapp] send error: {e}", flush=True)


def download_media(media_id: str) -> bytes:
    headers = {"Authorization": f"Bearer {config.WHATSAPP_ACCESS_TOKEN}"}
    meta = httpx.get(
        f"https://graph.facebook.com/{config.WHATSAPP_GRAPH_VERSION}/{media_id}",
        headers=headers,
        timeout=15,
    )
    meta.raise_for_status()
    media_url = meta.json()["url"]
    resp = httpx.get(media_url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.content
