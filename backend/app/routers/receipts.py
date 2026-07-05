from fastapi import APIRouter, HTTPException, UploadFile

from .. import ocr

router = APIRouter(prefix="/api/receipts", tags=["receipts"])


@router.post("/scan")
async def scan_receipt(file: UploadFile):
    content = await file.read()
    try:
        result = ocr.scan_receipt_image(content)
    except ocr.OcrUnavailable as e:
        raise HTTPException(503, str(e))
    return result
