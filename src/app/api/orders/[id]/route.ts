import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, tracking_no, courier } = body;
    const db = getDb();
    const now = new Date().toISOString();

    const orderResult = await db.execute({
      sql: "SELECT id, customer_name, total_amount, paid_amount, payment_status, order_status FROM orders WHERE id = ?",
      args: [id],
    });

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const order = orderResult.rows[0];

    // 1. 원클릭 입금완료 처리
    if (action === "mark_paid") {
      const totalAmount = Number(order.total_amount);
      await db.execute({
        sql: "UPDATE orders SET payment_status = 'PAID', paid_amount = ?, updated_at = ? WHERE id = ?",
        args: [totalAmount, now, id],
      });

      await db.execute({
        sql: `INSERT INTO payments (order_id, amount, paid_at, payer_name, method, created_at)
              VALUES (?, ?, ?, ?, '계좌이체', ?)`,
        args: [id, totalAmount, now, order.customer_name, now],
      });

      return NextResponse.json({
        success: true,
        message: "입금 완료 처리되었습니다.",
      });
    }

    // 2. 포장완료 처리
    if (action === "mark_packed") {
      await db.execute({
        sql: "UPDATE orders SET order_status = 'PACKED', updated_at = ? WHERE id = ?",
        args: [now, id],
      });

      await db.execute({
        sql: "UPDATE shipments SET status = 'PACKED', updated_at = ? WHERE order_id = ?",
        args: [now, id],
      });

      return NextResponse.json({
        success: true,
        message: "포장 완료 처리되었습니다.",
      });
    }

    // 3. 운송장 등록 및 발송완료 처리
    if (action === "mark_shipped") {
      await db.execute({
        sql: "UPDATE orders SET order_status = 'SHIPPED', updated_at = ? WHERE id = ?",
        args: [now, id],
      });

      await db.execute({
        sql: `UPDATE shipments SET 
                tracking_no = COALESCE(?, tracking_no), 
                courier = COALESCE(?, courier),
                shipped_at = ?, 
                status = 'SHIPPED', 
                updated_at = ? 
              WHERE order_id = ?`,
        args: [tracking_no || null, courier || null, now, now, id],
      });

      return NextResponse.json({
        success: true,
        message: "운송장 등록 및 발송 완료 처리되었습니다.",
      });
    }

    // 4. 일반 운송장 번호만 업데이트
    if (action === "update_tracking") {
      await db.execute({
        sql: "UPDATE shipments SET tracking_no = ?, updated_at = ? WHERE order_id = ?",
        args: [tracking_no || "", now, id],
      });

      return NextResponse.json({
        success: true,
        message: "운송장 번호가 저장되었습니다.",
      });
    }

    return NextResponse.json(
      { success: false, error: "알 수 없는 요청 액션입니다." },
      { status: 400 }
    );
  } catch (error) {
    console.error("주문 상태 변경 실패:", error);
    return NextResponse.json(
      { success: false, error: "주문 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
