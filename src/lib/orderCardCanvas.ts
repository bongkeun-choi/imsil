/**
 * 주문 확인서 / 영수증 카드 캔버스 이미지 생성 유틸리티
 * 사용자가 제공한 "장모님 절임배추" 고화질 템플릿 이미지 위에
 * 주문 정보(품목, 20kg 수량, 금액, 연락처, 계좌번호, 도착희망일)를 합성하여
 * 카카오톡 / 문자 / 다운로드용 프리미엄 이미지 카드를 생성합니다.
 */

export interface OrderCardData {
  orderNo: string;
  customerName: string;
  customerPhone: string;
  shippingDate: string;
  shippingAddress: string;
  shippingAddressDetail?: string;
  itemsSummary: string;
  totalAmount: number;
  paymentStatus: "PAID" | "UNPAID";
  memo?: string;
  shopName: string;
  shopPhone: string;
  bankName: string;
  bankAccount: string;
  ownerName: string;
}

/**
 * 템플릿 이미지 로더
 */
function loadTemplateImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * 주문 정보를 바탕으로 고해상도 PNG 카드 이미지를 생성합니다.
 */
export async function generateOrderCardImage(
  data: OrderCardData
): Promise<{ dataUrl: string; file: File; blob: Blob }> {
  // basePath 감지 (GitHub Pages: /imsil, 로컬: "")
  const isBrowser = typeof window !== "undefined";
  const basePath =
    isBrowser && window.location.pathname.startsWith("/imsil") ? "/imsil" : "";
  const primaryTemplateUrl = `${basePath}/images/template_clean.png`;
  const fallbackTemplateUrl = `/images/template_clean.png`;

  let templateImg: HTMLImageElement | null = null;
  if (isBrowser) {
    try {
      templateImg = await loadTemplateImage(primaryTemplateUrl);
    } catch {
      try {
        templateImg = await loadTemplateImage(fallbackTemplateUrl);
      } catch (err) {
        console.warn("템플릿 이미지 로드 실패, 벡터 카드로 대체 렌더링합니다:", err);
      }
    }
  }

  // 1. 템플릿 이미지가 로드된 경우: "장모님 절임배추" 전용 고화질 합성
  if (templateImg) {
    return renderJangmonimTemplateCard(templateImg, data);
  }

  // 2. 템플릿 로드 실패 시 폴백 렌더러
  return renderFallbackVectorCard(data);
}

/**
 * 장모님 절임배추 템플릿 기반 2x 레티나 합성 렌더러
 */
function renderJangmonimTemplateCard(
  templateImg: HTMLImageElement,
  data: OrderCardData
): Promise<{ dataUrl: string; file: File; blob: Blob }> {
  const baseW = 682;
  const baseH = 1024;
  const scale = 2; // 초고해상도 (1364 x 2048) 2x Retina 지원

  const canvas = document.createElement("canvas");
  canvas.width = baseW * scale;
  canvas.height = baseH * scale;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("CANVAS_NOT_SUPPORTED");
  }

  // 2x 스케일링 적용
  ctx.scale(scale, scale);

  // 1. 깨끗한 베이스 템플릿 이미지 그리기
  ctx.drawImage(templateImg, 0, 0, baseW, baseH);

  // 폰트 설정
  const FONT_FAMILY =
    '-apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Noto Sans KR", sans-serif';

  // 수량 계산 (20kg 박스 수량)
  let qty = 1;
  const match = data.itemsSummary?.match(/(\d+)\s*(박스|개)/);
  if (match) {
    qty = parseInt(match[1], 10) || 1;
  } else if (data.totalAmount) {
    qty = Math.max(1, Math.round(data.totalAmount / 68000));
  }

  const unitPrice = 68000;
  const totalAmount = data.totalAmount || unitPrice * qty;
  const unitPriceFormatted = unitPrice.toLocaleString() + "원";
  const totalAmountFormatted = totalAmount.toLocaleString() + "원";

  // 도착일 포맷팅 (예: 11월 20일(금) 도착)
  let dateFormatted = data.shippingDate;
  if (data.shippingDate) {
    try {
      const d = new Date(data.shippingDate + "T00:00:00");
      if (!isNaN(d.getTime())) {
        const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
        dateFormatted = `${d.getMonth() + 1}월 ${d.getDate()}일(${dayNames[d.getDay()]}) 도착`;
      }
    } catch {
      dateFormatted = data.shippingDate;
    }
  }

  // ==========================================
  // [1행] 상품명: 절임배추 20kg
  // ==========================================
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `900 24px ${FONT_FAMILY}`;
  ctx.fillStyle = "#0B6B38"; // 짙은 자연 에메랄드 그린
  ctx.fillText("절임배추 20kg", 265, 489);

  // ==========================================
  // [2행] 주문수량: 20kg N박스 주문하셨습니다.
  // ==========================================
  const startX2 = 258;
  const y2 = 553;
  ctx.font = `900 27px ${FONT_FAMILY}`;
  ctx.fillStyle = "#D92D20"; // 강조 빨강
  const qtyText = `20kg ${qty}박스`;
  ctx.fillText(qtyText, startX2, y2);

  const qtyWidth = ctx.measureText(qtyText).width;
  ctx.font = `800 22px ${FONT_FAMILY}`;
  ctx.fillStyle = "#1E293B"; // 슬레이트 차콜
  ctx.fillText(" 주문하셨습니다.", startX2 + qtyWidth, y2);

  // ==========================================
  // [3행] 금액: 박스당 68,000원 / (총 N박스 = XXX,XXX원)
  // ==========================================
  const startX3 = 258;
  const y3_1 = 612;
  const y3_2 = 642;

  ctx.font = `800 21px ${FONT_FAMILY}`;
  ctx.fillStyle = "#1E293B";
  ctx.fillText("박스당 ", startX3, y3_1);

  const prefixW = ctx.measureText("박스당 ").width;
  ctx.font = `900 26px ${FONT_FAMILY}`;
  ctx.fillStyle = "#D92D20";
  ctx.fillText(unitPriceFormatted, startX3 + prefixW, y3_1);

  ctx.font = `700 18px ${FONT_FAMILY}`;
  ctx.fillStyle = "#475569";
  ctx.fillText(`(총 ${qty}박스 = ${totalAmountFormatted})`, startX3, y3_2);

  // ==========================================
  // [4행] 연락처: 010-XXXX-XXXX
  // ==========================================
  const phoneText = data.shopPhone || data.customerPhone || "010-0000-0000";
  ctx.font = `900 26px ${FONT_FAMILY}`;
  ctx.fillStyle = "#0F172A";
  ctx.fillText(phoneText, 258, 695);

  // ==========================================
  // [5행] 계좌번호: 은행명 계좌번호 / (예금주: OOO)
  // ==========================================
  const bankTitle = `${data.bankName || "농협"} ${data.bankAccount || ""}`.trim();
  const ownerTitle = data.ownerName ? `(예금주: ${data.ownerName})` : "";
  ctx.font = `900 22px ${FONT_FAMILY}`;
  ctx.fillStyle = "#0F172A";
  ctx.fillText(bankTitle, 258, 750);

  if (ownerTitle) {
    ctx.font = `700 17px ${FONT_FAMILY}`;
    ctx.fillStyle = "#475569";
    ctx.fillText(ownerTitle, 258, 778);
  }

  // ==========================================
  // [6행] 도착일: M월 D일(요일) 도착으로 주문하셨습니다.
  // ==========================================
  const startX6 = 258;
  const y6_1 = 828;
  const y6_2 = 858;

  ctx.font = `900 25px ${FONT_FAMILY}`;
  ctx.fillStyle = "#D92D20"; // 강조 빨강
  ctx.fillText(dateFormatted, startX6, y6_1);

  const dateW = ctx.measureText(dateFormatted).width;
  ctx.font = `800 20px ${FONT_FAMILY}`;
  ctx.fillStyle = "#1E293B";
  ctx.fillText("으로", startX6 + dateW + 4, y6_1);

  ctx.font = `800 20px ${FONT_FAMILY}`;
  ctx.fillStyle = "#1E293B";
  ctx.fillText("주문하셨습니다.", startX6, y6_2);

  // Blob & File 생성
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("CANVAS_TO_BLOB_FAILED"));
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      const safeCustomerName = data.customerName.replace(/[^가-힣a-zA-Z0-9]/g, "") || "고객";
      const fileName = `장모님절임배추_주문확인서_${safeCustomerName}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      resolve({ dataUrl, file, blob });
    }, "image/png", 1.0);
  });
}

/**
 * 템플릿 미로드 시 폴백용 벡터 영수증 카드
 */
function renderFallbackVectorCard(
  data: OrderCardData
): Promise<{ dataUrl: string; file: File; blob: Blob }> {
  const width = 800;
  const height = 1000;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("CANVAS_NOT_SUPPORTED");
  }

  // 배경
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // 헤더
  const headerHeight = 170;
  ctx.fillStyle = "#065F46";
  ctx.fillRect(12, 12, width - 24, headerHeight);

  ctx.fillStyle = "#34D399";
  ctx.fillRect(12, 12, width - 24, 6);

  ctx.fillStyle = "#A7F3D0";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(data.shopName || "장모님 절임배추", width / 2, 55);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 38px sans-serif";
  ctx.fillText("주문 접수 확인서", width / 2, 110);

  ctx.fillStyle = "#E2E8F0";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`주문번호: ${data.orderNo}`, width / 2, 148);

  ctx.textAlign = "left";
  let currentY = 220;

  // 고객 박스
  drawRoundedBox(ctx, 40, currentY, width - 80, 190, 16, "#FFFFFF", "#E2E8F0");
  ctx.fillStyle = "#0F172A";
  ctx.font = "900 24px sans-serif";
  ctx.fillText(`받는 분: ${data.customerName} 님`, 65, currentY + 45);

  ctx.fillStyle = "#047857";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`연락처: ${data.customerPhone}`, 65, currentY + 80);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`택배 도착일: ${data.shippingDate} (도착 전날 발송)`, 65, currentY + 115);

  const fullAddr = `${data.shippingAddress} ${data.shippingAddressDetail || ""}`.trim();
  ctx.fillStyle = "#475569";
  ctx.font = "17px sans-serif";
  drawTruncatedText(ctx, `배송 주소: ${fullAddr}`, 65, currentY + 150, width - 130);

  // 품목 박스
  currentY += 215;
  drawRoundedBox(ctx, 40, currentY, width - 80, 190, 16, "#ECFDF5", "#A7F3D0");
  ctx.fillStyle = "#065F46";
  ctx.font = "900 22px sans-serif";
  ctx.fillText("■ 주문 품목 및 금액", 65, currentY + 42);

  ctx.fillStyle = "#1E293B";
  ctx.font = "bold 23px sans-serif";
  drawTruncatedText(ctx, data.itemsSummary || "절임배추 20kg", 65, currentY + 85, width - 130);

  ctx.fillStyle = "#64748B";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("총 결제 금액:", 65, currentY + 135);

  ctx.fillStyle = "#B91C1C";
  ctx.font = "900 32px sans-serif";
  ctx.fillText(data.totalAmount.toLocaleString() + "원", 200, currentY + 137);

  // 계좌 박스
  currentY += 215;
  drawRoundedBox(ctx, 40, currentY, width - 80, 175, 16, "#FFFFFF", "#E2E8F0");
  ctx.fillStyle = "#0F172A";
  ctx.font = "900 22px sans-serif";
  ctx.fillText("■ 입금 계좌 안내", 65, currentY + 42);

  ctx.fillStyle = "#1E293B";
  ctx.font = "bold 21px sans-serif";
  ctx.fillText(`은행/계좌: [${data.bankName || "농협"}] ${data.bankAccount || ""}`, 65, currentY + 82);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`예금주: ${data.ownerName || ""}`, 65, currentY + 118);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("CANVAS_TO_BLOB_FAILED"));
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      const safeCustomerName = data.customerName.replace(/[^가-힣a-zA-Z0-9]/g, "") || "고객";
      const fileName = `주문확인서_${safeCustomerName}_${data.orderNo}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      resolve({ dataUrl, file, blob });
    }, "image/png");
  });
}

function drawRoundedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillColor: string,
  strokeColor?: string
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawTruncatedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
) {
  let truncated = text;
  while (ctx.measureText(truncated).width > maxWidth && truncated.length > 3) {
    truncated = truncated.slice(0, -4) + "...";
  }
  ctx.fillText(truncated, x, y);
}
