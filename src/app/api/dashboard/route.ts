import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");

    // 오늘 출고 예정인 주문 목록 조회
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
          s.tracking_no,
          s.status as shipment_status
        FROM orders o
        LEFT JOIN shipments s ON s.order_id = o.id
        WHERE o.shipping_date = ?
        ORDER BY o.id DESC
      `,
      args: [date],
    });

    const orders = todayOrdersResult.rows;

    // 해당 날짜의 상품별 수량 합계 집계
    const itemsResult = await db.execute({
      sql: `
        SELECT 
          oi.weight_kg,
          SUM(oi.quantity) as total_qty,
          SUM(oi.amount) as total_sum
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.shipping_date = ?
        GROUP BY oi.weight_kg
      `,
      args: [date],
    });

    let qty10kg = 0;
    let qty20kg = 0;
    let totalWeight = 0;

    for (const row of itemsResult.rows) {
      const weight = Number(row.weight_kg);
      const qty = Number(row.total_qty);
      if (weight === 10) qty10kg += qty;
      if (weight === 20) qty20kg += qty;
      totalWeight += weight * qty;
    }

    // 미입금 주문 전체 건수 및 총액 (오늘 날짜 및 전체 미입금 현황)
    const unpaidResult = await db.execute(`
      SELECT 
        COUNT(*) as unpaid_count,
        COALESCE(SUM(total_amount - paid_amount), 0) as unpaid_total
      FROM orders
      WHERE payment_status != 'PAID'
    `);

    const unpaidCount = Number(unpaidResult.rows[0]?.unpaid_count || 0);
    const unpaidTotal = Number(unpaidResult.rows[0]?.unpaid_total || 0);

    return NextResponse.json({
      success: true,
      date,
      summary: {
        totalOrders: orders.length,
        totalWeight,
        qty10kg,
        qty20kg,
        unpaidCount,
        unpaidTotal,
      },
      orders,
    });
  } catch (error) {
    console.error("대시보드 조회 실패:", error);
    return NextResponse.json(
      { success: false, error: "대시보드 데이터를 가져오지 못했습니다." },
      { status: 500 }
    );
  }
}
