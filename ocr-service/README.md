# 임실 절임배추 스마트 주문관리 - PaddleOCR 서비스

OpenCV 이미지 전처리 및 PaddleOCR 한국어 문자 인식을 제공하는 마이크로서비스입니다.

## 로컬 실행 방법 (Python 3.10 권장)
```bash
cd ocr-service
pip install -r requirements.txt
python main.py
```

## Docker 실행 방법
```bash
cd ocr-service
docker build -t imsil-ocr .
docker run -p 8000:8000 imsil-ocr
```

## API 엔드포인트
- `GET /health`: 상태 확인
- `POST /ocr/order`: 문자 캡처 이미지 업로드 (`file: multipart/form-data`) -> JSON 텍스트 반환
