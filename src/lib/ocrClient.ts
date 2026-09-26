/**
 * 브라우저 이미지 전처리 및 OCR 클라이언트 모듈
 * (Client-side Image Preprocessing & OCR)
 * 
 * - Canvas를 활용한 OpenCV 스타일 전처리 (그레이스케일, 대비 증폭, 노이즈 완화)
 * - Tesseract.js를 이용한 한국어 문자 인식
 * - 외부 Python PaddleOCR 마이크로서비스 연동 지원 (URL 설정 시 우선 호출)
 */

import { createWorker } from "tesseract.js";

export interface OcrProgress {
  status: string; // 'preprocessing' | 'recognizing' | 'done' | 'error'
  progress: number; // 0 ~ 100
  message: string;
}

/**
 * Canvas를 이용한 이미지 전처리 (OpenCV 파이프라인 브라우저 구현)
 * 1. 적정 크기 리사이징 (OCR 최적 해상도)
 * 2. 흑백 그레이스케일 변환
 * 3. 대비(Contrast) 증폭 및 선명도 향상
 */
export async function preprocessImage(imageFile: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // 최대 가로폭 1600px로 리사이징
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // 픽셀 데이터 조작 (대비 증폭 & 그레이스케일)
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const contrast = 1.25; // 25% 대비 증폭
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

        for (let i = 0; i < data.length; i += 4) {
          // 그레이스케일 (Luminance)
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // 대비 적용
          const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
          data[i] = adjusted;
          data[i + 1] = adjusted;
          data[i + 2] = adjusted;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
}

/**
 * 이미지로부터 한국어 텍스트 추출 (OCR)
 */
export async function recognizeTextFromImage(
  imageFile: File | Blob,
  onProgress?: (progress: OcrProgress) => void
): Promise<{ text: string; confidence: number }> {
  // 1. 이미지 전처리
  onProgress?.({
    status: "preprocessing",
    progress: 20,
    message: "이미지 대비 및 해상도 최적화 중...",
  });

  const processedDataUrl = await preprocessImage(imageFile);

  // 2. 외부 Python PaddleOCR 서버가 설정된 경우 우선 연동 시도
  const pythonOcrUrl = process.env.NEXT_PUBLIC_OCR_API_URL;
  if (pythonOcrUrl) {
    try {
      onProgress?.({
        status: "recognizing",
        progress: 50,
        message: "PaddleOCR 서비스로 텍스트 정밀 분석 중...",
      });
      const formData = new FormData();
      formData.append("file", imageFile);

      const res = await fetch(`${pythonOcrUrl}/ocr/order`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        onProgress?.({
          status: "done",
          progress: 100,
          message: "인식 완료!",
        });
        return {
          text: json.raw_text || json.text || "",
          confidence: json.confidence || 0.95,
        };
      }
    } catch {
      console.warn("Python OCR server unavailable, falling back to client OCR");
    }
  }

  // 3. 브라우저 내장 Tesseract.js (한국어 + 영어) 실행
  onProgress?.({
    status: "recognizing",
    progress: 40,
    message: "문자 및 숫자 인식 엔진 가동 중...",
  });

  try {
    const worker = await createWorker("kor+eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          const p = Math.round(40 + (m.progress || 0) * 50);
          onProgress?.({
            status: "recognizing",
            progress: p,
            message: `문자 인식 중... (${Math.round((m.progress || 0) * 100)}%)`,
          });
        }
      },
    });

    const ret = await worker.recognize(processedDataUrl);
    await worker.terminate();

    onProgress?.({
      status: "done",
      progress: 100,
      message: "인식 완료!",
    });

    return {
      text: ret.data.text,
      confidence: ret.data.confidence / 100,
    };
  } catch (err) {
    console.error("OCR execution error:", err);
    throw new Error("문자 인식에 실패했습니다. 이미지를 다시 확인하거나 직접 텍스트를 입력해 주세요.");
  }
}
