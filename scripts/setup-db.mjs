import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// .env.local 우선 로드
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

async function initDb() {
  console.log("Turso 데이터베이스 연결 중: " + url);

  // 테이블 생성
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      phone2 TEXT,
      zipcode TEXT,
      address TEXT,
      address_detail TEXT,
      delivery_memo TEXT,
      memo TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      weight_kg INTEGER NOT NULL,
      price INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address TEXT,
      shipping_address_detail TEXT,
      order_date TEXT NOT NULL,
      shipping_date TEXT NOT NULL,
      total_amount INTEGER NOT NULL DEFAULT 0,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      order_status TEXT NOT NULL DEFAULT 'RECEIVED',
      memo TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      weight_kg INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      paid_at TEXT,
      payer_name TEXT,
      method TEXT,
      memo TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      courier TEXT,
      tracking_no TEXT,
      shipped_at TEXT,
      delivered_at TEXT,
      status TEXT NOT NULL DEFAULT 'READY',
      memo TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      order_id INTEGER,
      channel TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      sent_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  console.log("테이블 생성 완료.");

  // 기본 설정 등록 (없을 경우)
  const defaultSettings = [
    { key: "shop_name", value: "임실 절임배추" },
    { key: "shop_phone", value: "010-0000-0000" },
    { key: "bank_name", value: "농협" },
    { key: "bank_account", value: "351-0000-0000-00" },
    { key: "owner_name", value: "대표자" },
    { key: "default_courier", value: "우체국택배" },
  ];

  for (const s of defaultSettings) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      args: [s.key, s.value],
    });
  }

  // 기본 상품 등록 (없을 경우)
  const productsCheck = await db.execute("SELECT COUNT(*) as count FROM products");
  const count = Number(productsCheck.rows[0].count);
  if (count === 0) {
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO products (name, weight_kg, price, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
      args: ["절임배추 10kg", 10, 38000, now, now],
    });
    await db.execute({
      sql: `INSERT INTO products (name, weight_kg, price, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
      args: ["절임배추 20kg", 20, 68000, now, now],
    });
    console.log("기본 상품(10kg, 20kg) 등록 완료.");
  }

  console.log("Turso 데이터베이스 초기화 및 기본 데이터 세팅 완료!");
}

initDb().catch((err) => {
  console.error("데이터베이스 초기화 실패:", err);
  process.exit(1);
});
