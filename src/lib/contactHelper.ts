/**
 * 스마트폰 연락처 연동 및 vCard(.vcf) 파서 헬퍼 모듈
 */

export interface ImportedContact {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  memo?: string;
  selected?: boolean;
  isExisting?: boolean;
}

/**
 * 한국 전화번호 포맷팅 함수 (예: +82 10-1234-5678 -> 010-1234-5678)
 */
export function formatKoreanPhone(raw: string): string {
  if (!raw) return "";

  // 1. +82 국가코드 처리
  let cleaned = raw.replace(/\+82\s?/, "0").replace(/[^0-9]/g, "");

  // 번호 길이에 따른 하이픈 포맷팅
  if (cleaned.startsWith("02")) {
    // 서울 지역번호 (02)
    if (cleaned.length === 9) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
    }
  } else if (cleaned.length === 11) {
    // 010-XXXX-XXXX
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  } else if (cleaned.length === 10) {
    // 01X-XXX-XXXX or 지역번호
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  } else if (cleaned.length === 8) {
    // 1588-XXXX
    return cleaned.replace(/(\d{4})(\d{4})/, "$1-$2");
  }

  return raw.trim();
}

/**
 * Web Contact Picker API 지원 여부 확인
 */
export function isContactPickerSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return "contacts" in navigator && "ContactsManager" in window;
}

/**
 * 스마트폰 네이티브 연락처 창(Contact Picker) 호출
 */
export async function pickContactsFromDevice(
  multiple: boolean = true
): Promise<ImportedContact[]> {
  if (!isContactPickerSupported()) {
    throw new Error("NOT_SUPPORTED");
  }

  const nav = navigator as any;
  try {
    const supportedProps: string[] = (await nav.contacts.getProperties?.()) || ["name", "tel"];
    const selectProps = ["name", "tel"];
    if (supportedProps.includes("address")) {
      selectProps.push("address");
    }

    const contacts = await nav.contacts.select(selectProps, { multiple });

    if (!contacts || contacts.length === 0) {
      return [];
    }

    const result: ImportedContact[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      const rawName = Array.isArray(c.name) ? c.name[0] : c.name || "";
      const rawTel = Array.isArray(c.tel) ? c.tel[0] : c.tel || "";

      let addressStr = "";
      if (c.address && Array.isArray(c.address) && c.address[0]) {
        const addr = c.address[0];
        const parts = [
          addr.region,
          addr.city,
          Array.isArray(addr.addressLine) ? addr.addressLine.join(" ") : addr.addressLine,
        ].filter(Boolean);
        addressStr = parts.join(" ").trim();
      }

      if (rawName || rawTel) {
        result.push({
          id: `contact-${Date.now()}-${i}`,
          name: (rawName || "이름없음").trim(),
          phone: formatKoreanPhone(rawTel),
          address: addressStr,
          selected: true,
        });
      }
    }

    return result;
  } catch (err: any) {
    if (err.name === "AbortError" || err.message?.includes("User cancelled")) {
      return []; // 사용자가 연락처 창에서 취소 누름
    }
    throw err;
  }
}

/**
 * vCard (.vcf) 텍스트 파일 파서
 */
export function parseVCard(vcfText: string): ImportedContact[] {
  const results: ImportedContact[] = [];
  if (!vcfText) return results;

  // vCard 블록 분리
  const vcards = vcfText.split(/BEGIN:VCARD/i).slice(1);

  let idx = 0;
  for (const block of vcards) {
    const lines = block.split(/\r?\n/);
    let name = "";
    let tel = "";
    let address = "";
    let memo = "";

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // 이름 (FN 우선, 없으면 N)
      if (/^FN[;: ]/i.test(line)) {
        const val = line.replace(/^FN[;: ][^:]*:/i, "").replace(/^FN:/i, "").trim();
        if (val) name = val;
      } else if (!name && /^N[;: ]/i.test(line)) {
        const val = line.replace(/^N[;: ][^:]*:/i, "").replace(/^N:/i, "").trim();
        // N은 성;이름;;; 형식일 수 있음
        const parts = val.split(";").filter(Boolean);
        if (parts.length > 0) {
          name = parts.join(""); // 한국 성명 조합
        }
      }

      // 전화번호 (CELL, PREF 우선)
      if (/^TEL[;: ]/i.test(line)) {
        const val = line.replace(/^TEL[;: ][^:]*:/i, "").replace(/^TEL:/i, "").trim();
        if (val && (!tel || /CELL|VOICE|PREF/i.test(line))) {
          tel = val;
        }
      }

      // 주소
      if (/^ADR[;: ]/i.test(line)) {
        const val = line.replace(/^ADR[;: ][^:]*:/i, "").replace(/^ADR:/i, "").trim();
        // ADR:;;도로명/지번;시/군/구;도;우편번호;국가
        const parts = val.split(";").filter((p) => p.trim().length > 0);
        if (parts.length > 0) {
          address = parts.join(" ");
        }
      }

      // 메모
      if (/^NOTE[;: ]/i.test(line)) {
        const val = line.replace(/^NOTE[;: ][^:]*:/i, "").replace(/^NOTE:/i, "").trim();
        if (val) memo = val;
      }
    }

    if (name || tel) {
      results.push({
        id: `vcf-${Date.now()}-${idx++}`,
        name: (name || "이름없음").trim(),
        phone: formatKoreanPhone(tel),
        address: address.trim(),
        memo: memo.trim(),
        selected: true,
      });
    }
  }

  return results;
}
