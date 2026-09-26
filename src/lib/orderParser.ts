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

  // 3. 전화번호 추출 (010-1234-5678, 010 1234 5678, 01012345678, 011/016/017/018/019)
  const phoneRegex = /(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g;
  const phoneMatch = phoneRegex.exec(text);
  if (phoneMatch) {
    customerPhone = `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`;
    phoneConf = 1.0;
  }

  // 4. 출고 희망일 추출
  // 패턴 1: 11월 15일, 11/15, 11.15, 12월 3일 등
  const dateMonthDayRegex = /(?:(\d{4})[년.-]\s*)?([01]?\d)[월/.-]\s*([0-3]?\d)일?/g;
  let dateMatch = dateMonthDayRegex.exec(text);
  if (dateMatch) {
    const year = dateMatch[1] ? parseInt(dateMatch[1]) : currentYear;
    const month = parseInt(dateMatch[2]);
    const day = parseInt(dateMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      shippingDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      dateConf = 0.95;
    }
  }

  // 5. 상품 및 수량 추출 (10kg, 20kg, 박스/개수)
  // 10kg 패턴: 10키로, 10킬로, 10kg, 10KG, 십키로
  // 20kg 패턴: 20키로, 20킬로, 20kg, 20KG, 이십키로
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

  // 각 중량 위치 주변에서 수량 탐색 (예: "10키로 2박스", "20kg 한개", "2박스 20키로")
  weightMatches.sort((a, b) => a.index - b.index);

  if (weightMatches.length > 0) {
    for (const wm of weightMatches) {
      // 해당 중량 전후 25글자 범위 탐색
      const start = Math.max(0, wm.index - 20);
      const end = Math.min(text.length, wm.index + 30);
      const windowText = text.substring(start, end);

      let qty = 1;
      // 숫자+박스/개: 2박스, 3개, 1박스
      const qtyNumMatch = windowText.match(/(\d+)\s*(?:박스|개|통|상자|포대)/);
      if (qtyNumMatch) {
        qty = parseInt(qtyNumMatch[1]);
      } else {
        // 한글 수사: 한박스, 두박스, 세개 등
        const qtyKorMatch = windowText.match(/([한두세네다섯여섯일곱여덟아홉열]|하나|둘|셋|넷)\s*(?:박스|개|통|상자|포대)/);
        if (qtyKorMatch && KOREAN_NUMBER_MAP[qtyKorMatch[1]]) {
          qty = KOREAN_NUMBER_MAP[qtyKorMatch[1]];
        }
      }

      // 기존 동일 중량이 있으면 수량 누적
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

  // 6. 주소 추출 (도로명 / 지번 패턴)
  // 도, 시, 군, 구, 읍, 면, 동, 로, 길, 리, 번지, 아파트 등 포함
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    // 주소 키워드 포함 확인
    if (
      /(?:서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|제주|세종|대전|대구|부산|울산|광주|[가-힣]+[시군구])\s+[가-힣0-9\s-]+(?:로|길|동|읍|면|리|번지|아파트|빌라|마을|호)/.test(
        trimmed
      ) ||
      /(?:주소|배송지)\s*[:：]?\s*(.+)/.test(trimmed)
    ) {
      let addrCandidate = trimmed;
      const addrPrefix = trimmed.match(/(?:주소|배송지)\s*[:：]?\s*(.+)/);
      if (addrPrefix) {
        addrCandidate = addrPrefix[1].trim();
      }
      // 주소에서 전화번호 제거
      addrCandidate = addrCandidate.replace(/(01[016789])[-.\s]?\d{3,4}[-.\s]?\d{4}/g, "").trim();
      if (addrCandidate.length >= 7) {
        shippingAddress = addrCandidate;
        addrConf = 0.85;
        break;
      }
    }
  }

  // 줄바꿈 없는 단일 문장에서 주소 추출 폴백
  if (!shippingAddress) {
    const singleLineAddr = text.match(
      /((?:서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|제주|세종|대전|대구|부산|울산|광주|[가-힣]+[시군구])\s+[가-힣0-9\s-]+(?:로|길|동|읍|면|리)\s*[0-9가-힣\s-호동아파트빌라]*)/
    );
    if (singleLineAddr && singleLineAddr[1].trim().length >= 8) {
      shippingAddress = singleLineAddr[1].trim().replace(/(01[016789])[-.\s]?\d{3,4}[-.\s]?\d{4}/g, "").trim();
      addrConf = 0.75;
    }
  }

  // 7. 고객명 추출
  // 명시적 레이블 탐색: "받는분: 홍길동", "이름: 홍길동", "성함 홍길동"
  const explicitNameMatch = text.match(/(?:받는\s*(?:분|사람|이)|이름|성함|고객명)\s*[:：]?\s*([가-힣]{2,5})/);
  if (explicitNameMatch) {
    customerName = explicitNameMatch[1].trim();
    nameConf = 0.95;
  } else {
    // 줄 단위 검사: 전화번호나 주소 앞뒤의 2~4글자 이름 후보
    for (const line of lines) {
      const trimmed = line.trim();
      // 단독으로 2~4글자 한글만 있는 줄
      if (/^[가-힣]{2,4}$/.test(trimmed) && !/배추|절임|박스|입금|택배|주문|사장|감사|안녕/.test(trimmed)) {
        customerName = trimmed;
        nameConf = 0.8;
        break;
      }
      // "홍길동 010-1234-5678" 형태
      const namePhoneMatch = trimmed.match(/^([가-힣]{2,4})\s+(?:01[016789])/);
      if (namePhoneMatch && !/배추|절임|박스|입금/.test(namePhoneMatch[1])) {
        customerName = namePhoneMatch[1];
        nameConf = 0.85;
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
