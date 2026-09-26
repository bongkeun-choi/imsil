"""
절임배추 주문 문자 전용 PaddleOCR 마이크로서비스 (FastAPI)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from preprocess import preprocess_order_image
import uvicorn
import re

app = FastAPI(
    title="Imsil Order PaddleOCR Service",
    description="문자 캡처 이미지로부터 한국어 텍스트 및 주문 정보를 정밀 추출하는 OCR 마이크로서비스",
    version="1.0.0",
)

# 브라우저 직접 호출 지원을 위한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PaddleOCR 인스턴스 지연 로딩
ocr_engine = None


def get_ocr():
    global ocr_engine
    if ocr_engine is None:
        try:
            from paddleocr import PaddleOCR
            # 한국어(korean) 모델 초기화
            ocr_engine = PaddleOCR(use_angle_cls=True, lang="korean")
        except Exception as e:
            print(f"PaddleOCR init error: {e}")
            ocr_engine = None
    return ocr_engine


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "imsil-paddleocr"}


@app.post("/ocr/order")
async def process_order_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    contents = await file.read()

    # 1. OpenCV 이미지 전처리
    try:
        processed_img = preprocess_order_image(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"이미지 전처리 실패: {str(e)}")

    # 2. PaddleOCR 실행
    engine = get_ocr()
    if engine is None:
        raise HTTPException(
            status_code=503,
            detail="PaddleOCR 엔진이 준비되지 않았습니다. paddlepaddle 패키지를 확인해 주세요.",
        )

    try:
        result = engine.ocr(processed_img, cls=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR 분석 오류: {str(e)}")

    lines = []
    total_conf = 0.0
    box_count = 0

    if result and len(result) > 0 and result[0] is not None:
        for line in result[0]:
            text, conf = line[1]
            lines.append(text)
            total_conf += conf
            box_count += 1

    raw_text = "\n".join(lines)
    avg_conf = (total_conf / box_count) if box_count > 0 else 0.0

    return {
        "text": raw_text,
        "raw_text": raw_text,
        "confidence": round(avg_conf, 4),
        "lines": lines,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
