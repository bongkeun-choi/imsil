import sharp from "sharp";
import fs from "fs";

async function testBottomLayout() {
  const sampleOrder = {
    customerName: "박주여",
    customerPhone: "010-2625-6248",
    shippingAddress: "전주시 완산구 평화7길 40",
    shippingAddressDetail: "103동",
    productName: "절임배추 20kg",
    qty20kg: 2,
    unitPrice: 68000,
    totalAmount: 136000,
    shopPhone: "010-7180-2496",
    bankName: "농협",
    bankAccount: "351-0000-0000-00",
    ownerName: "백양임",
    shippingDate: "2026-09-28",
  };

  const fullAddress = `${sampleOrder.shippingAddress} ${sampleOrder.shippingAddressDetail}`.trim();

  // Date formatting: "9월 28일(월) 도착"
  const d = new Date(sampleOrder.shippingDate + "T00:00:00");
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dateFormatted = `${d.getMonth() + 1}월 ${d.getDate()}일(${dayNames[d.getDay()]}) 도착`;

  // We use the ORIGINAL template_clean.png (682 x 1024)
  // This means the top image is 100% pristine and un-stretched!
  // All 6 rows are at their original positions!
  const baseImg = await sharp("public/images/template_clean.png").toBuffer();

  // Now, we attach a delivery info card at the bottom:
  // Height of bottom extension: 126px -> Total height = 1024 + 126 = 1150px
  const extH = 126;
  const totalH = 1024 + extH;

  // Let's create an extended base image:
  // Base 1024px is template_clean.png
  // Bottom 126px is a clean, premium delivery card area
  const svgOverlay = Buffer.from(`
    <svg width="682" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .txt-green { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 24px; fill: #0B6B38; }
          .txt-red-large { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 27px; fill: #D92D20; }
          .txt-black { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 22px; fill: #1E293B; }
          .txt-red-price { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 26px; fill: #D92D20; }
          .txt-price-sub { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 700; font-size: 18px; fill: #475569; }
          .txt-phone { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 26px; fill: #0F172A; }
          .txt-bank-main { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 22px; fill: #0F172A; }
          .txt-bank-sub { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 700; font-size: 17px; fill: #475569; }
          .txt-date-red { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 25px; fill: #D92D20; }
          .txt-date-sub { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 20px; fill: #1E293B; }
          
          .card-title { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 17px; fill: #065F46; }
          .card-label { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 16px; fill: #047857; }
          .card-name { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 19px; fill: #0F172A; }
          .card-phone { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 16px; fill: #4B5563; }
          .card-addr { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 16px; fill: #1E293B; }
          .card-notice { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 700; font-size: 13px; fill: #059669; }
        </style>
      </defs>

      <!-- 1. 상품명 (원래 위치 y=489) -->
      <text x="265" y="489" class="txt-green">${sampleOrder.productName}</text>

      <!-- 2. 주문수량 (원래 위치 y=553) -->
      <text x="258" y="553">
        <tspan class="txt-red-large">20kg ${sampleOrder.qty20kg}박스</tspan>
        <tspan class="txt-black" dx="8">주문하셨습니다.</tspan>
      </text>

      <!-- 3. 금액 (원래 위치 y=612) -->
      <text x="258" y="612">
        <tspan class="txt-black">박스당 </tspan>
        <tspan class="txt-red-price">${sampleOrder.unitPrice.toLocaleString()}원</tspan>
      </text>
      <text x="258" y="642" class="txt-price-sub">
        (총 ${sampleOrder.qty20kg}박스 = ${sampleOrder.totalAmount.toLocaleString()}원)
      </text>

      <!-- 4. 농가 연락처 (원래 위치 y=695) -->
      <text x="258" y="695" class="txt-phone">${sampleOrder.shopPhone}</text>

      <!-- 5. 계좌번호 (원래 위치 y=750) -->
      <text x="258" y="750" class="txt-bank-main">
        ${sampleOrder.bankName} ${sampleOrder.bankAccount}
      </text>
      <text x="258" y="778" class="txt-bank-sub">
        (예금주: ${sampleOrder.ownerName})
      </text>

      <!-- 6. 도착일 (원래 위치 y=828) -->
      <text x="258" y="828">
        <tspan class="txt-date-red">${dateFormatted}</tspan>
        <tspan class="txt-date-sub" dx="4">으로</tspan>
      </text>
      <text x="258" y="858" class="txt-date-sub">
        주문하셨습니다.
      </text>

      <!-- ============================================== -->
      <!-- [이미지 바로 밑] 프리미엄 배송 정보 카드 (y=1032) -->
      <!-- ============================================== -->
      <g transform="translate(18, 1032)">
        <!-- 카드 배경: 깨끗하고 부드러운 화이트/민트 카드 + 둥근 모서리 + 그린 테두리 -->
        <rect x="0" y="0" width="646" height="106" rx="16" ry="16" fill="#FFFFFF" stroke="#10B981" stroke-width="2.5" />
        <rect x="2" y="2" width="642" height="102" rx="14" ry="14" fill="#F0FDF4" fill-opacity="0.85" />

        <!-- 상단 헤더 라인: 📦 배송지 및 수령 정보 안내 -->
        <g transform="translate(20, 24)">
          <circle cx="12" cy="0" r="14" fill="#10B981" />
          <text x="12" y="5" font-size="14" text-anchor="middle" fill="#FFFFFF">📦</text>
          <text x="34" y="5" class="card-title">배송 정보 및 수령인 안내</text>
          
          <!-- 안전 배송 배지 -->
          <rect x="470" y="-12" width="130" height="24" rx="12" ry="12" fill="#DCFCE7" stroke="#86EFAC" stroke-width="1.5" />
          <text x="535" y="4" font-family="'Malgun Gothic', sans-serif" font-weight="800" font-size="12px" fill="#15803D" text-anchor="middle">우체국택배 발송</text>
        </g>

        <!-- 구분 실선 -->
        <line x1="20" y1="36" x2="626" y2="36" stroke="#D1FAE5" stroke-width="1.5" />

        <!-- 1행: 받는 분 & 연락처 -->
        <g transform="translate(24, 58)">
          <text x="0" y="0" class="card-label">받는 분:</text>
          <text x="65" y="0" class="card-name">${sampleOrder.customerName} 님</text>
          <text x="160" y="-1" class="card-phone">(${sampleOrder.customerPhone})</text>
        </g>

        <!-- 2행: 배송지 주소 -->
        <g transform="translate(24, 82)">
          <text x="0" y="0" class="card-label">배송지:</text>
          <text x="65" y="0" class="card-addr">${fullAddress}</text>
        </g>

        <!-- 하단 우측 팁 문구 -->
        <text x="626" y="98" font-family="'Malgun Gothic', sans-serif" font-weight="700" font-size="11.5px" fill="#059669" text-anchor="end">
          ※ 신선하고 안전하게 포장하여 도착 희망일 전날 발송됩니다.
        </text>
      </g>
    </svg>
  `);

  // Extend base canvas to totalH with white or light cream background
  const extendedBase = await sharp({
    create: {
      width: 682,
      height: totalH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: baseImg, top: 0, left: 0 },
      { input: svgOverlay, blend: "over" },
    ])
    .png({ quality: 100 })
    .toFile("public/images/test_bottom_card.png");

  console.log("public/images/test_bottom_card.png created successfully!");
}

testBottomLayout().catch(console.error);
