/**
 * 카톡 / 문자 발송 문구 생성 및 템플릿 관리 유틸리티
 */

export interface ExtraPhone {
  id: string;
  phone: string;
  label?: string;
}

export interface OrderShareSourceData {
  orderNo: string;
  customerName: string;
  customerPhone: string;
  shippingDate: string;
  shippingAddress: string;
  shippingAddressDetail?: string;
  itemsSummary: string;
  totalAmount: number;
  paymentStatus: "PAID" | "UNPAID" | string;
  memo?: string;
  shopName: string;
  shopPhone: string; // 기본 대표 연락처
  extraPhones?: ExtraPhone[]; // 추가된 대표 연락처 목록
  bankName: string;
  bankAccount: string;
  ownerName: string;
  trackingNo?: string;
  courierName?: string;
}

export const DEFAULT_SHARE_MESSAGE_TEMPLATE = `[{농가명} 주문 접수 안내]

안녕하세요, {고객명} 고객님!
청정 임실 절임배추를 주문해 주셔서 진심으로 감사드립니다.

■ 주문 접수 내역
• 주문번호: {주문번호}
• 주문상품: {주문상품}
• 택배 도착 예정일: {도착예정일} (도착 전날 신선 포장 발송)
• 받으실 주소: {수령주소}

■ 결제 및 입금 안내
• 결제금액: {결제금액}원 ({입금상태})
{입금계좌안내}
■ 농가 문의처
• 농가명: {농가명}
• 문의전화: {대표전화}

신선하고 깨끗한 절임배추로 엄선하여 안전하게 배송해 드리겠습니다. 감사합니다!`;

export interface TemplateVariableInfo {
  tag: string;
  description: string;
  example: string;
}

export const AVAILABLE_TEMPLATE_VARIABLES: TemplateVariableInfo[] = [
  { tag: "{고객명}", description: "고객 이름", example: "홍길동" },
  { tag: "{주문번호}", description: "주문번호", example: "ORD-20261105-001" },
  { tag: "{주문상품}", description: "주문 상품명 및 수량", example: "절임배추 20kg 2박스" },
  { tag: "{도착예정일}", description: "택배 수령 예정일", example: "2026-11-20" },
  { tag: "{수령주소}", description: "배송지 주소", example: "전북 임실군 임실읍 봉황로 123" },
  { tag: "{결제금액}", description: "총 결제금액 (원)", example: "136,000" },
  { tag: "{입금상태}", description: "입금 확인 완료 / 입금 대기중", example: "입금 대기중" },
  { tag: "{입금계좌안내}", description: "입금상태별 계좌·예금주 안내 블록", example: "• 입금계좌: [농협] 351-0000...\n• 예금주: OOO" },
  { tag: "{입금계좌}", description: "은행명 + 계좌번호 + 예금주 한 줄", example: "[농협] 351-0000-0000-00 (예금주: 백양임)" },
  { tag: "{은행명}", description: "입금 은행명", example: "농협" },
  { tag: "{계좌번호}", description: "입금 계좌번호", example: "351-0000-0000-00" },
  { tag: "{예금주}", description: "계좌 예금주", example: "백양임" },
  { tag: "{농가명}", description: "농가/상호명", example: "장모님 절임배추" },
  { tag: "{대표전화}", description: "대표 연락처 전체", example: "010-7180-2496, 010-XXXX-XXXX" },
];

/**
 * 추가 대표 연락처 JSON 파싱 헬퍼 (단순 전화번호 목록 지원)
 */
export function parseExtraPhones(raw: any): ExtraPhone[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item, idx) => {
        if (typeof item === "string" && item.trim()) {
          return { id: `phone-${idx}-${item}`, phone: item.trim() };
        }
        if (item && typeof item === "object" && item.phone) {
          return { id: item.id || `phone-${idx}`, phone: String(item.phone).trim() };
        }
        return null;
      })
      .filter((p): p is ExtraPhone => p !== null && p.phone !== "");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parseExtraPhones(parsed);
      }
    } catch (_) {
      return [];
    }
  }
  return [];
}

/**
 * 주문 데이터와 템플릿을 조합하여 최종 문자/카톡 발송 문구를 생성합니다.
 */
export function generateOrderShareMessage(
  data: OrderShareSourceData,
  customTemplate?: string
): string {
  const isPaid = data.paymentStatus === "PAID";
  const formattedAmount = (data.totalAmount || 0).toLocaleString();
  const fullAddress = `${data.shippingAddress || ""} ${data.shippingAddressDetail || ""}`.trim();
  const shopName = data.shopName || "장모님 절임배추";
  const mainPhone = data.shopPhone || "010-7180-2496";
  const bankName = data.bankName || "농협";
  const bankAccount = data.bankAccount || "";
  const ownerName = data.ownerName || "";

  // 등록된 모든 대표 연락처 번호 모음 (기본 번호 + 추가된 대표 번호들)
  const extraPhones = (data.extraPhones || []).filter((p) => p && p.phone && p.phone.trim() !== "");
  const allPhonesList = [mainPhone, ...extraPhones.map((p) => p.phone.trim())].filter(Boolean);
  
  // 대표 연락처 텍스트 (예: 010-7180-2496, 010-1234-5678)
  const allPhonesJoined = allPhonesList.join(", ");

  // 추가 대표 연락처 목록 텍스트 (있을 경우)
  const extraPhonesText = extraPhones.length > 0
    ? extraPhones.map((p, idx) => `• 대표전화 ${idx + 2}: ${p.phone}`).join("\n")
    : "";

  const allContactsText = allPhonesList.length > 1
    ? allPhonesList.map((p, idx) => `• 대표전화 ${idx + 1}: ${p}`).join("\n")
    : `• 대표전화: ${mainPhone}`;

  // 입금 계좌 안내 블록 생성
  let paymentGuideBlock = "";
  if (!isPaid) {
    paymentGuideBlock = `• 입금계좌: [${bankName}] ${bankAccount}\n• 예금주: ${ownerName}\n(※ 주문자명과 입금자명이 다를 경우 꼭 연락 부탁드립니다.)\n`;
  } else {
    paymentGuideBlock = `(입금이 정상 확인되었습니다. 정성껏 준비하겠습니다.)\n`;
  }

  const singleLineAccount = `[${bankName}] ${bankAccount}${ownerName ? ` (예금주: ${ownerName})` : ""}`.trim();

  let template = (customTemplate && customTemplate.trim()) || DEFAULT_SHARE_MESSAGE_TEMPLATE;

  // 치환 매핑 (중괄호 {태그} 및 대괄호 [태그] 모두 지원)
  const replaceMap: Record<string, string> = {
    고객명: data.customerName || "고객",
    주문번호: data.orderNo || "-",
    주문상품: data.itemsSummary || "절임배추 20kg",
    도착예정일: data.shippingDate || "",
    수령주소: fullAddress || "주소 미입력",
    결제금액: formattedAmount,
    입금상태: isPaid ? "입금 확인 완료" : "입금 대기중",
    입금계좌안내: paymentGuideBlock,
    입금계좌: singleLineAccount,
    은행명: bankName,
    계좌번호: bankAccount,
    예금주: ownerName,
    농가명: shopName,
    대표전화: allPhonesJoined,
    추가연락처: extraPhonesText ? extraPhonesText + "\n" : "",
    연락처목록: allContactsText,
  };

  // 모든 치환 변수 적용
  for (const [key, val] of Object.entries(replaceMap)) {
    const braceRegex = new RegExp(`\\{${key}\\}`, "g");
    const bracketRegex = new RegExp(`\\[${key}\\]`, "g");
    template = template.replace(braceRegex, val);
    if (key !== "농가명") {
      template = template.replace(bracketRegex, val);
    }
  }

  return template.trim();
}
