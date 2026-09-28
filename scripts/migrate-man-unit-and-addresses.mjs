import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import * as fs from "fs";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("오류: TURSO_DATABASE_URL이 설정되지 않았습니다.");
  process.exit(1);
}

const db = createClient({ url, authToken });

// 한글 성씨 초성별 만 단위 대역 계산 헬퍼
export function getChosungBaseNumber(name) {
  if (!name || typeof name !== "string" || name.trim().length === 0) return 900000;
  const firstChar = name.trim()[0];
  const code = firstChar.charCodeAt(0);

  // 한글 음절 범위: 0xAC00 (가) ~ 0xD7A3 (힣)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const chosungIndex = Math.floor((code - 0xac00) / (21 * 28));
    // 초성 순서:
    // 0:ㄱ, 1:ㄲ, 2:ㄴ, 3:ㄷ, 4:ㄸ, 5:ㄹ, 6:ㅁ, 7:ㅂ, 8:ㅃ, 9:ㅅ, 10:ㅆ,
    // 11:ㅇ, 12:ㅈ, 13:ㅉ, 14:ㅊ, 15:ㅋ, 16:ㅌ, 17:ㅍ, 18:ㅎ
    switch (chosungIndex) {
      case 0:
      case 1:
        return 10000; // ㄱ, ㄲ (김, 강, 고, 구, 곽, 권 등)
      case 2:
        return 20000; // ㄴ (나, 노 등)
      case 3:
      case 4:
        return 30000; // ㄷ, ㄸ (도, 두 등)
      case 5:
        return 40000; // ㄹ (라, 류 등)
      case 6:
        return 50000; // ㅁ (문, 민, 명 등)
      case 7:
      case 8:
        return 60000; // ㅂ, ㅃ (박, 배, 백, 변 등)
      case 9:
      case 10:
        return 70000; // ㅅ, ㅆ (신, 서, 손, 심, 송 등)
      case 11:
        return 80000; // ㅇ (이, 임, 안, 오, 유, 양, 원 등)
      case 12:
      case 13:
        return 90000; // ㅈ, ㅉ (정, 조, 장, 전, 진, 주 등)
      case 14:
        return 100000; // ㅊ (최, 천, 채 등)
      case 15:
      case 16:
        return 110000; // ㅋ, ㅌ (탁, 태 등)
      case 17:
        return 120000; // ㅍ (표, 피 등)
      case 18:
        return 130000; // ㅎ (홍, 한, 황, 허 등)
      default:
        return 900000;
    }
  }

  // 한글이 아니거나(영어, 기호) 단체명 등
  return 900000;
}

async function migrate() {
  console.log("=== 마이그레이션 시작: 성씨 초성 만 단위 고객 코드 & 다중 배송지 주소록 ===");

  // 1. customer_addresses 테이블 생성
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      alias TEXT NOT NULL DEFAULT '기본 자택',
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      zipcode TEXT,
      address TEXT NOT NULL,
      address_detail TEXT,
      delivery_memo TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );
  `);
  console.log("customer_addresses 테이블 생성 확인 완료.");

  // 2. 기존 고객들의 기본 주소를 customer_addresses 로 이관 (없는 경우만)
  const customers = await db.execute("SELECT id, name, phone, zipcode, address, address_detail, delivery_memo, created_at, updated_at FROM customers ORDER BY id ASC");
  const now = new Date().toISOString();

  for (const c of customers.rows) {
    const custId = Number(c.id);
    const existingAddr = await db.execute({
      sql: "SELECT id FROM customer_addresses WHERE customer_id = ? LIMIT 1",
      args: [custId],
    });

    if (existingAddr.rows.length === 0 && (c.address || c.name)) {
      await db.execute({
        sql: `INSERT INTO customer_addresses (customer_id, alias, recipient_name, recipient_phone, zipcode, address, address_detail, delivery_memo, is_default, created_at, updated_at)
              VALUES (?, '기본 자택', ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [
          custId,
          String(c.name || "고객"),
          String(c.phone || ""),
          String(c.zipcode || ""),
          String(c.address || ""),
          String(c.address_detail || ""),
          String(c.delivery_memo || ""),
          String(c.created_at || now),
          String(c.updated_at || now),
        ],
      });
      console.log(`고객 ID ${custId} (${c.name})의 기본 자택 배송지 등록 완료.`);
    }
  }

  // 3. 기존 고객 전체의 customer_code를 만 단위 초성 코드로 재계산 및 부여
  // 성씨 대역별로 순번을 1부터 증가시킴
  const seqMap = new Map();

  for (const c of customers.rows) {
    const custId = Number(c.id);
    const name = String(c.name || "");
    const base = getChosungBaseNumber(name);

    const currentSeq = (seqMap.get(base) || 0) + 1;
    seqMap.set(base, currentSeq);

    const newCode = String(base + currentSeq);

    await db.execute({
      sql: "UPDATE customers SET customer_code = ? WHERE id = ?",
      args: [newCode, custId],
    });
    console.log(`고객 ID ${custId} (${name}) ➔ 새 만단위 코드 부여: #${newCode}`);
  }

  console.log("=== 마이그레이션이 성공적으로 완료되었습니다! ===");
}

migrate().catch((err) => {
  console.error("마이그레이션 에러:", err);
  process.exit(1);
});
