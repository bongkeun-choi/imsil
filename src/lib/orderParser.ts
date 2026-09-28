/**
 * 절임배추 문자 주문 파서 (Korean SMS Order Parser)
 * 
 * 자유 형식의 한국어 문자/사진 캡처 텍스트에서 주문 정보를 정규화 추출합니다.
 * - 단일 배송 및 1인 다처 다중 배송지 자동 인식
 * - 주문 고객과 받는 분(수령인/선물) 분리 자동 인식
 */

export interface ParsedItem {
  product_name: string;
  weight_kg: number; // 10 or 20
  quantity: number;
}

export interface ParsedDestination {
  alias?: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_phone2?: string;
  address: string;
  address_detail?: string;
  shipping_date?: string;
  quantity: number;
  memo?: string;
}

export interface ParsedOrderResult {
  customer_name?: string;
  customer_phone?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_phone2?: string;
  is_different_recipient?: boolean;
  shipping_address?: string;
  shipping_address_detail?: string;
  shipping_date?: string; // YYYY-MM-DD
  items: ParsedItem[];
  destinations?: ParsedDestination[];
  is_multi_dest?: boolean;
  memo?: string;
  is_like_last_year: boolean; // "작년처럼" 감지 여부
  has_payment_mention: boolean; // "입금완료", "보냈습니다" 감지 여부
  confidence: {
    customer_name: number; // 0 ~ 1.0
    customer_phone: number;
    shipping_address: number;
    shipping_date: number;
    items: number;
  };
  raw_text: string;
}

// 한글 수량 매핑
const KOREAN_NUMBER_MAP: Record<string, number> = {
  한: 1, 하나: 1, 일: 1, 
  두: 2, 둘: 2, 이: 2, 
  세: 3, 셋: 3, 삼: 3, 
  네: 4, 넷: 4, 사: 4, 
  다섯: 5, 오: 5, 
  여섯: 6, 육: 6, 
  일곱: 7, 칠: 7, 
  여덟: 8, 팔: 8, 
  아홉: 9, 구: 9, 
  열: 10, 십: 10,
};

// 이름으로 오인하기 쉬운 불용어 목록
const FORBIDDEN_EXACT_NAMES = new Set([
  "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉", "열",
  "한개", "두개", "세개", "네개", "한박스", "두박스", "세박스",
  "배추", "절임", "박스", "키로", "상자", "포대", "입금", "송금", "택배", "주문",
  "사장", "사장님", "안녕", "감사", "얼마", "가격", "계좌", "농협", "주소", "배송",
  "출고", "도착", "연락", "전화", "문자", "문의", "부탁", "확인", "작년", "올해",
  "오늘", "내일", "보내", "포함", "부탁합니다", "보내주세요", "감사합니다",
  "첫째", "둘째", "셋째", "첫번째", "두번째", "세번째", "배송지", "받는분", "주문자"
]);

function cleanKoreanName(raw: string): string {
  if (!raw) return "";
  let name = raw.trim();
  // 어미 및 조사 정리 (최봉근입니 -> 최봉근, 홍길동입니다 -> 홍길동)
  name = name.replace(/(?:입니다|이구요|이고요|입니|올림|드림|요|님|씨)$/, "").trim();
  // 호칭 제거 (딸 홍수진 -> 홍수진, 아들 홍철수 -> 홍철수)
  name = name.replace(/^(?:딸|아들|어머님|어머니|아버님|아버지|친정|시댁|이모|고모|삼촌)\s*/, "").trim();
  return name;
}

function isForbiddenName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 5) return true;
  if (FORBIDDEN_EXACT_NAMES.has(name)) return true;
  // 행정구역(서울시, 전주시, 완산구, 임실군, 경기도 등)으로 끝나는 단어 방지
  if (/[시군구도]$/.test(name) && !/^(?:홍길|김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|류|전|홍|고|문|양|손|배|조|백|허|유|남|심|노|정|하|곽|성|차|주|우|구|신|임|나|전|민|유|진|지|엄|채|원|천|방|공|강|현|함|변|염|양|변|여|추|노|도|소|신|석|선|설|마|길|연|위|표|명|기|반|라|왕|금|옥|육|인|맹|제|모|탁|국|어|은|편)/.test(name)) {
    return true;
  }
  // 서울, 경기, 전북 등 시/도 2글자 방지
  if (/^(?:서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|제주|세종|대전|대구|부산|울산|광주)$/.test(name)) {
    return true;
  }
  return false;
}

/**
 * 텍스트에서 단일 전화번호 추출
 */
function extractFirstPhone(text: string): string | undefined {
  const phoneMatch = text.match(/(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{3,4})/);
  if (phoneMatch) {
    return `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`;
  }
  const telMatch = text.match(/(0[2-6][1-5]?)[-.\s]?(\d{3,4})[-.\s]?(\d{4})/);
  if (telMatch) {
    return `${telMatch[1]}-${telMatch[2]}-${telMatch[3]}`;
  }
  return undefined;
}

/**
 * 텍스트에서 날짜 추출 (YYYY-MM-DD)
 */
function extractShippingDate(text: string): string | undefined {
  const currentYear = new Date().getFullYear();
  const textWithoutPhone = text.replace(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, " ");
  const explicitDateMatch = textWithoutPhone.match(/(?:(\d{4})[년.-]\s*)?([01]?\d)[월/.]\s*([0-3]?\d)일?/);
  if (explicitDateMatch) {
    const year = explicitDateMatch[1] ? parseInt(explicitDateMatch[1]) : currentYear;
    const month = parseInt(explicitDateMatch[2]);
    const day = parseInt(explicitDateMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return undefined;
}

/**
 * 텍스트에서 주소 추출
 */
function extractAddress(text: string): { address?: string; address_detail?: string } {
  const addrMatch = text.match(
    /((?:서울(?:특별시)?|경기(?:도)?|인천(?:광역시)?|강원(?:도|특별자치도)?|충(?:청)?(?:북|남)(?:도)?|전(?:라)?(?:북|남)(?:도|특별자치도)?|경(?:상)?(?:북|남)(?:도)?|제주(?:특별자치도)?|세종(?:특별자치시)?|대전(?:광역시)?|대구(?:광역시)?|부산(?:광역시)?|울산(?:광역시)?|광주(?:광역시)?|[가-힣]{2,5}[시군구])\s+[가-힣0-9\s-]+(?:로|길|동|읍|면|리).+)/
  );

  if (!addrMatch) return {};

  let candidate = addrMatch[1].trim();

  // 주소 뒤에 이어지는 수량단위, 전화번호, 이름 등 잘라내기
  const stopRegex = /(?:(?:으로|에|로)\s*)?(?:\d+\s*(?:kg|KG|키로|킬로|박스|개|상자|포대)|배추|절임|키로|kg|박스|개|상자|포대|보내|얼마|입금|송금|택배|01[016789]|전화|연락|주문|부탁|입니다|이구요|받는분|수령인)/i;
  const stopPos = candidate.search(stopRegex);
  if (stopPos > 5) {
    candidate = candidate.substring(0, stopPos).trim();
  }

  candidate = candidate.replace(/(?:으로|로|에)$/, "").trim();
  candidate = candidate.replace(/(\d+)\s*-\s*(\d+)/g, "$1-$2");
  candidate = candidate.replace(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, "").trim();

  if (candidate.length < 5) return {};

  // 동/호수 분리 (예: "잠실동 101동 202호" -> 주소: "잠실동", 상세: "101동 202호")
  const aptMatch = candidate.match(/(.*(?:로\s*\d+|길\s*\d+|동\s*\d+(?:-\d+)?|리\s*\d+(?:-\d+)?))\s+((?:[가-힣0-9\s-]+(?:동|호|층|호실|아파트|빌라|마을|단지)).*)/);
  if (aptMatch) {
    return {
      address: aptMatch[1].trim(),
      address_detail: aptMatch[2].trim(),
    };
  }

  return { address: candidate };
}

/**
 * 텍스트에서 박스 수량 추출 (기본 1박스)
 */
function extractQuantity(text: string): number {
  const qtyNumMatch = text.match(/(\d+)\s*(?:박스|개|통|상자|포대)/);
  if (qtyNumMatch) {
    return parseInt(qtyNumMatch[1]);
  }
  const qtyKorMatch = text.match(/([한두세네다섯여섯일곱여덟아홉열]|하나|둘|셋|넷)\s*(?:박스|개|통|상자|포대)/);
  if (qtyKorMatch && KOREAN_NUMBER_MAP[qtyKorMatch[1]]) {
    return KOREAN_NUMBER_MAP[qtyKorMatch[1]];
  }
  return 1;
}

/**
 * 텍스트에서 이름 추출
 */
function extractName(text: string): string | undefined {
  // 1. 명시적 수령인/이름 레이블
  const explicitMatch = text.match(/(?:받는\s*(?:분|사람|이)|수령인|이름|성함|성명)\s*[:：]?\s*([가-힣]{2,6})/);
  if (explicitMatch) {
    const cleaned = cleanKoreanName(explicitMatch[1]);
    if (!isForbiddenName(cleaned)) return cleaned;
  }

  // 2. 전화번호 뒤 이름
  const phoneAfter = text.match(/(?:01[016789][-.\s]?\d{3,4}[-.\s]?\d{3,4})\s*[:：]?\s*([가-힣]{2,6})/);
  if (phoneAfter) {
    const cleaned = cleanKoreanName(phoneAfter[1]);
    if (!isForbiddenName(cleaned)) return cleaned;
  }

  // 3. 전화번호 앞 이름
  const phoneBefore = text.match(/([가-힣]{2,6})\s*[:：]?\s*(?:01[016789][-.\s]?\d{3,4}[-.\s]?\d{3,4})/);
  if (phoneBefore) {
    const cleaned = cleanKoreanName(phoneBefore[1]);
    if (!isForbiddenName(cleaned)) return cleaned;
  }

  return undefined;
}

export function parseOrderText(rawText: string): ParsedOrderResult {
  const text = rawText.trim();
  const defaultDate = extractShippingDate(text);

  // 1. "작년처럼" 감지
  const isLikeLastYear = /작년처럼|작년과\s*동일|작년과\s*같이|작년\s*주문|주소\s*그대로|작년\s*그대로/i.test(text);

  // 2. 입금 언급 감지
  const hasPaymentMention = /입금\s*(완료|했|보냈|드렸)|송금|이체/i.test(text);

  // ──────────────────────────────────────────────
  // [A] 다중 배송지 패턴 검사 (1인 다처 분할 발송)
  // ──────────────────────────────────────────────
  // 1) 번호 매김 블록 감지: 1. 2. 또는 ① ② 또는 [1] [2] 또는 1) 2)
  const numberedSplitRegex = /(?:^|\n)\s*(?:[1-9]\s*[.)\]]|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|\[\s*배송지\s*[1-9]\s*\]|\[\s*[1-9]\s*\]|첫번째|두번째|세번째)\s*/;
  const isNumbered = numberedSplitRegex.test(text);

  // 2) 주소 패턴 복수 검사: 주소 시작 행정구역이 2개 이상 독립 위치에 나타나는지 확인
  const addrProvinceRegex = /(?:서울(?:특별시)?|경기(?:도)?|인천(?:광역시)?|강원(?:도|특별자치도)?|충(?:청)?(?:북|남)(?:도)?|전(?:라)?(?:북|남)(?:도|특별자치도)?|경(?:상)?(?:북|남)(?:도)?|제주(?:특별자치도)?|세종(?:특별자치시)?|대전(?:광역시)?|대구(?:광역시)?|부산(?:광역시)?|울산(?:광역시)?|광주(?:광역시)?|[가-힣]{2,5}[시군구])\s+[가-힣0-9\s-]+(?:로|길|동|읍|면|리)/g;
  const matchedAddresses = text.match(addrProvinceRegex) || [];

  if (isNumbered || matchedAddresses.length >= 2) {
    // 다중 배송 블록으로 분할 시도
    let rawBlocks: string[] = [];

    if (isNumbered) {
      // 번호 매김 기준으로 텍스트 분할
      const parts = text.split(/(?:^|\n)\s*(?:[1-9]\s*[.)\]]|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|\[\s*배송지\s*[1-9]\s*\]|\[\s*[1-9]\s*\]|첫번째|두번째|세번째)\s*/);
      // parts[0]은 주문자 헤더 영역일 수 있음
      rawBlocks = parts.slice(1);
    } else if (matchedAddresses.length >= 2) {
      // 주소 등장 위치 기준으로 청크 분할
      const lines = text.split(/\r?\n/);
      let currentChunk = "";
      for (const line of lines) {
        if (addrProvinceRegex.test(line) && currentChunk.trim()) {
          rawBlocks.push(currentChunk.trim());
          currentChunk = line + "\n";
        } else {
          currentChunk += line + "\n";
        }
      }
      if (currentChunk.trim()) {
        rawBlocks.push(currentChunk.trim());
      }
    }

    if (rawBlocks.length >= 2) {
      // 주문자 정보 추출 (전체 문두 또는 명시적 주문자/보내는분 태그)
      let customerName: string | undefined = undefined;
      let customerPhone: string | undefined = undefined;

      const ordererMatch = text.match(/(?:주문자|보내는\s*(?:분|사람)|입금자)\s*[:：]?\s*([가-힣]{2,6})/);
      if (ordererMatch && !isForbiddenName(ordererMatch[1])) {
        customerName = cleanKoreanName(ordererMatch[1]);
      }

      const ordererPhoneMatch = text.match(/(?:주문자|보내는\s*(?:분|사람)|입금자)[^0-9]*?(01[016789][-.\s]?\d{3,4}[-.\s]?\d{3,4})/);
      if (ordererPhoneMatch) {
        customerPhone = ordererPhoneMatch[1].replace(/\s+/g, "-");
      }

      // 만약 주문자 정보가 명시되지 않았다면 첫 번째 전화번호 및 첫 번째 발견 이름을 주문자로 채택
      if (!customerPhone) {
        customerPhone = extractFirstPhone(text);
      }
      if (!customerName) {
        customerName = extractName(text);
      }

      const destinations: ParsedDestination[] = [];

      for (let i = 0; i < rawBlocks.length; i++) {
        const blk = rawBlocks[i];
        const addrRes = extractAddress(blk);
        const recipientPhone = extractFirstPhone(blk) || customerPhone || "";
        const recipientName = extractName(blk) || `받는분 ${i + 1}`;
        const qty = extractQuantity(blk);
        const shippingDate = extractShippingDate(blk) || defaultDate || new Date().toISOString().slice(0, 10);

        // 별칭 추출 (예: 서울 딸네, 부산 아들네, 시댁, 친정 등)
        let alias = `배송지 ${i + 1}`;
        const aliasMatch = blk.match(/([가-힣\s]{2,10}(?:딸네|아들네|시댁|친정|자택|본가|처가|댁|집))/);
        if (aliasMatch) {
          alias = aliasMatch[1].trim();
        }

        destinations.push({
          alias,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          address: addrRes.address || "",
          address_detail: addrRes.address_detail || "",
          quantity: qty,
          shipping_date: shippingDate,
          memo: blk.trim(),
        });
      }

      const totalBoxes = destinations.reduce((sum, d) => sum + d.quantity, 0);

      return {
        customer_name: customerName || destinations[0]?.recipient_name,
        customer_phone: customerPhone || destinations[0]?.recipient_phone,
        destinations,
        is_multi_dest: true,
        items: [{ product_name: "절임배추 20kg", weight_kg: 20, quantity: totalBoxes }],
        memo: text,
        is_like_last_year: isLikeLastYear,
        has_payment_mention: hasPaymentMention,
        confidence: {
          customer_name: 0.9,
          customer_phone: 0.9,
          shipping_address: 0.9,
          shipping_date: 0.9,
          items: 0.9,
        },
        raw_text: text,
      };
    }
  }

  // ──────────────────────────────────────────────
  // [B] 단일 배송지 패턴 (수령인 분리 및 일반 주문)
  // ──────────────────────────────────────────────
  let customerName: string | undefined = undefined;
  let customerPhone: string | undefined = undefined;
  let recipientName: string | undefined = undefined;
  let recipientPhone: string | undefined = undefined;
  let isDifferentRecipient = false;

  // 1) 명시적 주문자 vs 받는사람 분리 추출
  const explicitOrderer = text.match(/(?:주문자|보내는\s*(?:분|사람)|입금자)\s*[:：]?\s*([가-힣]{2,6})/);
  const explicitRecipient = text.match(/(?:받는\s*(?:분|사람|이)|수령인)\s*[:：]?\s*([가-힣]{2,6})/);

  if (explicitOrderer && !isForbiddenName(explicitOrderer[1])) {
    customerName = cleanKoreanName(explicitOrderer[1]);
  }
  if (explicitRecipient && !isForbiddenName(explicitRecipient[1])) {
    recipientName = cleanKoreanName(explicitRecipient[1]);
  }

  // 주문자와 받는사람 각각의 전화번호 추출 시도
  const allPhones = Array.from(text.matchAll(/(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{3,4})/g)).map(
    (m) => `${m[1]}-${m[2]}-${m[3]}`
  );

  if (allPhones.length >= 2) {
    // 2개의 전화번호가 있으면 앞쪽을 주문자, 뒤쪽을 수령인(또는 받는분 키워드 기준)으로 분리
    customerPhone = allPhones[0];
    recipientPhone = allPhones[1];
  } else if (allPhones.length === 1) {
    customerPhone = allPhones[0];
    recipientPhone = allPhones[0];
  }

  // 수령인과 주문자가 서로 다른 경우 플래그 활성화
  if (recipientName && customerName && recipientName !== customerName) {
    isDifferentRecipient = true;
  } else if (explicitRecipient && (!customerName || customerName !== recipientName)) {
    isDifferentRecipient = true;
  }

  // 일반 이름 fallback
  if (!customerName && !recipientName) {
    const singleName = extractName(text);
    customerName = singleName;
    recipientName = singleName;
  } else if (!customerName && recipientName) {
    customerName = recipientName;
  } else if (customerName && !recipientName) {
    recipientName = customerName;
  }

  // 주소 추출
  const addrRes = extractAddress(text);
  const qty = extractQuantity(text);

  return {
    customer_name: customerName,
    customer_phone: customerPhone,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    is_different_recipient: isDifferentRecipient,
    shipping_address: addrRes.address,
    shipping_address_detail: addrRes.address_detail,
    shipping_date: defaultDate,
    items: [{ product_name: "절임배추 20kg", weight_kg: 20, quantity: qty }],
    is_multi_dest: false,
    memo: text,
    is_like_last_year: isLikeLastYear,
    has_payment_mention: hasPaymentMention,
    confidence: {
      customer_name: 0.9,
      customer_phone: customerPhone ? 1.0 : 0.5,
      shipping_address: addrRes.address ? 0.9 : 0.5,
      shipping_date: defaultDate ? 0.95 : 0.5,
      items: 0.9,
    },
    raw_text: text,
  };
}
