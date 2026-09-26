import sharp from "sharp";
import fs from "fs";

async function main() {
  const inputPath = "public/images/uploaded_order_card_template.jpg";
  if (!fs.existsSync(inputPath)) {
    console.error("Input file missing:", inputPath);
    return;
  }

  // Row 1 pill: x=238 to 628, y=464 to 512, rx=10, fill=#EEF8EF
  // Row 2 white: x=245 to 630, y=524 to 582, fill=#FFFFFF
  // Row 3 pill: x=238 to 628, y=588 to 656, rx=10, fill=#FCF9EB
  // Row 4 white: x=245 to 630, y=664 to 722, fill=#FFFFFF
  // Row 5 white: x=245 to 630, y=728 to 796, fill=#FFFFFF
  // Row 6 white: x=245 to 505, y=804 to 872, fill=#FFFFFF

  const svgOverlay = Buffer.from(`
    <svg width="682" height="1024" xmlns="http://www.w3.org/2000/svg">
      <!-- Row 1 상품명 배경 pill -->
      <rect x="236" y="462" width="392" height="54" rx="14" ry="14" fill="#EFF8F0" />
      
      <!-- Row 2 주문수량 배경 -->
      <rect x="240" y="520" width="388" height="66" fill="#FFFFFF" />
      
      <!-- Row 3 금액 배경 pill -->
      <rect x="236" y="586" width="392" height="84" rx="14" ry="14" fill="#FCF9EA" />
      
      <!-- Row 4 연락처 배경 -->
      <rect x="240" y="662" width="388" height="65" fill="#FFFFFF" />
      
      <!-- Row 5 계좌번호 배경 -->
      <rect x="240" y="726" width="388" height="78" fill="#FFFFFF" />
      
      <!-- Row 6 도착일 배경 (감사합니다! ♡ 보존) -->
      <rect x="238" y="798" width="315" height="60" fill="#FFFFFF" />
      <rect x="238" y="855" width="240" height="42" fill="#FFFFFF" />
    </svg>
  `);

  await sharp(inputPath)
    .composite([{ input: svgOverlay, blend: "over" }])
    .png({ quality: 100 })
    .toFile("public/images/template_clean.png");

  console.log("public/images/template_clean.png generated successfully!");
}

main().catch(console.error);
