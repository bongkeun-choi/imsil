/**
 * 고객 매칭 및 과거 주문 조회 모듈 (Customer Matcher)
 */

import { getClientDb } from "./clientDb";

export interface MatchedCustomer {
  id: number;
  name: string;
  phone: string;
  address: string;
  address_detail?: string;
  memo?: string;
  match_type: "PHONE_EXACT" | "PHONE_NAME" | "NAME_ADDRESS" | "NEW_CUSTOMER";
  score: number; // 0 ~ 1.0
  last_order?: {
    id: number;
    order_no: string;
    order_date: string;
    shipping_date: string;
    items_summary: string;
    shipping_address: string;
  };
}

export async function matchCustomer(
  phone?: string,
  name?: string,
  address?: string
): Promise<MatchedCustomer | null> {
  const db = getClientDb();

  // 1. 전화번호 완전 일치 검색 (010-1234-5678 또는 하이픈 제거)
  if (phone) {
    const rawDigits = phone.replace(/[^0-9]/g, "");
    const formatted =
      rawDigits.length === 11
        ? `${rawDigits.slice(0, 3)}-${rawDigits.slice(3, 7)}-${rawDigits.slice(7)}`
        : phone;

    const res = await db.execute({
      sql: `SELECT * FROM customers WHERE phone = ? OR REPLACE(phone, '-', '') = ? LIMIT 1`,
      args: [formatted, rawDigits],
    });

    if (res.rows.length > 0) {
      const row = res.rows[0];
      const customerId = Number(row.id);

      // 과거 가장 최근 주문 조회
      const orderRes = await db.execute({
        sql: `
          SELECT o.id, o.order_no, o.order_date, o.shipping_date, o.shipping_address,
                 GROUP_CONCAT(oi.product_name || ' ' || oi.quantity || '개', ', ') as items_summary
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.customer_id = ?
          GROUP BY o.id
          ORDER BY o.order_date DESC
          LIMIT 1
        `,
        args: [customerId],
      });

      let lastOrder: MatchedCustomer["last_order"] = undefined;
      if (orderRes.rows.length > 0) {
        const o = orderRes.rows[0];
        lastOrder = {
          id: Number(o.id),
          order_no: String(o.order_no),
          order_date: String(o.order_date),
          shipping_date: String(o.shipping_date),
          items_summary: String(o.items_summary || ""),
          shipping_address: String(o.shipping_address || ""),
        };
      }

      return {
        id: customerId,
        name: String(row.name),
        phone: String(row.phone),
        address: String(row.address || ""),
        address_detail: row.address_detail ? String(row.address_detail) : undefined,
        memo: row.memo ? String(row.memo) : undefined,
        match_type: "PHONE_EXACT",
        score: 1.0,
        last_order: lastOrder,
      };
    }
  }

  // 2. 이름 + 주소 키워드로 검색
  if (name && address) {
    const res = await db.execute({
      sql: `SELECT * FROM customers WHERE name = ? LIMIT 5`,
      args: [name],
    });

    for (const row of res.rows) {
      const custAddr = String(row.address || "");
      // 주소에 구/동/로 등의 주요 단어가 포함되는지 확인
      const addrWords = address.split(" ").filter((w) => w.length >= 2);
      const matchWordCount = addrWords.filter((w) => custAddr.includes(w)).length;

      if (matchWordCount >= 2) {
        const customerId = Number(row.id);
        return {
          id: customerId,
          name: String(row.name),
          phone: String(row.phone),
          address: custAddr,
          address_detail: row.address_detail ? String(row.address_detail) : undefined,
          memo: row.memo ? String(row.memo) : undefined,
          match_type: "NAME_ADDRESS",
          score: 0.8,
        };
      }
    }
  }

  return null;
}
