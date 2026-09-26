import sharp from "sharp";
import fs from "fs";

async function renderTestCard() {
  const sampleOrder = {
    customerName: "홍길동",
    productName: "절임배추",
    qty20kg: 2,
    unitPrice: 68000,
    totalAmount: 136000,
    shopPhone: "010-8452-9988",
    bankName: "농협",
    bankAccount: "351-1234-5678-99",
    ownerName: "최봉근",
    shippingDate: "2026-11-20", // 11월 20일(금)
  };

  const unitPriceFormatted = sampleOrder.unitPrice.toLocaleString() + "원";
  const totalAmountFormatted = sampleOrder.totalAmount.toLocaleString() + "원";

  // Parse shipping date: 11월 20일 (금)
  const d = new Date(sampleOrder.shippingDate + "T00:00:00");
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dateFormatted = `${d.getMonth() + 1}월 ${d.getDate()}일(${dayNames[d.getDay()]}) 도착`;

  const svgText = Buffer.from(`
    <svg width="682" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .txt-green { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 26px; fill: #0B6B38; }
          .txt-red-large { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 28px; fill: #D92D20; }
          .txt-black { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 22px; fill: #1E293B; }
          .txt-red-price { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 26px; fill: #D92D20; }
          .txt-price-sub { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 700; font-size: 19px; fill: #475569; }
          .txt-phone { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 27px; fill: #0F172A; letter-spacing: 1px; }
          .txt-bank-main { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 22px; fill: #0F172A; }
          .txt-bank-sub { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 700; font-size: 18px; fill: #475569; }
          .txt-date-red { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 900; font-size: 26px; fill: #D92D20; }
          .txt-date-sub { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 20px; fill: #1E293B; }
        </style>
      </defs>

      <!-- 1. 상품명 (y=498) -->
      <text x="270" y="498" class="txt-green">${sampleOrder.productName}</text>

      <!-- 2. 주문수량 (y=560) -->
      <text x="260" y="562">
        <tspan class="txt-red-large">20kg ${sampleOrder.qty20kg}박스</tspan>
        <tspan class="txt-black" dx="8">주문하셨습니다.</tspan>
      </text>

      <!-- 3. 금액 (y=618, y=646) -->
      <text x="260" y="620">
        <tspan class="txt-black">박스당 </tspan>
        <tspan class="txt-red-price">${unitPriceFormatted}</tspan>
      </text>
      <text x="260" y="650" class="txt-price-sub">
        (총 ${sampleOrder.qty20kg}박스 = ${totalAmountFormatted})
      </text>

      <!-- 4. 연락처 (y=704) -->
      <text x="260" y="704" class="txt-phone">${sampleOrder.shopPhone}</text>

      <!-- 5. 계좌번호 (y=756, y=788) -->
      <text x="260" y="756" class="txt-bank-main">
        ${sampleOrder.bankName} ${sampleOrder.bankAccount}
      </text>
      <text x="260" y="788" class="txt-bank-sub">
        (예금주: ${sampleOrder.ownerName})
      </text>

      <!-- 6. 도착일 (y=834, y=868) -->
      <text x="260" y="836">
        <tspan class="txt-date-red">${dateFormatted}</tspan>
        <tspan class="txt-date-sub" dx="4">으로</tspan>
      </text>
      <text x="260" y="870" class="txt-date-sub">
        주문하셨습니다.
      </text>
    </svg>
  `);

  await sharp("public/images/template_clean.png")
    .composite([{ input: svgText, blend: "over" }])
    .png({ quality: 100 })
    .toFile("public/images/test_rendered_card.png");

  console.log("public/images/test_rendered_card.png created successfully!");
}

renderTestCard().catch(console.error);
