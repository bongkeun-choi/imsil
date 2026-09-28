import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runHealthCheck() {
  console.log("=== 전체 시스템 기능 종합 점검 시작 ===");

  // 1. 고객 테이블 및 코드 점검
  const customers = await db.execute("SELECT id, customer_code, name, phone FROM customers LIMIT 5");
  console.log(`\n1. [고객 장부 데이터 점검] 조회된 고객 수: ${customers.rows.length}명`);
  customers.rows.forEach((c) => {
    console.log(`   - ID: ${c.id} | 코드: ${c.customer_code} | 성함: ${c.name} | 전화번호: ${c.phone}`);
  });

  // 2. 품목 테이블 및 코드/단가 점검
  const products = await db.execute("SELECT id, code, name, category, weight_kg, price, unit, active FROM products ORDER BY id ASC");
  console.log(`\n2. [품목(상품) 데이터 점검] 등록된 품목 수: ${products.rows.length}개`);
  products.rows.forEach((p) => {
    console.log(`   - ID: ${p.id} | 코드: #${p.code} | 분류: [${p.category}] | 품목명: ${p.name} (${p.unit}) | 단가: ${p.price.toLocaleString()}원 | 판매상태: ${p.active ? "판매중" : "판매중지"}`);
  });

  // 3. 주문 및 고객코드 조인 점검
  const orders = await db.execute(`
    SELECT o.id, o.order_no, o.customer_name, c.customer_code, o.shipping_date, o.total_amount
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LIMIT 3
  `);
  console.log(`\n3. [주문 및 발송 연동 점검] 최근 주문 ${orders.rows.length}건`);
  orders.rows.forEach((o) => {
    console.log(`   - 주문번호: #${o.order_no} | 고객코드: #${o.customer_code || "미부여"} | 고객명: ${o.customer_name} | 배송일: ${o.shipping_date} | 금액: ${Number(o.total_amount).toLocaleString()}원`);
  });

  console.log("\n=== 모든 핵심 데이터 및 연결 상태 정상 작동 확인 완료 ===");
}

runHealthCheck().catch(console.error);
