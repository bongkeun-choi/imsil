/**
 * 절임배추 문자 주문 파서 (Korean SMS Order Parser)
 * 
 * 자유 형식의 한국어 문자 캡처 텍스트에서 주문 정보를 정규화 추출합니다.
 */

export interface ParsedItem {
  product_name: string;
  weight_kg: number; // 10 or 20
  quantity: number;
}

export interface ParsedOrderResult {
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: string;
  shipping_date?: string; // YYYY-MM-DD
  items: ParsedItem[];
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

// 이름으로 오인하기 쉬운 불용어 목록 (단어 단위 정확 일치)
const FORBIDDEN_EXACT_NAMES = new Set([
  "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉", "열",
  "한개", "두개", "세개", "네개", "한박스", "두박스", "세박스",
  "배추", "절임", "박스", "키로", "상자", "포대", "입금", "송금", "택배", "주문",
  "사장", "사장님", "안녕", "감사", "얼마", "가격", "계좌", "농협", "주소", "배송",
  "출고", "도착", "연락", "전화", "문자", "문의", "부탁", "확인", "작년", "올해",
  "오늘", "내일", "보내", "포함", "부탁합니다", "보내주세요", "감사합니다"
]);

function cleanKoreanName(raw: string): string {
  if (!raw) return "";
  let name = raw.trim();
  // 어미 및 조사 정리 (최봉근입니 -> 최봉근, 홍길동입니다 -> 홍길동)
  name = name.replace(/(?:입니다|이구요|이고요|입니|올림|드림|요|님|씨)$/, "").trim();
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

export function parseOrderText(rawText: string): ParsedOrderResult {
  const text = rawText.trim();
  const currentYear = new Date().getFullYear();

  let customerName: string | undefined = undefined;
  let customerPhone: string | undefined = undefined;
  let shippingAddress: string | undefined = undefined;
  let shippingDate: string | undefined = undefined;
  const items: ParsedItem[] = [];

  let nameConf = 0.5;
  let phoneConf = 0.5;
  let addrConf = 0.5;
  let dateConf = 0.5;
  let itemConf = 0.5;

  // 1. "작년처럼", "작년과 동일" 감지
  const isLikeLastYear = /작년처럼|작년과\s*동일|작년과\s*같이|작년\s*주문|주소\s*그대로|작년\s*그대로/i.test(text);

  // 2. 입금 언급 감지
  const hasPaymentMention = /입금\s*(완료|했|보냈|드렸)|송금|이체/i.test(text);

  // 3. 전화번호 추출 (010-1234-5678, 010 1234 5678, 01012345678, 010-6615-776 등)
  const phoneMatch = text.match(/(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{3,4})/);
  if (phoneMatch) {
    customerPhone = `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`;
    phoneConf = 1.0;
  } else {
    // 유선 지역번호 패턴
    const telMatch = text.match(/(0[2-6][1-5]?)[-.\s]?(\d{3,4})[-.\s]?(\d{4})/);
    if (telMatch) {
      customerPhone = `${telMatch[1]}-${telMatch[2]}-${telMatch[3]}`;
      phoneConf = 0.9;
    }
  }

  // 4. 출고 희망일 추출 (전화번호 마스킹 후 날짜 검색하여 오인 방지)
  const textWithoutPhone = text.replace(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, " ");

  // 패턴: 11월 15일, 11/15, 11.15 등
  const explicitDateMatch = textWithoutPhone.match(/(?:(\d{4})[년.-]\s*)?([01]?\d)[월/.]\s*([0-3]?\d)일?/);
  if (explicitDateMatch) {
    const year = explicitDateMatch[1] ? parseInt(explicitDateMatch[1]) : currentYear;
    const month = parseInt(explicitDateMatch[2]);
    const day = parseInt(explicitDateMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      shippingDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      dateConf = 0.95;
    }
  }

  // 5. 상품 및 수량 추출 (10kg, 20kg, 박스/개수)
  const weightMatches: { weight: number; index: number }[] = [];
  const w10Regex = /(?:10\s*(?:kg|KG|키로|킬로)|십\s*(?:키로|킬로))/g;
  const w20Regex = /(?:20\s*(?:kg|KG|키로|킬로)|이십\s*(?:키로|킬로))/g;

  let m10: RegExpExecArray | null;
  while ((m10 = w10Regex.exec(text)) !== null) {
    weightMatches.push({ weight: 10, index: m10.index });
  }
  let m20: RegExpExecArray | null;
  while ((m20 = w20Regex.exec(text)) !== null) {
    weightMatches.push({ weight: 20, index: m20.index });
  }

  weightMatches.sort((a, b) => a.index - b.index);

  if (weightMatches.length > 0) {
    for (const wm of weightMatches) {
      const start = Math.max(0, wm.index - 20);
      const end = Math.min(text.length, wm.index + 30);
      const windowText = text.substring(start, end);

      let qty = 1;
      const qtyNumMatch = windowText.match(/(\d+)\s*(?:박스|개|통|상자|포대)/);
      if (qtyNumMatch) {
        qty = parseInt(qtyNumMatch[1]);
      } else {
        const qtyKorMatch = windowText.match(/([한두세네다섯여섯일곱여덟아홉열]|하나|둘|셋|넷)\s*(?:박스|개|통|상자|포대)/);
        if (qtyKorMatch && KOREAN_NUMBER_MAP[qtyKorMatch[1]]) {
          qty = KOREAN_NUMBER_MAP[qtyKorMatch[1]];
        }
      }

      const existing = items.find((i) => i.weight_kg === wm.weight);
      if (existing) {
        existing.quantity += qty;
      } else {
        items.push({
          product_name: `절임배추 ${wm.weight}kg`,
          weight_kg: wm.weight,
          quantity: qty,
        });
      }
    }
    itemConf = 0.9;
  } else {
    // 중량 언급이 명확하지 않지만 "절임배추 2박스"처럼 있는 경우 기본 20kg 지정
    const genericQtyMatch = text.match(/(?:절임배추|배추)?\s*(\d+|[한두세네다섯])\s*(?:박스|개|상자)/);
    if (genericQtyMatch) {
      let qty = 1;
      if (/^\d+$/.test(genericQtyMatch[1])) {
        qty = parseInt(genericQtyMatch[1]);
      } else if (KOREAN_NUMBER_MAP[genericQtyMatch[1]]) {
        qty = KOREAN_NUMBER_MAP[genericQtyMatch[1]];
      }
      items.push({
        product_name: "절임배추 20kg",
        weight_kg: 20,
        quantity: qty,
      });
      itemConf = 0.6;
    }
  }

  // 6. 주소 추출 (도로명 / 지번 패턴 및 주문 본문 잘라내기)
  const addrMatch = text.match(
    /((?:서울(?:특별시)?|경기(?:도)?|인천(?:광역시)?|강원(?:도|특별자치도)?|충(?:청)?(?:북|남)(?:도)?|전(?:라)?(?:북|남)(?:도|특별자치도)?|경(?:상)?(?:북|남)(?:도)?|제주(?:특별자치도)?|세종(?:특별자치시)?|대전(?:광역시)?|대구(?:광역시)?|부산(?:광역시)?|울산(?:광역시)?|광주(?:광역시)?|[가-힣]{2,5}[시군구])\s+[가-힣0-9\s-]+(?:로|길|동|읍|면|리).+)/
  );

  if (addrMatch) {
    let candidate = addrMatch[1].trim();

    // 주소 뒤에 이어지는 수량단위(10키로, 20kg, 2박스 등), 주문 내용 및 전화번호/인사말 분리 잘라내기
    const stopRegex = /(?:(?:으로|에|로)\s*)?(?:\d+\s*(?:kg|KG|키로|킬로|박스|개|상자|포대)|배추|절임|키로|kg|박스|개|상자|포대|보내|얼마|입금|송금|택배|01[016789]|전화|연락|주문|부탁|입니다|이구요)/i;
    const stopPos = candidate.search(stopRegex);
    if (stopPos > 5) {
      candidate = candidate.substring(0, stopPos).trim();
    }

    // 조사(으로, 로, 에)가 끝에 남아있다면 제거
    candidate = candidate.replace(/(?:으로|로|에)$/, "").trim();

    // 주소 내 번지수 하이픈 공백 정리: "303 - 3" -> "303-3"
    candidate = candidate.replace(/(\d+)\s*-\s*(\d+)/g, "$1-$2");

    // 전화번호 형태가 남아있다면 제거
    candidate = candidate.replace(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, "").trim();

    if (candidate.length >= 6) {
      shippingAddress = candidate;
      addrConf = 0.9;
    }
  }

  // 7. 고객명 추출 (다양한 한국어 문자 패턴 대응)
  // 우선순위 1: 명시적 레이블 ("받는분: 최봉근", "주문자: 최봉근", "성함 최봉근")
  const explicitNameMatch = text.match(/(?:받는\s*(?:분|사람|이)|주문자|입금자|보내는\s*(?:분|사람)|이름|성함|고객명)\s*[:：]?\s*([가-힣]{2,6})/);
  if (explicitNameMatch) {
    const cleaned = cleanKoreanName(explicitNameMatch[1]);
    if (!isForbiddenName(cleaned)) {
      customerName = cleaned;
      nameConf = 0.95;
    }
  }

  // 우선순위 2: 전화번호 앞/뒤에 위치한 이름
  // 2-A: 전화번호 앞에 이름이 있는 경우 (예: "홍길동 010-1234-5678" 또는 "최봉근입니다 010-...")
  if (!customerName) {
    const phoneBeforeNameMatch = text.match(/([가-힣]{2,6})\s*[:：]?\s*(?:01[016789][-.\s]?\d{3,4}[-.\s]?\d{3,4})/);
    if (phoneBeforeNameMatch) {
      const cleaned = cleanKoreanName(phoneBeforeNameMatch[1]);
      if (!isForbiddenName(cleaned)) {
        customerName = cleaned;
        nameConf = 0.95;
      }
    }
  }

  // 2-B: 전화번호 뒤에 이름이 있는 경우 (예: "010-6615-776 최봉근입니..." 또는 "010-1234-5678 홍길동")
  if (!customerName) {
    const phoneAfterNameMatch = text.match(/(?:01[016789][-.\s]?\d{3,4}[-.\s]?\d{3,4})\s*[:：]?\s*([가-힣]{2,6})/);
    if (phoneAfterNameMatch) {
      const cleaned = cleanKoreanName(phoneAfterNameMatch[1]);
      if (!isForbiddenName(cleaned)) {
        customerName = cleaned;
        nameConf = 0.95;
      }
    }
  }

  // 우선순위 3: 문장 끝자락에 나오는 "~입니다 / ~입니 / ~올림 / ~드림" 형태
  // 예: "최봉근입니다", "최봉근입니"
  if (!customerName) {
    const endingNameMatch = text.match(/(?:^|[^\w가-힣])([가-힣]{2,6})(?:입니다|입니|올림|드림)/);
    if (endingNameMatch) {
      const cleaned = cleanKoreanName(endingNameMatch[1]);
      if (!isForbiddenName(cleaned)) {
        customerName = cleaned;
        nameConf = 0.88;
      }
    }
  }

  // 우선순위 4: 줄 단위 단독 2~4글자 이름
  if (!customerName) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = cleanKoreanName(line.trim());
      if (/^[가-힣]{2,4}$/.test(trimmed) && !isForbiddenName(trimmed)) {
        customerName = trimmed;
        nameConf = 0.8;
        break;
      }
    }
  }

  return {
    customer_name: customerName,
    customer_phone: customerPhone,
    shipping_address: shippingAddress,
    shipping_date: shippingDate,
    items: items.length > 0 ? items : [{ product_name: "절임배추 20kg", weight_kg: 20, quantity: 1 }],
    memo: text,
    is_like_last_year: isLikeLastYear,
    has_payment_mention: hasPaymentMention,
    confidence: {
      customer_name: nameConf,
      customer_phone: phoneConf,
      shipping_address: addrConf,
      shipping_date: dateConf,
      items: itemConf,
    },
    raw_text: text,
  };
}
