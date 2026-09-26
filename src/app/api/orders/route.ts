import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const query = searchParams.get("q");
    const status = searchParams.get("status");

    let sql = `
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
        o.created_at,
        s.courier,
        s.tracking_no,
        s.status as shipment_status
      FROM orders o
      LEFT JOIN shipments s ON s.order_id = o.id
      WHERE 1=1
    `;
    const args: any[] = [];

    if (date) {
      sql += " AND o.shipping_date = ?";
      args.push(date);
    }

    if (status) {
      sql += " AND o.order_status = ?";
      args.push(status);
    }

    if (query) {
      sql += " AND (o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.order_no LIKE ? OR s.tracking_no LIKE ?)";
      const pattern = `%${query}%`;
      args.push(pattern, pattern, pattern, pattern);
    }

    sql += " ORDER BY o.id DESC LIMIT 100";

    const ordersResult = await db.execute({ sql, args });

    // 각 주문의 품목 목록 조회
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

    return NextResponse.json({ success: true, orders: ordersWithItems });
  } catch (error) {
    console.error("주문 목록 조회 실패:", error);
    return NextResponse.json(
      { success: false, error: "주문 목록을 가져오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      zipcode,
      address,
      address_detail,
      shipping_date,
      items, // [{ product_id, product_name, quantity, unit_price, weight_kg }]
      payment_status = "UNPAID",
      memo = "",
    } = body;

    if (!name || !phone || !shipping_date || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "고객명, 전화번호, 출고일, 주문 상품은 필수입니다." },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();
    const todayStr = format(new Date(), "yyyyMMdd");

    // 1. 고객 확인 및 등록
    let customerId: number;
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const existingCustomer = await db.execute({
      sql: "SELECT id FROM customers WHERE REPLACE(phone, '-', '') = ? LIMIT 1",
      args: [cleanPhone],
    });

    if (existingCustomer.rows.length > 0) {
      customerId = Number(existingCustomer.rows[0].id);
      // 기존 고객 주소 업데이트
      await db.execute({
        sql: `UPDATE customers SET 
                name = ?, address = COALESCE(?, address), 
                address_detail = COALESCE(?, address_detail), 
                updated_at = ? WHERE id = ?`,
        args: [name, address, address_detail, now, customerId],
      });
    } else {
      const newCustomer = await db.execute({
        sql: `INSERT INTO customers (name, phone, zipcode, address, address_detail, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [name, phone, zipcode || "", address || "", address_detail || "", now, now],
      });
      customerId = Number(newCustomer.lastInsertRowid);
    }

    // 2. 주문번호 생성 (YYYYMMDD-001 형식)
    const todayCountResult = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM orders WHERE order_no LIKE ?",
      args: [`${todayStr}-%`],
    });
    const nextSeq = Number(todayCountResult.rows[0].cnt) + 1;
    const orderNo = `${todayStr}-${String(nextSeq).padStart(3, "0")}`;

    // 총 금액 계산
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += Number(item.unit_price) * Number(item.quantity);
    }

    const paidAmount = payment_status === "PAID" ? totalAmount : 0;

    // 3. orders 테이블 등록
    const orderResult = await db.execute({
      sql: `INSERT INTO orders (
              order_no, customer_id, customer_name, customer_phone,
              shipping_address, shipping_address_detail, order_date,
              shipping_date, total_amount, paid_amount, payment_status,
              order_status, memo, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?)`,
      args: [
        orderNo,
        customerId,
        name,
        phone,
        address || "",
        address_detail || "",
        format(new Date(), "yyyy-MM-dd"),
        shipping_date,
        totalAmount,
        paidAmount,
        payment_status,
        memo,
        now,
        now,
      ],
    });

    const orderId = Number(orderResult.lastInsertRowid);

    // 4. order_items 등록
    for (const item of items) {
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

    // 5. 입금완료인 경우 payments 테이블 기록
    if (payment_status === "PAID") {
      await db.execute({
        sql: `INSERT INTO payments (order_id, amount, paid_at, payer_name, method, created_at)
              VALUES (?, ?, ?, ?, '계좌이체', ?)`,
        args: [orderId, totalAmount, now, name, now],
      });
    }

    // 6. shipments 초기 레코드 생성
    await db.execute({
      sql: `INSERT INTO shipments (order_id, courier, tracking_no, status, created_at, updated_at)
            VALUES (?, '우체국택배', '', 'READY', ?, ?)`,
      args: [orderId, now, now],
    });

    return NextResponse.json({
      success: true,
      message: "주문이 정상적으로 등록되었습니다.",
      orderId,
      orderNo,
    });
  } catch (error) {
    console.error("주문 등록 실패:", error);
    return NextResponse.json(
      { success: false, error: "주문 등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
