/**
 * 스마트 주문 가져오기 통합 서비스
 * (Smart Order Import & Confirmation Service)
 */

import { getClientDb } from "./clientDb";
import { parseOrderText, ParsedOrderResult } from "./orderParser";
import { matchCustomer, MatchedCustomer } from "./customerMatcher";
import { detectDuplicateOrder, DuplicateCheckResult } from "./duplicateDetector";
import { createOrderService, fetchProductsService } from "./services";

export interface AnalyzedImportResult {
  import_id: number;
  parsed: ParsedOrderResult;
  customer_match: MatchedCustomer | null;
  duplicate_check: DuplicateCheckResult;
}

/**
 * 텍스트 또는 OCR 결과로부터 전체 분석 파이프라인 실행
 * (전처리/텍스트 -> 파싱 -> 고객 매칭 -> 중복 검사 -> DB 기록)
 */
export async function analyzeOrderImport(
  sourceType: "IMAGE_UPLOAD" | "CAMERA" | "TEXT_PASTE",
  rawText: string,
  sourceImage?: string
): Promise<AnalyzedImportResult> {
  const db = getClientDb();
  const now = new Date().toISOString();

  // 1. 주문 파서 실행
  const parsed = parseOrderText(rawText);

  // 2. order_imports 테이블에 작업 기록 생성
  const insertImport = await db.execute({
    sql: `
      INSERT INTO order_imports (source_type, source_image, ocr_text, parsed_json, status, created_at)
      VALUES (?, ?, ?, ?, 'REVIEW', ?)
      RETURNING id
    `,
    args: [sourceType, sourceImage || null, rawText, JSON.stringify(parsed), now],
  });

  const importId = Number(insertImport.rows[0].id);

  // 3. 고객 매칭
  const customerMatch = await matchCustomer(
    parsed.customer_phone,
    parsed.customer_name,
    parsed.shipping_address
  );

  if (customerMatch) {
    await db.execute({
      sql: `
        INSERT INTO customer_match_results (import_id, customer_id, score, match_type, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [importId, customerMatch.id, customerMatch.score, customerMatch.match_type, now],
    });
  }

  // 4. 중복 검사
  const firstItem = parsed.items[0];
  const duplicateCheck = await detectDuplicateOrder({
    customer_id: customerMatch?.id,
    customer_phone: parsed.customer_phone,
    shipping_date: parsed.shipping_date,
    weight_kg: firstItem?.weight_kg,
    quantity: firstItem?.quantity,
  });

  await db.execute({
    sql: `
      INSERT INTO duplicate_checks (import_id, order_id, score, reason, decision, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [
      importId,
      duplicateCheck.matched_order?.id || null,
      duplicateCheck.score,
      duplicateCheck.reason,
      duplicateCheck.decision,
      now,
    ],
  });

  return {
    import_id: importId,
    parsed,
    customer_match: customerMatch,
    duplicate_check: duplicateCheck,
  };
}

/**
 * 사용자 검토 후 최종 주문 등록 확정
 */
export async function confirmImportedOrder(params: {
  import_id: number;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  shipping_address_detail?: string;
  shipping_date: string;
  items: { product_name: string; weight_kg: number; quantity: number }[];
  memo?: string;
  is_paid?: boolean;
}): Promise<{ order_id: number; order_no: string }> {
  const db = getClientDb();
  const now = new Date().toISOString();

  // 상품 단가 조회를 위해 DB 상품 목록 가져오기
  const products = await fetchProductsService();
  const p10 = products.find((p) => p.weight_kg === 10) || { id: 1, price: 38000, name: "절임배추 10kg", weight_kg: 10 };
  const p20 = products.find((p) => p.weight_kg === 20) || { id: 2, price: 68000, name: "절임배추 20kg", weight_kg: 20 };

  const orderItemsPayload = params.items.map((it) => {
    const prod = it.weight_kg === 10 ? p10 : p20;
    return {
      product_id: prod.id,
      product_name: prod.name,
      quantity: it.quantity,
      unit_price: prod.price,
      weight_kg: prod.weight_kg,
    };
  });

  // 주문 등록 (내부에서 고객 없으면 자동 생성됨)
  const result = await createOrderService({
    name: params.customer_name,
    phone: params.customer_phone,
    address: params.shipping_address,
    address_detail: params.shipping_address_detail || "",
    shipping_date: params.shipping_date,
    items: orderItemsPayload,
    payment_status: params.is_paid ? "PAID" : "UNPAID",
    memo: params.memo,
  });

  // order_sources에 원본 매핑 기록
  const importRow = await db.execute({
    sql: `SELECT * FROM order_imports WHERE id = ?`,
    args: [params.import_id],
  });

  if (importRow.rows.length > 0) {
    const row = importRow.rows[0];
    await db.execute({
      sql: `
        INSERT INTO order_sources (order_id, import_id, source_type, image_path, ocr_text, parsed_json, confidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1.0, ?)
      `,
      args: [
        result.orderId,
        params.import_id,
        String(row.source_type),
        row.source_image ? String(row.source_image) : null,
        row.ocr_text ? String(row.ocr_text) : null,
        row.parsed_json ? String(row.parsed_json) : null,
        now,
      ],
    });

    // import 상태 완료로 변경
    await db.execute({
      sql: `UPDATE order_imports SET status = 'CONFIRMED', completed_at = ? WHERE id = ?`,
      args: [now, params.import_id],
    });
  }

  return {
    order_id: result.orderId,
    order_no: result.orderNo,
  };
}
