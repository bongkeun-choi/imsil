/**
 * 주문 중복 검사기 (Duplicate Detector)
 * 
 * 고객 + 출고일 + 상품 + 중량 + 수량 및 접수 일시를 종합하여
 * 중복 가능성 점수(0~100점)를 계산하고 판단합니다.
 */

import { getClientDb } from "./clientDb";

export interface DuplicateCheckResult {
  score: number; // 0 ~ 100
  decision: "NEW" | "POSSIBLE_DUPLICATE" | "DUPLICATE";
  reason: string;
  matched_order?: {
    id: number;
    order_no: string;
    customer_name: string;
    customer_phone: string;
    shipping_date: string;
    total_amount: number;
    payment_status: string;
    order_status: string;
    items_summary: string;
  };
}

export async function detectDuplicateOrder(params: {
  customer_id?: number;
  customer_phone?: string;
  shipping_date?: string;
  weight_kg?: number;
  quantity?: number;
}): Promise<DuplicateCheckResult> {
  const db = getClientDb();
  const phone = params.customer_phone?.replace(/[^0-9]/g, "");

  // 최근 30일 이내의 주문들 중에서 해당 고객 또는 전화번호 일치 주문 검색
  const res = await db.execute({
    sql: `
      SELECT o.id, o.order_no, o.customer_id, o.customer_name, o.customer_phone,
             o.shipping_date, o.total_amount, o.payment_status, o.order_status, o.created_at,
             GROUP_CONCAT(oi.product_name || ' ' || oi.quantity || '개', ', ') as items_summary,
             GROUP_CONCAT(oi.weight_kg) as weights,
             GROUP_CONCAT(oi.quantity) as quantities
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE (o.customer_id = ? OR REPLACE(o.customer_phone, '-', '') = ?)
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `,
    args: [params.customer_id || -1, phone || ""],
  });

  if (res.rows.length === 0) {
    return {
      score: 0,
      decision: "NEW",
      reason: "동일 고객의 최근 주문 이력이 없습니다. (신규 주문)",
    };
  }

  let highestScore = 0;
  let bestMatchOrder: DuplicateCheckResult["matched_order"] = undefined;
  const reasons: string[] = [];

  for (const row of res.rows) {
    let currentScore = 0;
    const currentReasons: string[] = [];

    // 1. 전화번호 동일 (+40)
    const existingPhone = String(row.customer_phone || "").replace(/[^0-9]/g, "");
    if (phone && existingPhone === phone) {
      currentScore += 40;
      currentReasons.push("전화번호 일치(+40)");
    }

    // 2. 고객 ID 동일 (+20)
    if (params.customer_id && Number(row.customer_id) === params.customer_id) {
      currentScore += 20;
      currentReasons.push("고객 정보 일치(+20)");
    }

    // 3. 출고일 동일 (+15)
    if (params.shipping_date && String(row.shipping_date) === params.shipping_date) {
      currentScore += 15;
      currentReasons.push(`출고일(${params.shipping_date}) 동일(+15)`);
    }

    // 4. 상품 중량 및 수량 비교 (+15)
    const weights = String(row.weights || "").split(",").map(Number);
    const quantities = String(row.quantities || "").split(",").map(Number);

    if (params.weight_kg && weights.includes(params.weight_kg)) {
      currentScore += 10;
      currentReasons.push(`중량(${params.weight_kg}kg) 동일(+10)`);
    }

    if (params.quantity && quantities.includes(params.quantity)) {
      currentScore += 5;
      currentReasons.push(`수량(${params.quantity}개) 동일(+5)`);
    }

    // 5. 최근 7일 이내 생성 (+10)
    const createdAt = new Date(String(row.created_at)).getTime();
    const now = Date.now();
    const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
    if (diffDays <= 7) {
      currentScore += 10;
      currentReasons.push("최근 7일 이내 등록된 주문(+10)");
    }

    if (currentScore > highestScore) {
      highestScore = currentScore;
      bestMatchOrder = {
        id: Number(row.id),
        order_no: String(row.order_no),
        customer_name: String(row.customer_name),
        customer_phone: String(row.customer_phone),
        shipping_date: String(row.shipping_date),
        total_amount: Number(row.total_amount),
        payment_status: String(row.payment_status),
        order_status: String(row.order_status),
        items_summary: String(row.items_summary || ""),
      };
      reasons.length = 0;
      reasons.push(...currentReasons);
    }
  }

  // 100점 상한
  const finalScore = Math.min(100, highestScore);

  let decision: DuplicateCheckResult["decision"] = "NEW";
  if (finalScore >= 80) {
    decision = "DUPLICATE";
  } else if (finalScore >= 50) {
    decision = "POSSIBLE_DUPLICATE";
  }

  return {
    score: finalScore,
    decision,
    reason: reasons.join(", ") || "중복 의심 요인 없음",
    matched_order: bestMatchOrder,
  };
}
