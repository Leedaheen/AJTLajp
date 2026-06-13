"""
사용계획서 이미지 파싱 엔드포인트
업로드된 이미지를 Claude Vision API로 분석하여 반입 신청 폼 데이터를 반환합니다.
"""
import base64
import json
import re
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from auth import get_current_user

try:
    import anthropic
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

from config import ANTHROPIC_API_KEY

router = APIRouter()

ALLOWED_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/gif", "image/webp", "application/pdf",
}
MAX_SIZE_MB = 10

PARSE_PROMPT = """이 이미지는 건설 현장의 "Table Lift 사용계획서" 문서입니다.
다음 필드를 추출해서 반드시 JSON 형식으로만 답하세요. 설명 없이 JSON만 출력하세요.

추출 항목:
- company: 협력사명 (예: "㈜신보", "세보엠이씨" 등)
- specs: 장비 제원 및 수량 배열. 각 항목은 {"spec": "16M", "qty": 2} 형태. 제원은 6M/8M/10M/12M/14M/16M/16M굴절/18M/20M굴절 중 하나로 정규화하세요.
  요청 수량 예시: "[16M] : 2대" → [{"spec":"16M","qty":2}], "14m - 8대" → [{"spec":"14M","qty":8}]
- location: 사용 장소 (예: "P5,P6-복합동 1층 H~K/43~61", "P4-복합동 7층 A~F/36~66")
- floor: 층 정보만 따로 추출 (예: "1층", "7층") — location에서 추출
- work_content: 작업 내용 (예: "인입고압, LV 트레이 작업", "케이블 포설 작업")
- start_date: 요청기간 시작일을 YYYY-MM-DD 형식으로 변환 (예: "'26.6.10" → "2026-06-10", "26/06/23" → "2026-06-23")
- end_date: 요청기간 종료일을 YYYY-MM-DD 형식으로 변환
- site_code: 현장 코드. 문서에서 P4 언급이 있으면 "P4", P5 언급이 있으면 "P5", 둘 다 있으면 "P4"

추출 불가 필드는 null로 설정하세요.

예시 응답:
{
  "company": "㈜신보",
  "specs": [{"spec": "16M", "qty": 2}],
  "location": "P5,P6-복합동 1층 H~K/43~61",
  "floor": "1층",
  "work_content": "인입고압, LV 트레이 작업",
  "start_date": "2026-06-10",
  "end_date": "2026-12-30",
  "site_code": "P5"
}"""


@router.post("/parse-doc")
async def parse_doc(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """사용계획서 이미지를 업로드하면 Claude Vision API로 파싱하여 폼 데이터를 반환합니다."""
    if not _ANTHROPIC_AVAILABLE:
        raise HTTPException(503, "anthropic 라이브러리가 설치되지 않았습니다.")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY가 설정되지 않았습니다.")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"지원하지 않는 파일 형식입니다: {content_type}")

    raw = await file.read()
    if len(raw) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"파일 크기가 {MAX_SIZE_MB}MB를 초과합니다.")

    # PDF는 이미지로 변환 후 처리
    if content_type == "application/pdf":
        try:
            raw, content_type = _pdf_first_page_to_image(raw)
        except Exception as e:
            raise HTTPException(400, f"PDF 변환 실패: {str(e)}")

    # base64 인코딩
    media_type = content_type if content_type in ("image/jpeg","image/png","image/gif","image/webp") else "image/jpeg"
    b64 = base64.standard_b64encode(raw).decode("utf-8")

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": PARSE_PROMPT},
                ],
            }],
        )
    except Exception as e:
        raise HTTPException(502, f"Claude API 오류: {str(e)}")

    raw_text = message.content[0].text.strip()

    # JSON 블록 추출 (```json ... ``` 형태 또는 순수 JSON)
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if json_match:
        raw_text = json_match.group(1)
    else:
        # 첫 { ~ 마지막 } 추출
        start = raw_text.find("{")
        end   = raw_text.rfind("}") + 1
        if start >= 0 and end > start:
            raw_text = raw_text[start:end]

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(422, "문서를 인식할 수 없습니다. 선명한 이미지를 다시 업로드해주세요.")

    return {"success": True, "data": data}


def _pdf_first_page_to_image(pdf_bytes: bytes) -> tuple[bytes, str]:
    """PDF 첫 페이지를 JPEG 이미지로 변환합니다. pdf2image(poppler) 또는 PyMuPDF 사용."""
    try:
        import fitz  # PyMuPDF
        doc  = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        mat  = fitz.Matrix(2, 2)   # 2× 해상도
        pix  = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("jpeg")
        doc.close()
        return img_bytes, "image/jpeg"
    except ImportError:
        pass

    try:
        from pdf2image import convert_from_bytes
        from io import BytesIO
        images = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, dpi=200)
        buf = BytesIO()
        images[0].save(buf, format="JPEG")
        return buf.getvalue(), "image/jpeg"
    except ImportError:
        pass

    raise RuntimeError("PDF 변환 라이브러리가 없습니다. PyMuPDF 또는 pdf2image를 설치하세요.")
