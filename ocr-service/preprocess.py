"""
OpenCV 기반 문자 캡처 이미지 전처리 파이프라인
"""

import cv2
import numpy as np


def preprocess_order_image(image_bytes: bytes) -> np.ndarray:
    """
    1. 바이트 데이터 디코딩
    2. 적정 해상도로 리사이징
    3. 그레이스케일 변환
    4. CLAHE(적응형 히스토그램 균일화)를 통한 대비 극대화
    5. 가우시안 블러를 통한 미세 노이즈 제거
    """
    # 디코딩
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Invalid image file")

    h, w = img.shape[:2]
    max_dim = 1800
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # 흑백 변환
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 대비 향상 (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # 미세 노이즈 제거
    denoised = cv2.GaussianBlur(enhanced, (3, 3), 0)

    # 다시 3채널로 변환 (PaddleOCR 입력 규격 준수)
    final_img = cv2.cvtColor(denoised, cv2.COLOR_GRAY2BGR)
    return final_img
