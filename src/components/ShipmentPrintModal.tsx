"use client";

import React, { useRef, useState } from "react";
import { X, Printer, Share2 } from "lucide-react";
import { format } from "date-fns";
import { formatPrice } from "@/lib/utils";
import { parseExtraPhones } from "@/lib/orderShareMessage";

interface PrintOrder {
  id: number;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  shipping_address_detail?: string;
  items?: { product_name: string; quantity: number }[];
  total_amount: number;
  payment_status: string;
  order_status: string;
  tracking_no?: string;
  memo?: string;
}

interface ShipmentPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PrintOrder[];
  selectedDate: string;
  settings: {
    shop_name?: string;
    shop_phone?: string;
    extra_phones?: string;
    owner_name?: string;
    bank_name?: string;
    bank_account?: string;
  };
}

export function ShipmentPrintModal({
  isOpen,
  onClose,
  orders,
  selectedDate,
  settings,
}: ShipmentPrintModalProps) {
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  const totalBoxes = orders.reduce((sum, o) => {
    const qty = (o.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0);
    return sum + qty;
  }, 0);
  const totalWeight = totalBoxes * 20;
  const unpaidCount = orders.filter((o) => o.payment_status !== "PAID").length;
  const packedCount = orders.filter(
    (o) => o.order_status === "PACKED" || o.order_status === "SHIPPED"
  ).length;

  const shopName = settings.shop_name || "임실참배추농원";
  const ownerName = settings.owner_name || "";
  const shopPhone = settings.shop_phone || "";
  const extraPhones = parseExtraPhones(settings.extra_phones);
  const contactsDisplay = [
    shopPhone ? `대표: ${shopPhone}` : "",
    ...extraPhones.map((p) => `${p.label}: ${p.phone}`),
  ]
    .filter(Boolean)
    .join("&nbsp;&nbsp;|&nbsp;&nbsp;");
  const printDate = format(new Date(), "yyyy년 MM월 dd일 HH:mm");

  const buildPrintHtml = () => {
    const rows = orders
      .map((o, idx) => {
        // 박스 수량만 합산
        const totalQty = (o.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0);
        const addr = [o.shipping_address, o.shipping_address_detail]
          .filter(Boolean)
          .join(" ");
        const rowBg = idx % 2 === 0 ? "#fff" : "#f8fafc";
        const memoCell = o.memo
          ? `<span style="color:#be123c;font-weight:700;">${o.memo}</span>`
          : `<span style="color:#d1d5db;">-</span>`;

        return `
          <tr style="background:${rowBg};border-bottom:1px solid #e2e8f0;">
            <td style="padding:9px 7px;text-align:center;font-weight:700;color:#64748b;font-size:13px;">${idx + 1}</td>
            <td style="padding:9px 7px;font-weight:800;font-size:15px;color:#0f172a;white-space:nowrap;">${o.customer_name}</td>
            <td style="padding:9px 7px;font-size:13px;color:#065f46;font-weight:600;white-space:nowrap;">${o.customer_phone}</td>
            <td style="padding:9px 7px;font-weight:800;color:#064e3b;font-size:15px;text-align:center;">${totalQty}박스</td>
            <td style="padding:9px 7px;font-size:12px;color:#334155;">${addr}</td>
            <td style="padding:9px 7px;font-size:12px;">${memoCell}</td>
            <td style="padding:9px 7px;font-size:12px;color:#475569;">${o.tracking_no || "-"}</td>
          </tr>`;
      })
      .join("");

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <title>${shopName} - ${selectedDate} 발송명단</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif; font-size:13px; color:#0f172a; background:#fff; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding:10px 0 10px; border-bottom:3px solid #064e3b; margin-bottom:14px; }
    .sender-block h1 { font-size:20px; font-weight:900; color:#064e3b; margin-bottom:5px; }
    .sender-block p { font-size:12.5px; color:#374151; line-height:1.8; }
    .summary-block { text-align:right; }
    .summary-block .date { font-size:11px; color:#6b7280; margin-bottom:6px; }
    .badges { display:flex; gap:7px; justify-content:flex-end; flex-wrap:wrap; }
    .badge { display:inline-block; padding:3px 10px; border-radius:3px; font-weight:700; font-size:12px; }
    .badge-green { background:#d1fae5; color:#064e3b; border:1px solid #6ee7b7; }
    .badge-amber { background:#fef3c7; color:#92400e; border:1px solid #fcd34d; }
    .section-title { font-size:13px; font-weight:800; color:#064e3b; margin-bottom:7px; padding:4px 8px; background:#f0fdf4; border-left:4px solid #059669; }
    table { width:100%; border-collapse:collapse; }
    thead tr { background:#0f172a; color:#fff; }
    thead th { padding:9px 7px; text-align:left; font-weight:700; font-size:12px; white-space:nowrap; }
    thead th.center { text-align:center; }
    tbody tr { border-bottom:1px solid #e2e8f0; }
    tbody td { vertical-align:middle; }
    .footer { margin-top:16px; border-top:1px solid #e2e8f0; padding-top:7px; font-size:10.5px; color:#94a3b8; text-align:center; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
  <!-- 발송 헤더 -->
  <div class="header">
    <div class="sender-block">
      <h1>📦 ${shopName} 발송 명단</h1>
      <p>보내는 사람: <strong>${ownerName || shopName}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;연락처: <strong>${contactsDisplay || shopPhone}</strong></p>
      <p>택배 도착 예정일: <strong>${selectedDate}</strong></p>
    </div>
    <div class="summary-block">
      <div class="date">출력일시: ${printDate}</div>
      <div class="badges">
        <span class="badge badge-green">총 ${orders.length}건</span>
        <span class="badge badge-amber">절임배추 20kg &times; ${totalBoxes}박스 (${totalWeight}kg)</span>
      </div>
    </div>
  </div>

  <!-- 수령자 명단 -->
  <div class="section-title">▶ 수령자 발송 명단 (${selectedDate} 도착 기준)</div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width:32px;">No.</th>
        <th style="width:70px;">성명</th>
        <th style="width:110px;">연락처</th>
        <th class="center" style="width:72px;">수량</th>
        <th>배송 주소</th>
        <th style="width:120px;">특이사항/메모</th>
        <th style="width:100px;">운송장번호</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">본 문서는 ${shopName}에서 자동 생성된 발송 명단입니다. | ${printDate}</div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const html = buildPrintHtml();
    const iframe = printFrameRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 400);
  };

  // 모바일 팩스 공유 (Web Share API)
  const [shareStatus, setShareStatus] = useState<"idle" | "sharing" | "unsupported">("idle");

  const handleShareFax = async () => {
    const html = buildPrintHtml();

    // HTML 파일을 Blob으로 생성
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const fileName = `발송명단_${selectedDate}.html`;
    const file = new File([blob], fileName, { type: "text/html" });

    // Web Share API 지원 여부 확인
    const canShareFiles =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFiles) {
      try {
        setShareStatus("sharing");
        await navigator.share({
          title: `${shopName} 발송명단 (${selectedDate})`,
          text: `${selectedDate} 택배 도착 예정 수령자 명단 (${orders.length}건 / 절임배추 ${totalBoxes}박스)`,
          files: [file],
        });
        setShareStatus("idle");
      } catch (err: any) {
        // 사용자가 취소한 경우 오류 안내 필요 없음
        setShareStatus("idle");
      }
    } else if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      // 파일 공유가 안 되는 환경이면 텍스트만 공유
      try {
        setShareStatus("sharing");
        await navigator.share({
          title: `${shopName} 발송명단 (${selectedDate})`,
          text: `${selectedDate} 택배 도착 예정\n수령자 명단: ${orders.length}건 / 절임배추 20kg × ${totalBoxes}박스\n\n` +
            orders.map((o, i) => {
              const qty = (o.items || []).reduce((s: number, x: any) => s + (x.quantity || 0), 0);
              const addr = [o.shipping_address, o.shipping_address_detail].filter(Boolean).join(" ");
              return `${i + 1}. ${o.customer_name} ${o.customer_phone} ${qty}박스 ${addr}${o.memo ? " ["+o.memo+"]" : ""}`;
            }).join("\n"),
        });
        setShareStatus("idle");
      } catch {
        setShareStatus("idle");
      }
    } else {
      // 데스크톱/미지원 환경
      setShareStatus("unsupported");
      setTimeout(() => setShareStatus("idle"), 4000);
    }
  };

  const previewHtml = isOpen ? buildPrintHtml() : "";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Printer className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-black">인쇄 미리보기</h2>
              <p className="text-xs text-slate-400">
                {selectedDate} 발송 명단 · {orders.length}건 · 절임배추 20kg {totalBoxes}박스
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareFax}
              disabled={shareStatus === "sharing"}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm cursor-pointer transition-colors"
              title="모바일 팩스 / 공유시트 열기"
            >
              <Share2 className="w-4 h-4" />
              <span>{shareStatus === "sharing" ? "공유 중..." : "팩스 / 공유"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>인쇄 / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-slate-800 px-5 py-2 flex flex-wrap items-center gap-2 text-xs font-bold shrink-0">
          <span className="bg-emerald-700 text-white px-3 py-1">총 {orders.length}건</span>
          <span className="bg-amber-700 text-white px-3 py-1">20kg × {totalBoxes}박스 ({totalWeight}kg)</span>
          <span className="bg-slate-600 text-emerald-300 px-3 py-1">포장완료 {packedCount}/{orders.length}</span>
          {unpaidCount > 0 && (
            <span className="bg-red-700 text-white px-3 py-1">미입금 {unpaidCount}건 주의</span>
          )}
          {shareStatus === "unsupported" ? (
            <span className="text-amber-300 ml-auto text-xs">⚠️ 이 기기는 공유를 지원하지 않습니다. PDF 저장 후 팩스 앱에서 직접 전송하세요.</span>
          ) : (
            <span className="text-slate-400 ml-auto text-xs">📠 팩스/공유 버튼 → 모바일팩스 앱 선택</span>
          )}
        </div>

        <div className="flex-1 overflow-hidden bg-slate-200 p-3">
          <iframe
            srcDoc={previewHtml}
            className="w-full h-full bg-white shadow-lg border border-slate-300"
            title="발송명단 미리보기"
            style={{ minHeight: "500px" }}
          />
        </div>
        <iframe ref={printFrameRef} style={{ display: "none" }} title="print-frame" />
      </div>
    </div>
  );
}
