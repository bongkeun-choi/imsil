/**
 * 카톡 / 문자 발송 문구 생성 및 템플릿 관리 유틸리티
 */

export interface ExtraPhone {
  id: string;
  label: string; // 예: "배송문의", "농장직통", "사모님", "관리자"
  phone: string; // 예: "010-1234-5678"
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
  shopPhone: string; // 대표 연락처
  extraPhones?: ExtraPhone[]; // 추가 연락처 목록
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
• 대표전화: {대표전화}
{추가연락처}
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
  { tag: "{입금계좌}", description: "은행명 + 계좌번호 + 예금주 한 줄", example: "[농협] 351-0000-0000-00 (예금주: 홍길동)" },
  { tag: "{은행명}", description: "입금 은행명", example: "농협" },
  { tag: "{계좌번호}", description: "입금 계좌번호", example: "351-0000-0000-00" },
  { tag: "{예금주}", description: "계좌 예금주", example: "대표자" },
  { tag: "{농가명}", description: "농가/상호명", example: "임실참배추농원" },
  { tag: "{대표전화}", description: "실제 대표 연락처", example: "010-8452-9988" },
  { tag: "{추가연락처}", description: "추가 연락처 목록 (있을 시)", example: "• 배송문의: 010-1234-5678" },
  { tag: "{연락처목록}", description: "대표전화 및 추가연락처 전체", example: "• 대표전화: 010-8452-9988\n• 배송문의: 010-1234-5678" },
];

/**
 * 추가 연락처 JSON 파싱 헬퍼
 */
export function parseExtraPhones(raw: any): ExtraPhone[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((p) => p && typeof p === "object" && p.phone);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p) => p && typeof p === "object" && p.phone);
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
  const shopName = data.shopName || "임실참배추농원";
  const shopPhone = data.shopPhone || "010-0000-0000";
  const bankName = data.bankName || "농협";
  const bankAccount = data.bankAccount || "";
  const ownerName = data.ownerName || "";

  // 추가 연락처 포맷팅
  const extraPhones = data.extraPhones || [];
  const extraPhonesText = extraPhones
    .map((p) => `• ${p.label || "추가연락처"}: ${p.phone}`)
    .join("\n");

  const allContactsText = [
    `• 대표전화: ${shopPhone}`,
    ...extraPhones.map((p) => `• ${p.label || "추가연락처"}: ${p.phone}`),
  ].join("\n");

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
    대표전화: shopPhone,
    추가연락처: extraPhonesText ? extraPhonesText + "\n" : "",
    연락처목록: allContactsText,
  };

  // 모든 치환 변수 적용
  for (const [key, val] of Object.entries(replaceMap)) {
    const braceRegex = new RegExp(`\\{${key}\\}`, "g");
    const bracketRegex = new RegExp(`\\[${key}\\]`, "g");
    template = template.replace(braceRegex, val);
    // [농가명] 같은 경우 기본 템플릿의 "[{농가명} 주문 접수 안내]" 등과 겹칠 수 있으므로 정밀 치환
    if (key !== "농가명") {
      template = template.replace(bracketRegex, val);
    }
  }

  // 템플릿에 추가연락처가 누락되었으나 실제 추가연락처가 등록되어 있는 경우
  // 대표전화 다음 줄에 자동으로 추가연락처 추가
  if (
    extraPhonesText &&
    !template.includes(extraPhones[0].phone) &&
    template.includes(shopPhone)
  ) {
    template = template.replace(
      shopPhone,
      `${shopPhone}\n${extraPhonesText}`
    );
  }

  return template.trim();
}
