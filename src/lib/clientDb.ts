import { createClient, Client } from "@libsql/client/web";

export interface TursoConfig {
  url: string;
  authToken: string;
}

const STORAGE_KEY_URL = "imsil_turso_url";
const STORAGE_KEY_TOKEN = "imsil_turso_token";

// 브라우저에서 안전하게 통신할 수 있는 HTTPS 엔드포인트 URL 및 토큰 기본값
export const DEFAULT_TURSO_CONFIG: TursoConfig = {
  url: "https://imsil-bongkeun-choi.aws-ap-northeast-1.turso.io",
  authToken:
    "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTAzOTA1NzMsImlkIjoiMDFhMGRiOTctZjMwMS03NGVhLWEwZWQtMGQxOTg4YTU3NjQyIiwia2lkIjoicEo1RHFMd2V3dHJZLTBXWGNxRTd0cnVRNWxrWDlYOVFJNTYxZl9lSC1YTSIsInJpZCI6ImEwNTgwODEyLTU4M2UtNGRlZi05NmY4LTUwMTJhZTYyNjQxMyJ9.XBJ7iUCZjhF7BgYi27JxKy-_XA2H8oLNTzvjF36ic9zSgG8UD5pT1zYH_5nUE-8NBmc79uDklGFVffYXcz1zAA",
};

export function getStoredTursoConfig(): TursoConfig {
  if (typeof window === "undefined") return DEFAULT_TURSO_CONFIG;
  const url = localStorage.getItem(STORAGE_KEY_URL);
  const authToken = localStorage.getItem(STORAGE_KEY_TOKEN);

  if (url && authToken) {
    const formattedUrl = url.trim().replace(/^libsql:\/\//, "https://");
    return { url: formattedUrl, authToken: authToken.trim() };
  }

  saveTursoConfig(DEFAULT_TURSO_CONFIG);
  return DEFAULT_TURSO_CONFIG;
}

export function saveTursoConfig(config: TursoConfig): void {
  if (typeof window === "undefined") return;
  const formattedUrl = config.url.trim().replace(/^libsql:\/\//, "https://");
  localStorage.setItem(STORAGE_KEY_URL, formattedUrl);
  localStorage.setItem(STORAGE_KEY_TOKEN, config.authToken.trim());
}

export function clearTursoConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

let cachedClient: Client | null = null;
let currentConfigKey = "";

export function getClientDb(): Client {
  const config = getStoredTursoConfig();
  const key = `${config.url}_${config.authToken}`;

  if (!cachedClient || currentConfigKey !== key) {
    cachedClient = createClient({
      url: config.url,
      authToken: config.authToken,
    });
    currentConfigKey = key;
  }

  return cachedClient;
}

// 최초 1회 브라우저에서 자동 테이블 생성 및 기본 데이터 세팅
export async function initClientTables(client: Client): Promise<void> {
  try {
    await client.execute(`
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

    await client.execute(`
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

    await client.execute(`
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

    await client.execute(`
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

    await client.execute(`
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

    await client.execute(`
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

    await client.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    const defaultSettings = [
      { key: "shop_name", value: "임실 절임배추" },
      { key: "shop_phone", value: "010-0000-0000" },
      { key: "bank_name", value: "농협" },
      { key: "bank_account", value: "351-0000-0000-00" },
      { key: "owner_name", value: "대표자" },
      { key: "default_courier", value: "우체국택배" },
    ];

    for (const s of defaultSettings) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
        args: [s.key, s.value],
      });
    }

    const productsCheck = await client.execute("SELECT COUNT(*) as count FROM products");
    const count = Number(productsCheck.rows[0].count);
    if (count === 0) {
      const now = new Date().toISOString();
      await client.execute({
        sql: `INSERT INTO products (name, weight_kg, price, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
        args: ["절임배추 10kg", 10, 38000, now, now],
      });
      await client.execute({
        sql: `INSERT INTO products (name, weight_kg, price, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
        args: ["절임배추 20kg", 20, 68000, now, now],
      });
    }
  } catch (e) {
    console.error("테이블 초기화 확인:", e);
  }
}
