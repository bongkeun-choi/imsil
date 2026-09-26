import sharp from "sharp";
import fs from "fs";

async function createSeamlessTopAddressCard() {
  const sampleOrder = {
    customerName: "홍길동",
    customerPhone: "010-9876-5432",
    shippingAddress: "전북 임실군 임실읍 봉황로 45",
    shippingAddressDetail: "행복아파트 103동 1204호",
    productName: "절임배추 20kg",
    qty20kg: 2,
    unitPrice: 68000,
    totalAmount: 136000,
    shopPhone: "010-8452-9988",
    bankName: "농협",
    bankAccount: "351-1234-5678-99",
    ownerName: "최봉근",
    shippingDate: "2026-11-20",
  };

  const fullAddress = `${sampleOrder.shippingAddress} ${sampleOrder.shippingAddressDetail}`;

  // 1. Slice clean template at y = 455 (right under the green megaphone banner, before Row 1)
  const sliceY = 455;
  const insertH = 100;
  const newH = 1024 + insertH; // 1124

  const topSlice = await sharp("public/images/template_clean.png")
    .extract({ left: 0, top: 0, width: 682, height: sliceY })
    .toBuffer();

  // Clone 1-pixel row at y=455 and stretch to insertH for 100% PERFECT pixel matching!
  const middleSlice = await sharp("public/images/template_clean.png")
    .extract({ left: 0, top: sliceY, width: 682, height: 1 })
    .resize(682, insertH, { fit: "fill" })
    .toBuffer();

  const bottomSlice = await sharp("public/images/template_clean.png")
    .extract({ left: 0, top: sliceY, width: 682, height: 1024 - sliceY })
    .toBuffer();

  const extendedBase = await sharp({
    create: {
      width: 682,
      height: newH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: topSlice, top: 0, left: 0 },
      { input: middleSlice, top: sliceY, left: 0 },
      { input: bottomSlice, top: sliceY + insertH, left: 0 },
    ])
    .png()
    .toBuffer();

  // Save the master base template for the app
  await sharp(extendedBase).toFile("public/images/template_extended_clean.png");

  // Date formatting
  const d = new Date(sampleOrder.shippingDate + "T00:00:00");
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dateFormatted = `${d.getMonth() + 1}월 ${d.getDate()}일(${dayNames[d.getDay()]}) 도착`;

  const dy = insertH;

  const overlaySvg = Buffer.from(`
    <svg width="682" height="${newH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .txt-green { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 25px; fill: #0B6B38; }
          .txt-red-large { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 27px; fill: #D92D20; }
          .txt-black { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 22px; fill: #1E293B; }
          .txt-red-price { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 26px; fill: #D92D20; }
          .txt-price-sub { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 700; font-size: 18px; fill: #475569; }
          .txt-phone { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 26px; fill: #0F172A; }
          .txt-bank-main { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 22px; fill: #0F172A; }
          .txt-bank-sub { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 700; font-size: 17px; fill: #475569; }
          .txt-date-red { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 25px; fill: #D92D20; }
          .txt-date-sub { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 20px; fill: #1E293B; }
          
          .txt-addr-tag { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 16px; fill: #047857; }
          .txt-addr-name { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 20px; fill: #0F172A; }
          .txt-addr-phone { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 17px; fill: #4B5563; }
          .txt-addr-body { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 17px; fill: #1E293B; }
        </style>
      </defs>

      <!-- [상단 삽입] 주문자 및 배송지 주소 카드 (y=460) -->
      <g transform="translate(56, 460)">
        <!-- 카드 배경 박스 (화사한 파스텔 에메랄드/민트) -->
        <rect x="0" y="0" width="570" height="88" rx="14" ry="14" fill="#F0FDF4" stroke="#86EFAC" stroke-width="2" />
        
        <!-- 배송지 원형 배지 아이콘 -->
        <circle cx="28" cy="27" r="15" fill="#10B981" />
        <text x="28" y="32" font-size="15" text-anchor="middle" fill="#FFFFFF">🏠</text>

        <!-- 1행: 받는 분 및 고객 전화번호 -->
        <text x="52" y="27" class="txt-addr-name">
          <tspan class="txt-addr-tag">받는 분: </tspan>${sampleOrder.customerName} 님
          <tspan class="txt-addr-phone"> (${sampleOrder.customerPhone})</tspan>
        </text>

        <!-- 2행: 배송지 주소 -->
        <text x="52" y="55" class="txt-addr-body">
          <tspan class="txt-addr-tag">배송지: </tspan>${fullAddress}
        </text>

        <!-- 3행: 발송 안내 문구 -->
        <text x="52" y="76" font-family="'Malgun Gothic', sans-serif" font-weight="700" font-size="13px" fill="#059669">
          ※ 안전하고 신선하게 포장하여 도착 희망일 전날 우체국택배로 발송됩니다.
        </text>
      </g>

      <!-- 1. 상품명 -->
      <text x="265" y="${495 + dy}" class="txt-green">${sampleOrder.productName}</text>

      <!-- 2. 주문수량 -->
      <text x="258" y="${558 + dy}">
        <tspan class="txt-red-large">20kg ${sampleOrder.qty20kg}박스</tspan>
        <tspan class="txt-black" dx="8">주문하셨습니다.</tspan>
      </text>

      <!-- 3. 금액 -->
      <text x="258" y="${618 + dy}">
        <tspan class="txt-black">박스당 </tspan>
        <tspan class="txt-red-price">${sampleOrder.unitPrice.toLocaleString()}원</tspan>
      </text>
      <text x="258" y="${646 + dy}" class="txt-price-sub">
        (총 ${sampleOrder.qty20kg}박스 = ${sampleOrder.totalAmount.toLocaleString()}원)
      </text>

      <!-- 4. 농가 연락처 -->
      <text x="258" y="${700 + dy}" class="txt-phone">${sampleOrder.shopPhone}</text>

      <!-- 5. 계좌번호 -->
      <text x="258" y="${754 + dy}" class="txt-bank-main">
        ${sampleOrder.bankName} ${sampleOrder.bankAccount}
      </text>
      <text x="258" y="${782 + dy}" class="txt-bank-sub">
        (예금주: ${sampleOrder.ownerName})
      </text>

      <!-- 6. 도착일 -->
      <text x="258" y="${834 + dy}">
        <tspan class="txt-date-red">${dateFormatted}</tspan>
        <tspan class="txt-date-sub" dx="4">으로</tspan>
      </text>
      <text x="258" y="${864 + dy}" class="txt-date-sub">
        주문하셨습니다.
      </text>
    </svg>
  `);

  await sharp(extendedBase)
    .composite([{ input: overlaySvg, blend: "over" }])
    .png({ quality: 100 })
    .toFile("public/images/test_rendered_card_perfect.png");

  console.log("public/images/test_rendered_card_perfect.png created successfully!");
}

createSeamlessTopAddressCard().catch(console.error);
