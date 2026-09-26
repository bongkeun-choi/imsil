/**
 * 주문 확인서 / 영수증 카드 캔버스 이미지 생성 유틸리티
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
 * 주문 정보를 바탕으로 고해상도 PNG 카드 이미지를 생성합니다.
 */
export async function generateOrderCardImage(
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

  // 1. 배경 (부드러운 미색/아이보리 화이트)
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(0, 0, width, height);

  // 외곽 테두리
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // 2. 상단 헤더 배너 (고급스러운 짙은 딥에메랄드)
  const headerHeight = 170;
  ctx.fillStyle = "#065F46"; // emerald-800
  ctx.fillRect(12, 12, width - 24, headerHeight);

  // 헤더 상단 금색/연두 포인트 라인
  ctx.fillStyle = "#34D399";
  ctx.fillRect(12, 12, width - 24, 6);

  // 헤더 텍스트: 농가 상호
  ctx.fillStyle = "#A7F3D0";
  ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(data.shopName || "임실 참배추농원", width / 2, 55);

  // 헤더 메인 타이틀: 주문 접수 확인서
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 38px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  ctx.fillText("주문 접수 확인서", width / 2, 110);

  // 헤더 부제 (주문번호 및 일시)
  ctx.fillStyle = "#E2E8F0";
  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  ctx.fillText(`주문번호: ${data.orderNo}`, width / 2, 148);

  // 3. 내부 카드 본문 영역
  ctx.textAlign = "left";
  let currentY = 220;

  // 섹션 1: 고객 & 배송 정보 박스
  drawRoundedBox(ctx, 40, currentY, width - 80, 190, 16, "#FFFFFF", "#E2E8F0");

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 24px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText(`받는 분: ${data.customerName} 님`, 65, currentY + 45);

  ctx.fillStyle = "#047857";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText(`연락처: ${data.customerPhone}`, 65, currentY + 80);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText(`택배 도착일: ${data.shippingDate} (도착 전날 발송)`, 65, currentY + 115);

  const fullAddr = `${data.shippingAddress} ${data.shippingAddressDetail || ""}`.trim();
  ctx.fillStyle = "#475569";
  ctx.font = "17px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  drawTruncatedText(ctx, `배송 주소: ${fullAddr}`, 65, currentY + 150, width - 130);

  // 섹션 2: 주문 품목 및 결제 금액 박스
  currentY += 215;
  drawRoundedBox(ctx, 40, currentY, width - 80, 190, 16, "#ECFDF5", "#A7F3D0");

  ctx.fillStyle = "#065F46";
  ctx.font = "900 22px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText("■ 주문 품목 및 금액", 65, currentY + 42);

  ctx.fillStyle = "#1E293B";
  ctx.font = "bold 23px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  drawTruncatedText(ctx, data.itemsSummary || "절임배추", 65, currentY + 85, width - 130);

  ctx.fillStyle = "#64748B";
  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText("총 결제 금액:", 65, currentY + 135);

  ctx.fillStyle = "#B91C1C";
  ctx.font = "900 32px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  const formattedPrice = data.totalAmount.toLocaleString() + "원";
  ctx.fillText(formattedPrice, 200, currentY + 137);

  // 결제 상태 배지
  const isPaid = data.paymentStatus === "PAID";
  const badgeX = width - 190;
  const badgeY = currentY + 105;
  drawRoundedBox(
    ctx,
    badgeX,
    badgeY,
    110,
    42,
    8,
    isPaid ? "#059669" : "#DC2626",
    isPaid ? "#059669" : "#DC2626"
  );
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 18px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(isPaid ? "입금완료" : "입금대기", badgeX + 55, badgeY + 28);
  ctx.textAlign = "left";

  // 섹션 3: 입금 계좌 안내 박스
  currentY += 215;
  drawRoundedBox(ctx, 40, currentY, width - 80, 175, 16, "#FFFFFF", "#E2E8F0");

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 22px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText("■ 입금 계좌 안내", 65, currentY + 42);

  ctx.fillStyle = "#1E293B";
  ctx.font = "bold 21px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText(`은행/계좌: [${data.bankName || "농협"}] ${data.bankAccount || ""}`, 65, currentY + 82);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText(`예금주: ${data.ownerName || ""}`, 65, currentY + 118);

  ctx.fillStyle = "#64748B";
  ctx.font = "15px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText("※ 입금자명이 다를 경우 농가로 꼭 연락 부탁드립니다.", 65, currentY + 150);

  // 하단 농가 푸터 및 감사 문구
  currentY += 200;
  ctx.textAlign = "center";
  ctx.fillStyle = "#047857";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText(
    "정성껏 키워 깨끗하게 절인 건강한 배추로 보답하겠습니다.",
    width / 2,
    currentY + 25
  );

  ctx.fillStyle = "#64748B";
  ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif";
  ctx.fillText(
    `문의 및 상담: ${data.shopPhone || "010-0000-0000"} (${data.shopName || "임실참배추농원"})`,
    width / 2,
    currentY + 60
  );

  // Blob & File 생성
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("CANVAS_TO_BLOB_FAILED"));
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      const safeCustomerName = data.customerName.replace(/[^가-힣a-zA-Z0-9]/g, "");
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
