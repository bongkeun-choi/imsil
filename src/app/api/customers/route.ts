import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const customerId = searchParams.get("id");

    // 특정 고객의 상세 및 과거 주문 이력
    if (customerId) {
      const customerResult = await db.execute({
        sql: "SELECT * FROM customers WHERE id = ?",
        args: [customerId],
      });

      if (customerResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "고객을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      const ordersResult = await db.execute({
        sql: `
          SELECT o.id, o.order_no, o.order_date, o.shipping_date, o.total_amount, o.payment_status, o.order_status
          FROM orders o
          WHERE o.customer_id = ?
          ORDER BY o.id DESC
        `,
        args: [customerId],
      });

      return NextResponse.json({
        success: true,
        customer: customerResult.rows[0],
        orders: ordersResult.rows,
      });
    }

    // 고객 검색 (이름 또는 전화번호 뒷자리/전체)
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

    return NextResponse.json({
      success: true,
      customers: result.rows,
    });
  } catch (error) {
    console.error("고객 조회 실패:", error);
    return NextResponse.json(
      { success: false, error: "고객 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
