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

async function migrate() {
  console.log("Turso DB 마이그레이션 시작: 고객 코드 및 품목 코드 확장");

  // 1. customers 테이블에 customer_code 컬럼 확인 및 추가
  const customerInfo = await db.execute("PRAGMA table_info(customers)");
  const customerCols = customerInfo.rows.map((r) => String(r.name));

  if (!customerCols.includes("customer_code")) {
    console.log("customers 테이블에 customer_code 컬럼 추가 중...");
    await db.execute("ALTER TABLE customers ADD COLUMN customer_code TEXT");
    console.log("customer_code 컬럼 추가 완료!");
  } else {
    console.log("customers 테이블에 customer_code 컬럼이 이미 존재합니다.");
  }

  // 기존 고객들에게 C-1001, C-1002... 코드 일괄 부여
  const existingCustomers = await db.execute("SELECT id, customer_code FROM customers ORDER BY id ASC");
  let assignedCount = 0;
  for (let i = 0; i < existingCustomers.rows.length; i++) {
    const row = existingCustomers.rows[i];
    if (!row.customer_code) {
      const code = `C-${1001 + i}`;
      await db.execute({
        sql: "UPDATE customers SET customer_code = ? WHERE id = ?",
        args: [code, Number(row.id)],
      });
      assignedCount++;
    }
  }
  console.log(`기존 고객 총 ${existingCustomers.rows.length}명 중 ${assignedCount}명에게 고객 코드(C-1001~) 부여 완료!`);

  // 2. products 테이블에 code, category, unit 컬럼 확인 및 추가
  const productInfo = await db.execute("PRAGMA table_info(products)");
  const productCols = productInfo.rows.map((r) => String(r.name));

  if (!productCols.includes("code")) {
    console.log("products 테이블에 code 컬럼 추가 중...");
    await db.execute("ALTER TABLE products ADD COLUMN code TEXT");
  }
  if (!productCols.includes("category")) {
    console.log("products 테이블에 category 컬럼 추가 중...");
    await db.execute("ALTER TABLE products ADD COLUMN category TEXT DEFAULT '절임배추류'");
  }
  if (!productCols.includes("unit")) {
    console.log("products 테이블에 unit 컬럼 추가 중...");
    await db.execute("ALTER TABLE products ADD COLUMN unit TEXT DEFAULT '박스'");
  }

  // 기존 상품 코드 업데이트 (id=1: CAB-10, id=2: CAB-20)
  await db.execute(`
    UPDATE products 
    SET code = 'CAB-10', category = '절임배추류', unit = '박스' 
    WHERE (id = 1 OR weight_kg = 10) AND (code IS NULL OR code = '')
  `);
  await db.execute(`
    UPDATE products 
    SET code = 'CAB-20', category = '절임배추류', unit = '박스' 
    WHERE (id = 2 OR weight_kg = 20) AND (code IS NULL OR code = '')
  `);

  // 다품목 관리를 위한 기본 확장 품목 등록 (이미 존재하지 않는 경우)
  const existingCodesRes = await db.execute("SELECT code FROM products WHERE code IS NOT NULL");
  const existingCodes = existingCodesRes.rows.map((r) => String(r.code));

  const now = new Date().toISOString();
  if (!existingCodes.includes("SAU-05")) {
    await db.execute({
      sql: `INSERT INTO products (code, name, category, weight_kg, price, unit, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["SAU-05", "김치 양념 5kg", "김치양념류", 5, 45000, "통", 1, now, now],
    });
    console.log("신규 품목 추가 완료: 김치 양념 5kg (SAU-05)");
  }

  if (!existingCodes.includes("PEP-01")) {
    await db.execute({
      sql: `INSERT INTO products (code, name, category, weight_kg, price, unit, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["PEP-01", "고춧가루 1kg", "고춧가루류", 1, 30000, "봉", 1, now, now],
    });
    console.log("신규 품목 추가 완료: 고춧가루 1kg (PEP-01)");
  }

  console.log("마이그레이션이 성공적으로 완료되었습니다!");
}

migrate().catch((err) => {
  console.error("마이그레이션 오류:", err);
  process.exit(1);
});
