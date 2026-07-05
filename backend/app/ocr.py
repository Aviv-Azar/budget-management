import re
import shutil
from datetime import date, datetime
from io import BytesIO
from pathlib import Path

import pytesseract
from dateutil import parser as date_parser
from PIL import Image, ImageOps

WINDOWS_DEFAULT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

AMOUNT_RE = re.compile(r"\d{1,3}(?:[,.]\d{3})*[.,]\d{2}\b")
TOTAL_KEYWORDS = ("total", "amount due", "balance due", "grand total", "amount")
NOISE_LINE_RE = re.compile(r"^[\W_]*$")
DATE_LIKE_RE = re.compile(
    r"\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}|"
    r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b",
    re.IGNORECASE,
)


class OcrUnavailable(RuntimeError):
    pass


def _configure_tesseract():
    found = shutil.which("tesseract")
    if found:
        pytesseract.pytesseract.tesseract_cmd = found
    elif Path(WINDOWS_DEFAULT_PATH).exists():
        pytesseract.pytesseract.tesseract_cmd = WINDOWS_DEFAULT_PATH


_configure_tesseract()


def preprocess_image(content: bytes) -> Image.Image:
    image = Image.open(BytesIO(content))
    image = ImageOps.exif_transpose(image)  # respect phone camera orientation
    image = image.convert("L")  # grayscale
    if max(image.size) > 2200:
        scale = 2200 / max(image.size)
        image = image.resize((int(image.width * scale), int(image.height * scale)))
    image = ImageOps.autocontrast(image)
    return image


def _parse_amount(text: str) -> float | None:
    lines = text.splitlines()
    for line in lines:
        lower = line.lower()
        if any(kw in lower for kw in TOTAL_KEYWORDS):
            matches = AMOUNT_RE.findall(line)
            if matches:
                return _to_float(matches[-1])

    all_matches = AMOUNT_RE.findall(text)
    if not all_matches:
        return None
    return max(_to_float(m) for m in all_matches)


def _to_float(raw: str) -> float:
    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")  # "1.234,56" (EU style)
        else:
            raw = raw.replace(",", "")  # "1,234.56" (US style)
    elif "," in raw:
        raw = raw.replace(",", ".")  # "12,34"
    return float(raw)


def _parse_date(text: str) -> date | None:
    for line in text.splitlines():
        if not DATE_LIKE_RE.search(line):
            continue
        try:
            parsed = date_parser.parse(line, fuzzy=True, dayfirst=False)
        except (ValueError, OverflowError):
            continue
        if 2000 <= parsed.year <= datetime.now().year + 1:
            return parsed.date()
    return None


def _parse_merchant(text: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or NOISE_LINE_RE.match(stripped):
            continue
        if not re.search(r"[A-Za-z]{3,}", stripped):
            continue
        return stripped[:100]
    return None


def scan_receipt_image(content: bytes) -> dict:
    try:
        image = preprocess_image(content)
        text = pytesseract.image_to_string(image)
    except pytesseract.TesseractNotFoundError as e:
        raise OcrUnavailable(
            "Tesseract OCR isn't installed or couldn't be found on this PC."
        ) from e

    return {
        "merchant": _parse_merchant(text),
        "date": _parse_date(text),
        "amount": _parse_amount(text),
        "raw_text": text,
    }
