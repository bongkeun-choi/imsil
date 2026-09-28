import { getClientDb } from "./clientDb";
import { format } from "date-fns";

export interface ProductItem {
  id: number;
  code: string;
  name: string;
  category: string;
  weight_kg: number;
  price: number;
  unit: string;
  active: number;
}

// 한글 성씨 초성별 만 단위 대역 계산 헬퍼 (ㄱ=10000, ㄴ=20000... ㅊ=100000, ㅎ=130000)
export function getChosungBaseNumber(name: string): number {
  if (!name || typeof name !== "string" || name.trim().length === 0) return 900000;
  const firstChar = name.trim()[0];
  const code = firstChar.charCodeAt(0);

  if (code >= 0xac00 && code <= 0xd7a3) {
    const chosungIndex = Math.floor((code - 0xac00) / (21 * 28));
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
  return 900000;
}

export async function generateCustomerCode(db: any, name: string = ""): Promise<string> {
  const base = getChosungBaseNumber(name);
  const minCode = base + 1;
  const maxCode = base + 9999;

  const result = await db.execute({
    sql: "SELECT customer_code FROM customers WHERE CAST(customer_code AS INTEGER) >= ? AND CAST(customer_code AS INTEGER) <= ? ORDER BY CAST(customer_code AS INTEGER) DESC LIMIT 1",
    args: [minCode, maxCode],
  });

  if (result.rows.length > 0 && result.rows[0].customer_code) {
    const lastNum = parseInt(String(result.rows[0].customer_code), 10);
    if (!isNaN(lastNum)) {
      return String(lastNum + 1);
    }
  }

  return String(minCode);
}

export interface CustomerAddress {
  id: number;
  customer_id: number;
  alias: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_phone2?: string;
  zipcode?: string;
  address: string;
  address_detail?: string;
  delivery_memo?: string;
  is_default: number;
  created_at?: string;
  updated_at?: string;
}

export async function fetchCustomerAddressesService(customerId: number): Promise<CustomerAddress[]> {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const res = await db.execute({
    sql: "SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id ASC",
    args: [customerId],
  });
  return res.rows.map((r: any) => ({
    id: Number(r.id),
    customer_id: Number(r.customer_id),
    alias: String(r.alias || "기본 자택"),
    recipient_name: String(r.recipient_name || ""),
    recipient_phone: String(r.recipient_phone || ""),
    recipient_phone2: String(r.recipient_phone2 || ""),
    zipcode: String(r.zipcode || ""),
    address: String(r.address || ""),
    address_detail: String(r.address_detail || ""),
    delivery_memo: String(r.delivery_memo || ""),
    is_default: Number(r.is_default || 0),
    created_at: String(r.created_at || ""),
    updated_at: String(r.updated_at || ""),
  }));
}

export async function addCustomerAddressService(data: {
  customer_id: number;
  alias: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_phone2?: string;
  zipcode?: string;
  address: string;
  address_detail?: string;
  delivery_memo?: string;
  is_default?: boolean;
}) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const now = new Date().toISOString();

  if (data.is_default) {
    await db.execute({
      sql: "UPDATE customer_addresses SET is_default = 0, updated_at = ? WHERE customer_id = ?",
      args: [now, data.customer_id],
    });
  }

  const res = await db.execute({
    sql: `INSERT INTO customer_addresses (customer_id, alias, recipient_name, recipient_phone, recipient_phone2, zipcode, address, address_detail, delivery_memo, is_default, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.customer_id,
      data.alias.trim() || "배송지",
      data.recipient_name.trim(),
      data.recipient_phone.trim(),
      data.recipient_phone2?.trim() || "",
      data.zipcode?.trim() || "",
      data.address.trim(),
      data.address_detail?.trim() || "",
      data.delivery_memo?.trim() || "",
      data.is_default ? 1 : 0,
      now,
      now,
    ],
  });
  return Number(res.lastInsertRowid);
}

export async function updateCustomerAddressService(data: {
  id: number;
  customer_id: number;
  alias?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_phone2?: string;
  zipcode?: string;
  address?: string;
  address_detail?: string;
  delivery_memo?: string;
  is_default?: boolean;
}) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const now = new Date().toISOString();

  if (data.is_default) {
    await db.execute({
      sql: "UPDATE customer_addresses SET is_default = 0, updated_at = ? WHERE customer_id = ?",
      args: [now, data.customer_id],
    });
  }

  await db.execute({
    sql: `UPDATE customer_addresses SET 
            alias = COALESCE(?, alias),
            recipient_name = COALESCE(?, recipient_name),
            recipient_phone = COALESCE(?, recipient_phone),
            recipient_phone2 = COALESCE(?, recipient_phone2),
            zipcode = COALESCE(?, zipcode),
            address = COALESCE(?, address),
            address_detail = COALESCE(?, address_detail),
            delivery_memo = COALESCE(?, delivery_memo),
            is_default = COALESCE(?, is_default),
            updated_at = ?
          WHERE id = ?`,
    args: [
      data.alias !== undefined ? data.alias.trim() : null,
      data.recipient_name !== undefined ? data.recipient_name.trim() : null,
      data.recipient_phone !== undefined ? data.recipient_phone.trim() : null,
      data.recipient_phone2 !== undefined ? data.recipient_phone2.trim() : null,
      data.zipcode !== undefined ? data.zipcode.trim() : null,
      data.address !== undefined ? data.address.trim() : null,
      data.address_detail !== undefined ? data.address_detail.trim() : null,
      data.delivery_memo !== undefined ? data.delivery_memo.trim() : null,
      data.is_default !== undefined ? (data.is_default ? 1 : 0) : null,
      now,
      data.id,
    ],
  });
  return true;
}

export async function deleteCustomerAddressService(id: number) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  await db.execute({ sql: "DELETE FROM customer_addresses WHERE id = ?", args: [id] });
  return true;
}

export async function fetchSettingsService() {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const result = await db.execute("SELECT key, value FROM settings");
  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    settings[row.key as string] = (row.value as string) || "";
  }

  const productsResult = await db.execute(
    "SELECT id, code, name, category, weight_kg, price, unit, active FROM products ORDER BY active DESC, id ASC"
  );

  return {
    settings,
    products: productsResult.rows,
  };
}

export async function fetchProductsService(): Promise<ProductItem[]> {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const res = await db.execute("SELECT id, code, name, category, weight_kg, price, unit, active FROM products WHERE active = 1 ORDER BY id ASC");
  return res.rows.map((r) => ({
    id: Number(r.id),
    code: String(r.code || `P-${r.id}`),
    name: String(r.name),
    category: String(r.category || "절임배추류"),
    weight_kg: Number(r.weight_kg || 0),
    price: Number(r.price || 0),
    unit: String(r.unit || "박스"),
    active: Number(r.active ?? 1),
  }));
}

export async function fetchAllProductsService(): Promise<ProductItem[]> {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const res = await db.execute("SELECT id, code, name, category, weight_kg, price, unit, active FROM products ORDER BY active DESC, id ASC");
  return res.rows.map((r) => ({
    id: Number(r.id),
    code: String(r.code || `P-${r.id}`),
    name: String(r.name),
    category: String(r.category || "절임배추류"),
    weight_kg: Number(r.weight_kg || 0),
    price: Number(r.price || 0),
    unit: String(r.unit || "박스"),
    active: Number(r.active ?? 1),
  }));
}

export async function createProductService(data: {
  code: string;
  name: string;
  category?: string;
  weight_kg?: number;
  price: number;
  unit?: string;
}) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const now = new Date().toISOString();
  const res = await db.execute({
    sql: `INSERT INTO products (code, name, category, weight_kg, price, unit, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    args: [
      data.code.trim().toUpperCase(),
      data.name.trim(),
      data.category?.trim() || "일반농산물",
      Number(data.weight_kg || 0),
      Number(data.price),
      data.unit?.trim() || "박스",
      now,
      now,
    ],
  });
  return Number(res.lastInsertRowid);
}

export async function updateProductService(data: {
  id: number;
  code?: string;
  name?: string;
  category?: string;
  weight_kg?: number;
  price?: number;
  unit?: string;
  active?: number;
}) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE products SET 
            code = COALESCE(?, code),
            name = COALESCE(?, name),
            category = COALESCE(?, category),
            weight_kg = COALESCE(?, weight_kg),
            price = COALESCE(?, price),
            unit = COALESCE(?, unit),
            active = COALESCE(?, active),
            updated_at = ?
          WHERE id = ?`,
    args: [
      data.code !== undefined ? data.code.trim().toUpperCase() : null,
      data.name !== undefined ? data.name.trim() : null,
      data.category !== undefined ? data.category.trim() : null,
      data.weight_kg !== undefined ? Number(data.weight_kg) : null,
      data.price !== undefined ? Number(data.price) : null,
      data.unit !== undefined ? data.unit.trim() : null,
      data.active !== undefined ? Number(data.active) : null,
      now,
      data.id,
    ],
  });
  return true;
}

export async function deleteProductService(id: number) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const check = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM order_items WHERE product_id = ?",
    args: [id],
  });
  if (Number(check.rows[0]?.cnt) > 0) {
    await db.execute({
      sql: "UPDATE products SET active = 0, updated_at = ? WHERE id = ?",
      args: [new Date().toISOString(), id],
    });
    return { deactivated: true };
  } else {
    await db.execute({
      sql: "DELETE FROM products WHERE id = ?",
      args: [id],
    });
    return { deactivated: false };
  }
}

export async function saveSettingsService(
  settings: Record<string, string>,
  products?: { id: number; price: number }[]
) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  for (const [key, value] of Object.entries(settings)) {
    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: [key, String(value)],
    });
  }

  if (products && Array.isArray(products)) {
    for (const p of products) {
      if (p.id && p.price) {
        await db.execute({
          sql: "UPDATE products SET price = ?, updated_at = ? WHERE id = ?",
          args: [Number(p.price), new Date().toISOString(), Number(p.id)],
        });
      }
    }
  }

  return true;
}

export async function fetchDashboardService(dateStr: string) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const todayOrdersResult = await db.execute({
    sql: `
      SELECT 
        o.id,
        o.order_no,
        o.customer_id,
        c.customer_code,
        o.customer_name,
        o.customer_phone,
        o.shipping_address,
        o.shipping_address_detail,
        o.shipping_date,
        o.total_amount,
        o.paid_amount,
        o.payment_status,
        o.order_status,
        o.memo,
        o.order_type,
        o.event_name,
        s.tracking_no,
        s.status as shipment_status
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN shipments s ON s.order_id = o.id
      WHERE o.shipping_date = ?
      ORDER BY o.id DESC
    `,
    args: [dateStr],
  });

  const orders = todayOrdersResult.rows;

  const itemsResult = await db.execute({
    sql: `
      SELECT 
        oi.order_id,
        oi.weight_kg,
        oi.quantity,
        oi.amount,
        o.order_type,
        o.event_name
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.shipping_date = ?
    `,
    args: [dateStr],
  });

  let qty10kg = 0;
  let qty20kg = 0;
  let normalQty20kg = 0;
  let eventQty20kg = 0;
  let totalWeight = 0;

  for (const row of itemsResult.rows) {
    const weight = Number(row.weight_kg);
    const qty = Number(row.quantity);
    const isEvent = row.order_type === "EVENT";

    if (weight === 10) qty10kg += qty;
    if (weight === 20) {
      qty20kg += qty;
      if (isEvent) {
        eventQty20kg += qty;
      } else {
        normalQty20kg += qty;
      }
    }
    totalWeight += weight * qty;
  }

  const eventOrders = orders.filter((o: any) => o.order_type === "EVENT");
  const eventOrdersCount = eventOrders.length;
  const eventNames = Array.from(
    new Set(eventOrders.map((o: any) => String(o.event_name || "임실 김치 축제")))
  );

  const unpaidResult = await db.execute(`
    SELECT 
      COUNT(*) as unpaid_count,
      COALESCE(SUM(total_amount - paid_amount), 0) as unpaid_total
    FROM orders
    WHERE payment_status != 'PAID'
  `);

  const unpaidCount = Number(unpaidResult.rows[0]?.unpaid_count || 0);
  const unpaidTotal = Number(unpaidResult.rows[0]?.unpaid_total || 0);

  return {
    date: dateStr,
    summary: {
      totalOrders: orders.length,
      totalWeight,
      qty10kg,
      qty20kg,
      normalQty20kg,
      eventQty20kg,
      eventOrdersCount,
      eventNames,
      unpaidCount,
      unpaidTotal,
    },
    orders,
  };
}

export async function createOrderService(data: {
  customer_id?: number;
  name: string;
  phone: string;
  recipient_name?: string;
  recipient_phone?: string;
  zipcode?: string;
  address: string;
  address_detail?: string;
  shipping_date: string;
  order_type?: string;
  event_name?: string | null;
  items: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    weight_kg: number;
  }>;
  payment_status: "UNPAID" | "PAID";
  memo?: string;
}) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const now = new Date().toISOString();
  const todayStr = format(new Date(), "yyyyMMdd");
  const cleanPhone = (data.phone || "").replace(/[^0-9]/g, "");

  // 1. 고객 확인 및 등록
  let customerId: number;
  if (data.customer_id) {
    // 기존 고객 ID가 명시적으로 지정된 경우: 해당 고객 ID 유지 (주문 고객 정보 보호)
    customerId = Number(data.customer_id);
  } else if (cleanPhone) {
    const existingCustomer = await db.execute({
      sql: "SELECT id FROM customers WHERE REPLACE(phone, '-', '') = ? LIMIT 1",
      args: [cleanPhone],
    });

    if (existingCustomer.rows.length > 0) {
      customerId = Number(existingCustomer.rows[0].id);
    } else {
      const custCode = await generateCustomerCode(db, data.name);
      const newCustomer = await db.execute({
        sql: `INSERT INTO customers (customer_code, name, phone, zipcode, address, address_detail, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [custCode, data.name, data.phone || "", data.zipcode || "", data.address || "", data.address_detail || "", now, now],
      });
      customerId = Number(newCustomer.lastInsertRowid);
      if (data.address) {
        await db.execute({
          sql: `INSERT INTO customer_addresses (customer_id, alias, recipient_name, recipient_phone, zipcode, address, address_detail, is_default, created_at, updated_at)
                VALUES (?, '기본 자택', ?, ?, ?, ?, ?, 1, ?, ?)`,
          args: [customerId, data.name, data.phone || "", data.zipcode || "", data.address, data.address_detail || "", now, now],
        });
      }
    }
  } else {
    // 행사/축제 납품 등 전화번호가 없는 경우 이름으로 고객 확인 또는 신규 등록
    const existingCustomer = await db.execute({
      sql: "SELECT id FROM customers WHERE name = ? AND (phone = '' OR phone IS NULL) LIMIT 1",
      args: [data.name],
    });
    if (existingCustomer.rows.length > 0) {
      customerId = Number(existingCustomer.rows[0].id);
    } else {
      const custCode = await generateCustomerCode(db, data.name);
      const newCustomer = await db.execute({
        sql: `INSERT INTO customers (customer_code, name, phone, zipcode, address, address_detail, created_at, updated_at)
              VALUES (?, ?, '', '', ?, '', ?, ?)`,
        args: [custCode, data.name, data.address || "", now, now],
      });
      customerId = Number(newCustomer.lastInsertRowid);
      if (data.address) {
        await db.execute({
          sql: `INSERT INTO customer_addresses (customer_id, alias, recipient_name, recipient_phone, address, is_default, created_at, updated_at)
                VALUES (?, '기본 자택', ?, '', ?, 1, ?, ?)`,
          args: [customerId, data.name, data.address, now, now],
        });
      }
    }
  }

  // 2. 주문번호 생성
  const todayCountResult = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM orders WHERE order_no LIKE ?",
    args: [`${todayStr}-%`],
  });
  const nextSeq = Number(todayCountResult.rows[0].cnt) + 1;
  const orderNo = `${todayStr}-${String(nextSeq).padStart(3, "0")}`;

  let totalAmount = 0;
  for (const item of data.items) {
    totalAmount += Number(item.unit_price) * Number(item.quantity);
  }

  const paidAmount = data.payment_status === "PAID" ? totalAmount : 0;
  const orderType = data.order_type || "NORMAL";
  const eventName = orderType === "EVENT" ? (data.event_name?.trim() || "임실 김치 축제") : null;

  // 3. 주문 등록 (주문 고객과 수령인 정보 분리 저장)
  const finalRecipientName = (data.recipient_name || data.name).trim();
  const finalRecipientPhone = (data.recipient_phone || data.phone).trim();

  const orderResult = await db.execute({
    sql: `INSERT INTO orders (
            order_no, customer_id, customer_name, customer_phone,
            recipient_name, recipient_phone,
            shipping_address, shipping_address_detail, order_date,
            shipping_date, total_amount, paid_amount, payment_status,
            order_status, memo, order_type, event_name, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?)`,
    args: [
      orderNo,
      customerId,
      data.name.trim(),
      data.phone.trim(),
      finalRecipientName,
      finalRecipientPhone,
      data.address.trim(),
      data.address_detail ? data.address_detail.trim() : "",
      format(new Date(), "yyyy-MM-dd"),
      data.shipping_date,
      totalAmount,
      paidAmount,
      data.payment_status,
      data.memo ? data.memo.trim() : "",
      orderType,
      eventName,
      now,
      now,
    ],
  });

  const orderId = Number(orderResult.lastInsertRowid);

  // 4. 품목 등록
  for (const item of data.items) {
    if (item.quantity > 0) {
      const itemAmount = Number(item.unit_price) * Number(item.quantity);
      await db.execute({
        sql: `INSERT INTO order_items (
                order_id, product_id, product_name, quantity, unit_price, weight_kg, amount
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          orderId,
          item.product_id,
          item.product_name,
          Number(item.quantity),
          Number(item.unit_price),
          Number(item.weight_kg),
          itemAmount,
        ],
      });
    }
  }

  // 5. 입금완료 기록
  if (data.payment_status === "PAID") {
    await db.execute({
      sql: `INSERT INTO payments (order_id, amount, paid_at, payer_name, method, created_at)
            VALUES (?, ?, ?, ?, '계좌이체', ?)`,
      args: [orderId, totalAmount, now, data.name, now],
    });
  }

  // 6. 배송 레코드 생성
  await db.execute({
    sql: `INSERT INTO shipments (order_id, courier, tracking_no, status, created_at, updated_at)
          VALUES (?, '우체국택배', '', 'READY', ?, ?)`,
    args: [orderId, now, now],
  });

  return { orderId, orderNo };
}

export interface MultiDestinationItem {
  alias?: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_phone2?: string;
  address: string;
  address_detail?: string;
  shipping_date: string;
  quantity: number; // 20kg 박스 수
  memo?: string;
  save_as_address?: boolean;
}

export interface CreateMultiDestinationOrderPayload {
  customer_id?: number;
  customer_name: string;
  customer_phone: string;
  customer_phone2?: string;
  payment_status: "UNPAID" | "PAID";
  product: {
    id: number;
    name: string;
    price: number;
    weight_kg: number;
  };
  destinations: MultiDestinationItem[];
  order_type?: "NORMAL" | "EVENT";
  event_name?: string | null;
}

export async function createMultiDestinationOrderService(data: CreateMultiDestinationOrderPayload) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const now = new Date().toISOString();
  const todayStr = format(new Date(), "yyyyMMdd");

  // 1. 주문 고객 생성 또는 조회
  let customerId: number;
  if (data.customer_id) {
    customerId = data.customer_id;
  } else {
    const existing = await db.execute({
      sql: "SELECT id FROM customers WHERE REPLACE(phone, '-', '') = ? LIMIT 1",
      args: [data.customer_phone.replace(/[^0-9]/g, "")],
    });

    if (existing.rows.length > 0) {
      customerId = Number(existing.rows[0].id);
    } else {
      const custCode = await generateCustomerCode(db, data.customer_name);
      const custResult = await db.execute({
        sql: `INSERT INTO customers (customer_code, name, phone, phone2, address, address_detail, memo, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)`,
        args: [
          custCode,
          data.customer_name.trim(),
          data.customer_phone.trim(),
          data.customer_phone2?.trim() || "",
          data.destinations[0]?.address.trim() || "",
          data.destinations[0]?.address_detail?.trim() || "",
          now,
          now,
        ],
      });
      customerId = Number(custResult.lastInsertRowid);
    }
  }

  const createdOrders: Array<{ orderId: number; orderNo: string; destination: MultiDestinationItem; amount: number }> = [];

  // 2. 각 배송지별 주문 순차 생성
  for (let i = 0; i < data.destinations.length; i++) {
    const dest = data.destinations[i];
    if (dest.quantity <= 0) continue;

    // 주문번호 발급 (날짜-순번)
    const todayCountResult = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM orders WHERE order_no LIKE ?",
      args: [`${todayStr}-%`],
    });
    const nextSeq = Number(todayCountResult.rows[0].cnt) + 1;
    const orderNo = `${todayStr}-${String(nextSeq).padStart(3, "0")}`;

    const orderAmount = Number(data.product.price) * Number(dest.quantity);
    const paidAmount = data.payment_status === "PAID" ? orderAmount : 0;
    const orderType = data.order_type || "NORMAL";
    const eventName = orderType === "EVENT" ? (data.event_name?.trim() || "임실 김치 축제") : null;

    const finalRecipientName = (dest.recipient_name || data.customer_name).trim();
    const finalRecipientPhone = (dest.recipient_phone || data.customer_phone).trim();

    const orderResult = await db.execute({
      sql: `INSERT INTO orders (
              order_no, customer_id, customer_name, customer_phone,
              recipient_name, recipient_phone,
              shipping_address, shipping_address_detail, order_date,
              shipping_date, total_amount, paid_amount, payment_status,
              order_status, memo, order_type, event_name, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?)`,
      args: [
        orderNo,
        customerId,
        data.customer_name.trim(),
        data.customer_phone.trim(),
        finalRecipientName,
        finalRecipientPhone,
        dest.address.trim(),
        dest.address_detail ? dest.address_detail.trim() : "",
        format(new Date(), "yyyy-MM-dd"),
        dest.shipping_date,
        orderAmount,
        paidAmount,
        data.payment_status,
        dest.memo ? dest.memo.trim() : "",
        orderType,
        eventName,
        now,
        now,
      ],
    });

    const orderId = Number(orderResult.lastInsertRowid);

    // 품목 등록
    await db.execute({
      sql: `INSERT INTO order_items (
              order_id, product_id, product_name, quantity, unit_price, weight_kg, amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        orderId,
        data.product.id,
        data.product.name,
        dest.quantity,
        data.product.price,
        data.product.weight_kg,
        orderAmount,
      ],
    });

    // 입금 등록
    if (data.payment_status === "PAID") {
      await db.execute({
        sql: `INSERT INTO payments (order_id, amount, paid_at, payer_name, method, created_at)
              VALUES (?, ?, ?, ?, '계좌이체', ?)`,
        args: [orderId, orderAmount, now, data.customer_name, now],
      });
    }

    // 배송 레코드 등록
    await db.execute({
      sql: `INSERT INTO shipments (order_id, courier, tracking_no, status, created_at, updated_at)
            VALUES (?, '우체국택배', '', 'READY', ?, ?)`,
      args: [orderId, now, now],
    });

    // 배송지 자동 주소록 등록
    if (dest.save_as_address && dest.address.trim()) {
      try {
        await addCustomerAddressService({
          customer_id: customerId,
          alias: dest.alias?.trim() || `${finalRecipientName} 배송지`,
          recipient_name: finalRecipientName,
          recipient_phone: finalRecipientPhone,
          recipient_phone2: dest.recipient_phone2?.trim() || undefined,
          address: dest.address.trim(),
          address_detail: dest.address_detail?.trim() || undefined,
          delivery_memo: dest.memo?.trim() || undefined,
        });
      } catch (e) {
        console.error("다중 배송지 주소록 추가 실패(무시):", e);
      }
    }

    createdOrders.push({
      orderId,
      orderNo,
      destination: dest,
      amount: orderAmount,
    });
  }

  return {
    customerId,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    totalCount: createdOrders.length,
    totalBoxes: data.destinations.reduce((acc, d) => acc + d.quantity, 0),
    totalAmount: createdOrders.reduce((acc, o) => acc + o.amount, 0),
    orders: createdOrders,
  };
}

export async function fetchOrdersService(dateStr: string) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const ordersResult = await db.execute({
    sql: `
      SELECT 
        o.id,
        o.order_no,
        o.customer_id,
        c.customer_code,
        o.customer_name,
        o.customer_phone,
        o.shipping_address,
        o.shipping_address_detail,
        o.order_date,
        o.shipping_date,
        o.total_amount,
        o.paid_amount,
        o.payment_status,
        o.order_status,
        o.memo,
        o.order_type,
        o.event_name,
        s.courier,
        s.tracking_no,
        s.status as shipment_status
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN shipments s ON s.order_id = o.id
      WHERE o.shipping_date = ?
      ORDER BY o.id DESC
    `,
    args: [dateStr],
  });

  const ordersWithItems = await Promise.all(
    ordersResult.rows.map(async (order) => {
      const items = await db.execute({
        sql: "SELECT product_name, quantity, weight_kg, amount FROM order_items WHERE order_id = ?",
        args: [order.id],
      });
      return {
        ...order,
        items: items.rows,
      };
    })
  );

  return ordersWithItems;
}

export async function updateOrderActionService(
  orderId: number,
  action: "mark_paid" | "mark_packed" | "unmark_packed" | "mark_shipped" | "update_tracking",
  payload?: { tracking_no?: string; courier?: string }
) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const now = new Date().toISOString();

  const orderResult = await db.execute({
    sql: "SELECT id, customer_name, total_amount, paid_amount FROM orders WHERE id = ?",
    args: [orderId],
  });

  if (orderResult.rows.length === 0) throw new Error("ORDER_NOT_FOUND");
  const order = orderResult.rows[0];

  if (action === "mark_paid") {
    const totalAmount = Number(order.total_amount);
    await db.execute({
      sql: "UPDATE orders SET payment_status = 'PAID', paid_amount = ?, updated_at = ? WHERE id = ?",
      args: [totalAmount, now, orderId],
    });
    await db.execute({
      sql: `INSERT INTO payments (order_id, amount, paid_at, payer_name, method, created_at)
            VALUES (?, ?, ?, ?, '계좌이체', ?)`,
      args: [orderId, totalAmount, now, order.customer_name, now],
    });
    return true;
  }

  if (action === "mark_packed") {
    await db.execute({
      sql: "UPDATE orders SET order_status = 'PACKED', updated_at = ? WHERE id = ?",
      args: [now, orderId],
    });
    await db.execute({
      sql: "UPDATE shipments SET status = 'PACKED', updated_at = ? WHERE order_id = ?",
      args: [now, orderId],
    });
    return true;
  }

  if (action === "unmark_packed") {
    await db.execute({
      sql: "UPDATE orders SET order_status = 'RECEIVED', updated_at = ? WHERE id = ?",
      args: [now, orderId],
    });
    await db.execute({
      sql: "UPDATE shipments SET status = 'READY', updated_at = ? WHERE order_id = ?",
      args: [now, orderId],
    });
    return true;
  }

  if (action === "mark_shipped") {
    await db.execute({
      sql: "UPDATE orders SET order_status = 'SHIPPED', updated_at = ? WHERE id = ?",
      args: [now, orderId],
    });
    await db.execute({
      sql: `UPDATE shipments SET 
              tracking_no = COALESCE(?, tracking_no), 
              courier = COALESCE(?, courier),
              shipped_at = ?, 
              status = 'SHIPPED', 
              updated_at = ? 
            WHERE order_id = ?`,
      args: [payload?.tracking_no || null, payload?.courier || null, now, now, orderId],
    });
    return true;
  }

  if (action === "update_tracking") {
    await db.execute({
      sql: "UPDATE shipments SET tracking_no = ?, updated_at = ? WHERE order_id = ?",
      args: [payload?.tracking_no || "", now, orderId],
    });
    return true;
  }

  return false;
}

export interface UpdateOrderPayload {
  orderId: number;
  customerName: string;
  customerPhone: string;
  recipientName?: string;
  recipientPhone?: string;
  shippingDate: string;
  shippingAddress: string;
  shippingAddressDetail?: string;
  orderType?: string;
  eventName?: string | null;
  items: Array<{
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    weight_kg: number;
  }>;
  paymentStatus: "PAID" | "UNPAID";
  memo?: string;
}

export async function updateOrderDetailService(data: UpdateOrderPayload) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const now = new Date().toISOString();
  let totalAmount = 0;
  for (const item of data.items) {
    totalAmount += Number(item.unit_price) * Number(item.quantity);
  }
  const paidAmount = data.paymentStatus === "PAID" ? totalAmount : 0;
  const orderType = data.orderType || "NORMAL";
  const eventName = orderType === "EVENT" ? (data.eventName?.trim() || "임실 김치 축제") : null;

  const finalRecipientName = data.recipientName ? data.recipientName.trim() : null;
  const finalRecipientPhone = data.recipientPhone ? data.recipientPhone.trim() : null;

  // 1. orders 업데이트
  await db.execute({
    sql: `UPDATE orders SET 
            customer_name = ?,
            customer_phone = ?,
            recipient_name = COALESCE(?, recipient_name, ?),
            recipient_phone = COALESCE(?, recipient_phone, ?),
            shipping_address = ?,
            shipping_address_detail = ?,
            shipping_date = ?,
            total_amount = ?,
            paid_amount = ?,
            payment_status = ?,
            memo = ?,
            order_type = ?,
            event_name = ?,
            updated_at = ?
          WHERE id = ?`,
    args: [
      data.customerName,
      data.customerPhone,
      finalRecipientName,
      data.customerName,
      finalRecipientPhone,
      data.customerPhone,
      data.shippingAddress,
      data.shippingAddressDetail || "",
      data.shippingDate,
      totalAmount,
      paidAmount,
      data.paymentStatus,
      data.memo || "",
      orderType,
      eventName,
      now,
      data.orderId,
    ],
  });

  // 2. 고객 정보 동기화 (전화번호가 있을 때만 동기화)
  const cleanPhone = (data.customerPhone || "").replace(/[^0-9]/g, "");
  if (cleanPhone) {
    await db.execute({
      sql: `UPDATE customers SET 
              name = ?, 
              address = ?, 
              address_detail = ?, 
              updated_at = ?
            WHERE REPLACE(phone, '-', '') = ?`,
      args: [
        data.customerName,
        data.shippingAddress,
        data.shippingAddressDetail || "",
        now,
        cleanPhone,
      ],
    });
  }

  // 3. order_items 재등록
  await db.execute({
    sql: "DELETE FROM order_items WHERE order_id = ?",
    args: [data.orderId],
  });

  for (const item of data.items) {
    if (item.quantity > 0) {
      const amount = Number(item.unit_price) * Number(item.quantity);
      await db.execute({
        sql: `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, weight_kg, amount)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          data.orderId,
          item.product_id,
          item.product_name,
          Number(item.quantity),
          Number(item.unit_price),
          Number(item.weight_kg),
          amount,
        ],
      });
    }
  }

  // 4. payments 처리
  if (data.paymentStatus === "PAID") {
    const existingPayment = await db.execute({
      sql: "SELECT id FROM payments WHERE order_id = ? LIMIT 1",
      args: [data.orderId],
    });
    if (existingPayment.rows.length === 0) {
      await db.execute({
        sql: `INSERT INTO payments (order_id, amount, paid_at, payer_name, method, created_at)
              VALUES (?, ?, ?, ?, '계좌이체', ?)`,
        args: [data.orderId, totalAmount, now, data.customerName, now],
      });
    } else {
      await db.execute({
        sql: "UPDATE payments SET amount = ?, payer_name = ? WHERE order_id = ?",
        args: [totalAmount, data.customerName, data.orderId],
      });
    }
  }

  // order_no 조회
  const orderRes = await db.execute({
    sql: "SELECT order_no FROM orders WHERE id = ?",
    args: [data.orderId],
  });
  const orderNo = orderRes.rows.length > 0 ? String(orderRes.rows[0].order_no) : "";

  return { success: true, orderNo, totalAmount };
}

export async function deleteOrderService(orderId: number) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  await db.execute({ sql: "DELETE FROM order_items WHERE order_id = ?", args: [orderId] });
  await db.execute({ sql: "DELETE FROM shipments WHERE order_id = ?", args: [orderId] });
  await db.execute({ sql: "DELETE FROM payments WHERE order_id = ?", args: [orderId] });
  await db.execute({ sql: "DELETE FROM orders WHERE id = ?", args: [orderId] });
  return true;
}

export async function fetchOrderByIdService(orderId: number) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const ordRes = await db.execute({
    sql: `
      SELECT o.*, s.tracking_no, s.courier, s.status as shipment_status
      FROM orders o
      LEFT JOIN shipments s ON s.order_id = o.id
      WHERE o.id = ?
    `,
    args: [orderId],
  });

  if (ordRes.rows.length === 0) throw new Error("ORDER_NOT_FOUND");
  const order = ordRes.rows[0];

  const itemsRes = await db.execute({
    sql: `SELECT * FROM order_items WHERE order_id = ?`,
    args: [orderId],
  });

  return {
    ...(order as any),
    items: itemsRes.rows,
  } as any;
}

export async function fetchCustomersService(query: string = "") {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  let sql = `
    SELECT 
      c.id, c.customer_code, c.name, c.phone, c.phone2, c.zipcode, c.address, c.address_detail, c.memo,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(SUM(o.total_amount), 0) as total_spent,
      MAX(o.shipping_date) as last_order_date,
      MIN(o.shipping_date) as first_order_date,
      COUNT(DISTINCT ca.id) as address_count
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    LEFT JOIN customer_addresses ca ON ca.customer_id = c.id
  `;
  const args: any[] = [];

  if (query && query.trim()) {
    const cleanQ = query.trim().replace(/-/g, "");
    sql += ` WHERE (
      c.name LIKE ? 
      OR REPLACE(c.phone, '-', '') LIKE ? 
      OR REPLACE(COALESCE(c.phone2, ''), '-', '') LIKE ?
      OR c.customer_code LIKE ?
      OR c.id IN (
        SELECT customer_id FROM customer_addresses 
        WHERE REPLACE(recipient_phone, '-', '') LIKE ? 
           OR REPLACE(COALESCE(recipient_phone2, ''), '-', '') LIKE ?
           OR recipient_name LIKE ? 
           OR address LIKE ?
      )
    )`;
    args.push(
      `%${query.trim()}%`,
      `%${cleanQ}%`,
      `%${cleanQ}%`,
      `%${query.trim()}%`,
      `%${cleanQ}%`,
      `%${cleanQ}%`,
      `%${query.trim()}%`,
      `%${query.trim()}%`
    );
  }

  sql += " GROUP BY c.id ORDER BY CAST(COALESCE(c.customer_code, '999999') AS INTEGER) ASC, c.id DESC LIMIT 100";

  const result = await db.execute({ sql, args });
  return result.rows;
}

export async function fetchCustomerDetailService(id: number) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const customerResult = await db.execute({
    sql: "SELECT * FROM customers WHERE id = ?",
    args: [id],
  });

  if (customerResult.rows.length === 0) throw new Error("CUSTOMER_NOT_FOUND");

  const ordersResult = await db.execute({
    sql: `
      SELECT o.id, o.order_no, o.order_date, o.shipping_date, o.total_amount, o.paid_amount, o.payment_status, o.order_status,
             o.recipient_name, o.recipient_phone, o.shipping_address, o.shipping_address_detail, o.order_type, o.event_name, o.memo,
             (SELECT GROUP_CONCAT(oi.product_name||' '||oi.quantity||'개', ', ') FROM order_items oi WHERE oi.order_id = o.id) as items_summary,
             (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) as total_boxes
      FROM orders o
      WHERE o.customer_id = ?
      ORDER BY o.shipping_date DESC, o.id DESC
    `,
    args: [id],
  });

  const addresses = await fetchCustomerAddressesService(id);

  // 고객 누적 판매 통계 계산
  let totalSpent = 0;
  let totalPaid = 0;
  let totalBoxes = 0;
  for (const ord of ordersResult.rows) {
    totalSpent += Number(ord.total_amount || 0);
    if (ord.payment_status === "PAID") {
      totalPaid += Number(ord.total_amount || 0);
    }
    totalBoxes += Number(ord.total_boxes || 0);
  }

  return {
    customer: customerResult.rows[0],
    orders: ordersResult.rows,
    addresses,
    stats: {
      orderCount: ordersResult.rows.length,
      totalSpent,
      totalPaid,
      unpaidAmount: Math.max(0, totalSpent - totalPaid),
      totalBoxes,
    },
  };
}

export interface DayScheduleSummary {
  date: string;
  orderCount: number;
  qty10kg: number;
  qty20kg: number;
  normalQty20kg: number;
  eventQty20kg: number;
  eventOrdersCount: number;
  eventNames: string[];
  totalWeight: number;
  orders: any[];
}

export async function fetchScheduleSummaryService(
  startDate: string,
  endDate: string
): Promise<Record<string, DayScheduleSummary>> {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  // 1. 기간 내 주문 목록 조회 (품목 요약 포함)
  const ordersResult = await db.execute({
    sql: `
      SELECT 
        o.*,
        s.tracking_no,
        GROUP_CONCAT(oi.product_name || ' ' || oi.quantity || '개', ', ') as items_summary
      FROM orders o
      LEFT JOIN shipments s ON s.order_id = o.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.shipping_date BETWEEN ? AND ?
      GROUP BY o.id
      ORDER BY o.shipping_date ASC, o.id ASC
    `,
    args: [startDate, endDate],
  });

  // 2. 기간 내 품목별 수량 조회
  const itemsResult = await db.execute({
    sql: `
      SELECT 
        o.shipping_date,
        oi.order_id,
        oi.product_name,
        oi.weight_kg,
        oi.quantity
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.shipping_date BETWEEN ? AND ?
    `,
    args: [startDate, endDate],
  });

  const summaryMap: Record<string, DayScheduleSummary> = {};
  const orderMetaMap: Record<number, { order_type: string; event_name: string }> = {};

  // 주문 기본 매핑
  for (const row of ordersResult.rows) {
    const sDate = String(row.shipping_date);
    const orderId = Number(row.id);
    const orderType = String(row.order_type || "NORMAL");
    const eventName = String(row.event_name || "");

    orderMetaMap[orderId] = { order_type: orderType, event_name: eventName };

    if (!summaryMap[sDate]) {
      summaryMap[sDate] = {
        date: sDate,
        orderCount: 0,
        qty10kg: 0,
        qty20kg: 0,
        normalQty20kg: 0,
        eventQty20kg: 0,
        eventOrdersCount: 0,
        eventNames: [],
        totalWeight: 0,
        orders: [],
      };
    }
    summaryMap[sDate].orderCount += 1;
    summaryMap[sDate].orders.push(row);

    if (orderType === "EVENT") {
      summaryMap[sDate].eventOrdersCount += 1;
      const cleanEventName = eventName || "임실 김치 축제";
      if (!summaryMap[sDate].eventNames.includes(cleanEventName)) {
        summaryMap[sDate].eventNames.push(cleanEventName);
      }
    }
  }

  // 품목 수량 및 중량 매핑
  for (const row of itemsResult.rows) {
    const sDate = String(row.shipping_date);
    if (!summaryMap[sDate]) {
      summaryMap[sDate] = {
        date: sDate,
        orderCount: 0,
        qty10kg: 0,
        qty20kg: 0,
        normalQty20kg: 0,
        eventQty20kg: 0,
        eventOrdersCount: 0,
        eventNames: [],
        totalWeight: 0,
        orders: [],
      };
    }
    const weight = Number(row.weight_kg);
    const qty = Number(row.quantity);
    const orderId = Number(row.order_id);
    const isEvent = orderMetaMap[orderId]?.order_type === "EVENT";

    if (weight === 10) summaryMap[sDate].qty10kg += qty;
    if (weight === 20) {
      summaryMap[sDate].qty20kg += qty;
      if (isEvent) {
        summaryMap[sDate].eventQty20kg += qty;
      } else {
        summaryMap[sDate].normalQty20kg += qty;
      }
    }
    summaryMap[sDate].totalWeight += weight * qty;
  }

  return summaryMap;
}

export async function createCustomerService(data: {
  name: string;
  phone: string;
  phone2?: string;
  address?: string;
  address_detail?: string;
  memo?: string;
}) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const now = new Date().toISOString();
  const cleanPhone = data.phone.replace(/[^0-9]/g, "");

  // 중복 확인 (전화번호 기준)
  const existing = await db.execute({
    sql: "SELECT id FROM customers WHERE REPLACE(phone, '-', '') = ? LIMIT 1",
    args: [cleanPhone],
  });

  if (existing.rows.length > 0) {
    const id = Number(existing.rows[0].id);
    await db.execute({
      sql: `UPDATE customers SET 
              name = ?, 
              address = CASE WHEN ? != '' THEN ? ELSE address END, 
              address_detail = CASE WHEN ? != '' THEN ? ELSE address_detail END, 
              memo = CASE WHEN ? != '' THEN ? ELSE memo END,
              updated_at = ? 
            WHERE id = ?`,
      args: [
        data.name,
        data.address || "",
        data.address || "",
        data.address_detail || "",
        data.address_detail || "",
        data.memo || "",
        data.memo || "",
        now,
        id,
      ],
    });
    return { id, isNew: false };
  } else {
    const custCode = await generateCustomerCode(db, data.name);
    const res = await db.execute({
      sql: `INSERT INTO customers (customer_code, name, phone, phone2, address, address_detail, memo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        custCode,
        data.name,
        data.phone,
        data.phone2 || "",
        data.address || "",
        data.address_detail || "",
        data.memo || "",
        now,
        now,
      ],
    });
    const newId = Number(res.lastInsertRowid);
    if (data.address) {
      await db.execute({
        sql: `INSERT INTO customer_addresses (customer_id, alias, recipient_name, recipient_phone, address, address_detail, is_default, created_at, updated_at)
              VALUES (?, '기본 자택', ?, ?, ?, ?, 1, ?, ?)`,
        args: [newId, data.name, data.phone, data.address, data.address_detail || "", now, now],
      });
    }
    return { id: newId, isNew: true, customer_code: custCode };
  }
}

export async function batchCreateCustomersService(
  customersList: Array<{
    name: string;
    phone: string;
    address?: string;
    address_detail?: string;
    memo?: string;
  }>
) {
  let createdCount = 0;
  let updatedCount = 0;

  for (const c of customersList) {
    if (!c.name || !c.phone) continue;
    const res = await createCustomerService(c);
    if (res.isNew) createdCount++;
    else updatedCount++;
  }

  return { createdCount, updatedCount, total: customersList.length };
}

// ────────────────────────────────────────────────
// 장부관리: 전체 판매 주문 리스트 조회 (필터/검색)
// ────────────────────────────────────────────────
export async function fetchAllOrdersService(opts: {
  search?: string;
  searchType?: "ALL" | "CUSTOMER" | "PHONE" | "ADDRESS";
  dateFrom?: string;
  dateTo?: string;
  paymentStatus?: "ALL" | "PAID" | "UNPAID";
  orderStatus?: "ALL" | "PENDING" | "PACKED" | "SHIPPED";
  orderType?: "ALL" | "NORMAL" | "EVENT";
  limit?: number;
  offset?: number;
} = {}) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const {
    search = "",
    searchType = "ALL",
    dateFrom = "",
    dateTo = "",
    paymentStatus = "ALL",
    orderStatus = "ALL",
    orderType = "ALL",
    limit = 100,
    offset = 0,
  } = opts;

  const args: any[] = [];
  const wheres: string[] = [];

  if (search.trim()) {
    const q = search.trim();
    const cleanQ = q.replace(/-/g, "");
    if (searchType === "CUSTOMER") {
      wheres.push("(c.name LIKE ? OR o.customer_name LIKE ? OR c.customer_code LIKE ?)");
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    } else if (searchType === "PHONE") {
      wheres.push("(REPLACE(c.phone,'-','') LIKE ? OR REPLACE(o.customer_phone,'-','') LIKE ?)");
      args.push(`%${cleanQ}%`, `%${cleanQ}%`);
    } else if (searchType === "ADDRESS") {
      wheres.push("(c.address LIKE ? OR c.address_detail LIKE ? OR o.shipping_address LIKE ?)");
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    } else {
      wheres.push(
        "(c.name LIKE ? OR o.customer_name LIKE ? OR c.customer_code LIKE ? OR REPLACE(c.phone,'-','') LIKE ? OR REPLACE(o.customer_phone,'-','') LIKE ? OR c.address LIKE ? OR o.shipping_address LIKE ?)"
      );
      args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${cleanQ}%`, `%${cleanQ}%`, `%${q}%`, `%${q}%`);
    }
  }
  if (dateFrom) { wheres.push("o.shipping_date >= ?"); args.push(dateFrom); }
  if (dateTo)   { wheres.push("o.shipping_date <= ?"); args.push(dateTo); }
  if (paymentStatus !== "ALL") { wheres.push("o.payment_status = ?"); args.push(paymentStatus); }
  if (orderStatus !== "ALL")   { wheres.push("o.order_status = ?"); args.push(orderStatus); }
  if (orderType === "EVENT")   { wheres.push("(o.order_type = 'EVENT' OR (o.event_name IS NOT NULL AND o.event_name != ''))"); }
  else if (orderType === "NORMAL") { wheres.push("(o.order_type != 'EVENT' OR o.order_type IS NULL) AND (o.event_name IS NULL OR o.event_name = '')"); }

  const whereClause = wheres.length ? "WHERE " + wheres.join(" AND ") : "";

  const sql = `
    SELECT
      o.id, o.order_no, o.shipping_date, o.payment_status, o.order_status,
      o.total_amount, s.tracking_no, o.memo, o.order_type, o.event_name,
      c.id as customer_id, c.customer_code, c.name as customer_name, c.phone as customer_phone,
      c.address as shipping_address, c.address_detail as shipping_address_detail,
      (SELECT GROUP_CONCAT(p.name||' '||oi.quantity||'박스', ', ')
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = o.id) as items_summary,
      (SELECT SUM(oi.quantity)
       FROM order_items oi WHERE oi.order_id = o.id) as total_boxes
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN shipments s ON s.order_id = o.id
    ${whereClause}
    ORDER BY o.shipping_date DESC, o.id DESC
    LIMIT ? OFFSET ?
  `;
  args.push(limit, offset);

  const countSql = `
    SELECT COUNT(*) as cnt, SUM(o.total_amount) as total_sales,
           SUM(CASE WHEN o.payment_status='PAID' THEN o.total_amount ELSE 0 END) as paid_sales,
           SUM(CASE WHEN o.payment_status='UNPAID' THEN o.total_amount ELSE 0 END) as unpaid_sales
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ${whereClause}
  `;
  const countArgs = args.slice(0, args.length - 2); // limit/offset 제외

  const [rows, countRows] = await Promise.all([
    db.execute({ sql, args }),
    db.execute({ sql: countSql, args: countArgs }),
  ]);

  const stat = countRows.rows[0] || {};
  return {
    orders: rows.rows,
    total: Number(stat.cnt) || 0,
    totalSales: Number(stat.total_sales) || 0,
    paidSales: Number(stat.paid_sales) || 0,
    unpaidSales: Number(stat.unpaid_sales) || 0,
  };
}

// 고객 수정
export async function updateCustomerService(data: {
  id: number;
  customer_code?: string;
  name: string;
  phone: string;
  phone2?: string;
  address?: string;
  address_detail?: string;
  memo?: string;
}) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE customers SET 
            customer_code = COALESCE(?, customer_code),
            name = ?, 
            phone = ?, 
            phone2 = ?, 
            address = ?, 
            address_detail = ?, 
            memo = ?,
            updated_at = ?
          WHERE id = ?`,
    args: [
      data.customer_code ? data.customer_code.trim().toUpperCase() : null,
      data.name.trim(),
      data.phone.trim(),
      data.phone2 ? data.phone2.trim() : "",
      data.address ? data.address.trim() : "",
      data.address_detail ? data.address_detail.trim() : "",
      data.memo ? data.memo.trim() : "",
      now,
      data.id,
    ],
  });
}

// 고객 삭제 (주문이 없는 경우만)
export async function deleteCustomerService(id: number) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const check = await db.execute({ sql: `SELECT COUNT(*) as cnt FROM orders WHERE customer_id=?`, args: [id] });
  const cnt = Number(check.rows[0]?.cnt || 0);
  if (cnt > 0) {
    throw new Error(`주문 이력(${cnt}건)이 있는 고객은 데이터 무결성을 위해 삭제할 수 없습니다. 대신 고객 수정에서 메모에 '미사용'으로 변경하세요.`);
  }
  // 등록된 배송지 목록 먼저 안전 삭제
  await db.execute({ sql: `DELETE FROM customer_addresses WHERE customer_id=?`, args: [id] });
  await db.execute({ sql: `DELETE FROM customers WHERE id=?`, args: [id] });
}

