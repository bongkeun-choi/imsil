import { createClient } from "@libsql/client";
import fs from "fs";

async function main() {
  const envContent = fs.readFileSync(".env.local", "utf8");
  const urlMatch = envContent.match(/TURSO_DATABASE_URL=([^\r\n]+)/);
  const tokenMatch = envContent.match(/TURSO_AUTH_TOKEN=([^\r\n]+)/);
  const url = urlMatch ? urlMatch[1].trim() : "";
  const authToken = tokenMatch ? tokenMatch[1].trim() : "";
  const client = createClient({ url, authToken });

  console.log("=== 1. orders 테이블에 recipient_name, recipient_phone 컬럼 추가 ===");
  const orderColumnsRes = await client.execute("PRAGMA table_info(orders)");
  const orderColumns = orderColumnsRes.rows.map((r) => r.name);

  if (!orderColumns.includes("recipient_name")) {
    await client.execute("ALTER TABLE orders ADD COLUMN recipient_name TEXT");
    console.log("-> orders.recipient_name 추가 완료");
  } else {
    console.log("-> orders.recipient_name 이미 존재함");
  }

  if (!orderColumns.includes("recipient_phone")) {
    await client.execute("ALTER TABLE orders ADD COLUMN recipient_phone TEXT");
    console.log("-> orders.recipient_phone 추가 완료");
  } else {
    console.log("-> orders.recipient_phone 이미 존재함");
  }

  // 기존 주문들의 recipient_name, recipient_phone 채우기
  await client.execute(`
    UPDATE orders 
    SET recipient_name = COALESCE(recipient_name, customer_name),
        recipient_phone = COALESCE(recipient_phone, customer_phone)
    WHERE recipient_name IS NULL OR recipient_phone IS NULL
  `);
  console.log("-> 기존 주문 recipient_name, recipient_phone 업데이트 완료");

  console.log("\n=== 2. customer_addresses 테이블에 recipient_phone2 컬럼 추가 ===");
  const addrColumnsRes = await client.execute("PRAGMA table_info(customer_addresses)");
  const addrColumns = addrColumnsRes.rows.map((r) => r.name);

  if (!addrColumns.includes("recipient_phone2")) {
    await client.execute("ALTER TABLE customer_addresses ADD COLUMN recipient_phone2 TEXT");
    console.log("-> customer_addresses.recipient_phone2 추가 완료");
  } else {
    console.log("-> customer_addresses.recipient_phone2 이미 존재함");
  }

  console.log("\n=== 3. 마이그레이션 확인 ===");
  const ordersCheck = await client.execute("SELECT id, customer_name, recipient_name, customer_phone, recipient_phone FROM orders LIMIT 3");
  console.log("주문 샘플:");
  console.table(ordersCheck.rows);

  console.log("\n마이그레이션 성공적으로 완료!");
}

main().catch(console.error);
