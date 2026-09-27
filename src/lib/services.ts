import { getClientDb } from "./clientDb";
import { format } from "date-fns";

export async function fetchSettingsService() {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const result = await db.execute("SELECT key, value FROM settings");
  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    settings[row.key as string] = (row.value as string) || "";
  }

  const productsResult = await db.execute(
    "SELECT id, name, weight_kg, price FROM products WHERE active = 1 ORDER BY weight_kg ASC"
  );

  return {
    settings,
    products: productsResult.rows,
  };
}

export async function fetchProductsService(): Promise<{ id: number; name: string; weight_kg: number; price: number }[]> {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const res = await db.execute("SELECT id, name, weight_kg, price FROM products WHERE active = 1 ORDER BY weight_kg ASC");
  return res.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    weight_kg: Number(r.weight_kg),
    price: Number(r.price),
  }));
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
  name: string;
  phone: string;
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
  const cleanPhone = data.phone.replace(/[^0-9]/g, "");

  // 1. 고객 확인 및 등록
  let customerId: number;
  const existingCustomer = await db.execute({
    sql: "SELECT id FROM customers WHERE REPLACE(phone, '-', '') = ? LIMIT 1",
    args: [cleanPhone],
  });

  if (existingCustomer.rows.length > 0) {
    customerId = Number(existingCustomer.rows[0].id);
    await db.execute({
      sql: `UPDATE customers SET 
              name = ?, address = COALESCE(?, address), 
              address_detail = COALESCE(?, address_detail), 
              updated_at = ? WHERE id = ?`,
      args: [data.name, data.address, data.address_detail || "", now, customerId],
    });
  } else {
    const newCustomer = await db.execute({
      sql: `INSERT INTO customers (name, phone, zipcode, address, address_detail, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [data.name, data.phone, data.zipcode || "", data.address, data.address_detail || "", now, now],
    });
    customerId = Number(newCustomer.lastInsertRowid);
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

  // 3. 주문 등록
  const orderResult = await db.execute({
    sql: `INSERT INTO orders (
            order_no, customer_id, customer_name, customer_phone,
            shipping_address, shipping_address_detail, order_date,
            shipping_date, total_amount, paid_amount, payment_status,
            order_status, memo, order_type, event_name, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?)`,
    args: [
      orderNo,
      customerId,
      data.name,
      data.phone,
      data.address,
      data.address_detail || "",
      format(new Date(), "yyyy-MM-dd"),
      data.shipping_date,
      totalAmount,
      paidAmount,
      data.payment_status,
      data.memo || "",
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

export async function fetchOrdersService(dateStr: string) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");

  const ordersResult = await db.execute({
    sql: `
      SELECT 
        o.id,
        o.order_no,
        o.customer_id,
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
  action: "mark_paid" | "mark_packed" | "mark_shipped" | "update_tracking",
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

  // 1. orders 업데이트
  await db.execute({
    sql: `UPDATE orders SET 
            customer_name = ?,
            customer_phone = ?,
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

  // 2. 고객 정보 동기화
  const cleanPhone = data.customerPhone.replace(/[^0-9]/g, "");
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
      c.id, c.name, c.phone, c.zipcode, c.address, c.address_detail, c.memo,
      COUNT(o.id) as order_count,
      MAX(o.shipping_date) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
  `;
  const args: any[] = [];

  if (query && query.trim()) {
    const cleanQ = query.trim().replace(/-/g, "");
    sql += " WHERE c.name LIKE ? OR REPLACE(c.phone, '-', '') LIKE ?";
    args.push(`%${query.trim()}%`, `%${cleanQ}%`);
  }

  sql += " GROUP BY c.id ORDER BY c.id DESC LIMIT 50";

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
      SELECT o.id, o.order_no, o.order_date, o.shipping_date, o.total_amount, o.payment_status, o.order_status
      FROM orders o
      WHERE o.customer_id = ?
      ORDER BY o.id DESC
    `,
    args: [id],
  });

  return {
    customer: customerResult.rows[0],
    orders: ordersResult.rows,
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
    const res = await db.execute({
      sql: `INSERT INTO customers (name, phone, phone2, address, address_detail, memo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
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
    return { id: Number(res.lastInsertRowid), isNew: true };
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
      wheres.push("(c.name LIKE ? OR o.customer_name LIKE ?)");
      args.push(`%${q}%`, `%${q}%`);
    } else if (searchType === "PHONE") {
      wheres.push("(REPLACE(c.phone,'-','') LIKE ? OR REPLACE(o.customer_phone,'-','') LIKE ?)");
      args.push(`%${cleanQ}%`, `%${cleanQ}%`);
    } else if (searchType === "ADDRESS") {
      wheres.push("(c.address LIKE ? OR c.address_detail LIKE ? OR o.shipping_address LIKE ?)");
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    } else {
      wheres.push(
        "(c.name LIKE ? OR o.customer_name LIKE ? OR REPLACE(c.phone,'-','') LIKE ? OR REPLACE(o.customer_phone,'-','') LIKE ? OR c.address LIKE ? OR o.shipping_address LIKE ?)"
      );
      args.push(`%${q}%`, `%${q}%`, `%${cleanQ}%`, `%${cleanQ}%`, `%${q}%`, `%${q}%`);
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
      c.id as customer_id, c.name as customer_name, c.phone as customer_phone,
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
  name: string;
  phone: string;
  address?: string;
  address_detail?: string;
  memo?: string;
}) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  await db.execute({
    sql: `UPDATE customers SET name=?, phone=?, address=?, address_detail=?, memo=? WHERE id=?`,
    args: [data.name, data.phone, data.address || "", data.address_detail || "", data.memo || "", data.id],
  });
}

// 고객 삭제 (주문이 없는 경우만)
export async function deleteCustomerService(id: number) {
  const db = getClientDb();
  if (!db) throw new Error("DB_NOT_CONFIGURED");
  const check = await db.execute({ sql: `SELECT COUNT(*) as cnt FROM orders WHERE customer_id=?`, args: [id] });
  if (Number(check.rows[0]?.cnt) > 0) {
    throw new Error("주문 이력이 있는 고객은 삭제할 수 없습니다.");
  }
  await db.execute({ sql: `DELETE FROM customers WHERE id=?`, args: [id] });
}

