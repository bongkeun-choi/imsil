"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Share2,
  MessageSquare,
  Copy,
  Download,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { OrderCardData, generateOrderCardImage } from "@/lib/orderCardCanvas";

export function generateOrderShareMessage(data: OrderCardData): string {
  const isPaid = data.paymentStatus === "PAID";
  const formattedAmount = data.totalAmount.toLocaleString();
  const fullAddress = `${data.shippingAddress} ${data.shippingAddressDetail || ""}`.trim();

  let msg = `[${data.shopName || "임실참배추농원"} 주문 접수 안내]\n\n`;
  msg += `안녕하세요, ${data.customerName} 고객님!\n`;
  msg += `청정 임실 절임배추를 주문해 주셔서 진심으로 감사드립니다.\n\n`;
  msg += `■ 주문 접수 내역\n`;
  msg += `• 주문번호: ${data.orderNo}\n`;
  msg += `• 주문상품: ${data.itemsSummary}\n`;
  msg += `• 택배 도착 예정일: ${data.shippingDate} (도착 전날 신선 포장 발송)\n`;
  msg += `• 받으실 주소: ${fullAddress}\n\n`;

  msg += `■ 결제 및 입금 안내\n`;
  msg += `• 결제금액: ${formattedAmount}원 (${isPaid ? "입금 확인 완료" : "입금 대기중"})\n`;
  if (!isPaid) {
    msg += `• 입금계좌: [${data.bankName || "농협"}] ${data.bankAccount || ""}\n`;
    msg += `• 예금주: ${data.ownerName || ""}\n`;
    msg += `(※ 주문자명과 입금자명이 다를 경우 꼭 연락 부탁드립니다.)\n\n`;
  } else {
    msg += `(입금이 정상 확인되었습니다. 정성껏 준비하겠습니다.)\n\n`;
  }

  msg += `■ 농가 문의처\n`;
  msg += `• 농가명: ${data.shopName || "임실참배추농원"}\n`;
  msg += `• 문의전화: ${data.shopPhone || "010-0000-0000"}\n\n`;
  msg += `신선하고 깨끗한 절임배추로 엄선하여 안전하게 배송해 드리겠습니다. 감사합니다!`;

  return msg;
}

interface OrderShareModalProps {
  orderData: OrderCardData;
  isOpen: boolean;
  onClose: () => void;
  isNewOrder?: boolean;
}

export function OrderShareModal({
  orderData,
  isOpen,
  onClose,
  isNewOrder = false,
}: OrderShareModalProps) {
  const [activeTab, setActiveTab] = useState<"text" | "image">("text");
  const [messageText, setMessageText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // 모달 열릴 때 초기화 및 캔버스 이미지 생성
  useEffect(() => {
    if (!isOpen) return;

    setMessageText(generateOrderShareMessage(orderData));
    setIsGeneratingImage(true);

    generateOrderCardImage(orderData)
      .then(({ dataUrl, file }) => {
        setImageDataUrl(dataUrl);
        setImageFile(file);
      })
      .catch((err) => {
        console.error("이미지 영수증 생성 실패:", err);
      })
      .finally(() => {
        setIsGeneratingImage(false);
      });
  }, [isOpen, orderData]);

  // 스마트폰 뒤로 가기 제스처 연동
  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ modal: "order-share" }, "");

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (window.history.state?.modal === "order-share") {
      window.history.back();
    } else {
      onClose();
    }
  };

  // 1. 스마트폰 네이티브 공유 (카카오톡, 문자, 밴드 등 선택)
  const handleNativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      alert("현재 기기나 브라우저에서는 스마트폰 앱 공유를 직접 지원하지 않습니다. 아래 [문자 바로 전송] 또는 [문구 복사]를 이용해주세요.");
      return;
    }

    try {
      const shareData: ShareData = {
        title: `[${orderData.shopName || "임실참배추농원"}] ${orderData.customerName}님 주문 확인서`,
        text: messageText,
      };

      // 파일 첨부 가능 여부 확인
      if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        shareData.files = [imageFile];
      }

      await navigator.share(shareData);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("공유 실패:", err);
      }
    }
  };

  // 2. 문자(SMS) 바로 전송
  const handleDirectSms = () => {
    const cleanPhone = orderData.customerPhone.replace(/[^0-9]/g, "");
    const encodedBody = encodeURIComponent(messageText);

    // 모바일 기기별 sms URI 처리
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const smsUrl = isIOS
      ? `sms:${cleanPhone}&body=${encodedBody}`
      : `sms:${cleanPhone}?body=${encodedBody}`;

    window.location.href = smsUrl;
  };

  // 3. 카카오톡 공유
  const handleKakaoShare = async () => {
    if (navigator.share) {
      try {
        const shareData: ShareData = {
          title: `[${orderData.shopName || "임실참배추농원"}] ${orderData.customerName}님 주문 확인서`,
          text: messageText,
        };
        if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
          shareData.files = [imageFile];
        }
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }

    // fallback: 문구 복사 후 카카오톡 실행 유도
    copyToClipboard();
    alert("문구가 복사되었습니다! 카카오톡 앱을 열어 고객님 채팅방에 붙여넣기 하세요.");
    window.location.href = "kakaotalk://";
  };

  // 4. 문구 클립보드 복사
  const copyToClipboard = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(messageText);
    } else {
      const ta = document.createElement("textarea");
      ta.value = messageText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  // 5. 영수증 이미지 다운로드
  const handleDownloadImage = () => {
    if (!imageDataUrl) return;
    const a = document.createElement("a");
    a.href = imageDataUrl;
    a.download = `주문확인서_${orderData.customerName}_${orderData.orderNo}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-3 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border-4 border-emerald-600 animate-in fade-in zoom-in duration-150">
        {/* 모달 상단 헤더 */}
        <div className="bg-emerald-700 text-white p-4 md:p-5 rounded-t-[20px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black">
                {isNewOrder ? "주문 등록 완료 및 안내 전송" : "주문 확인 안내 전송"}
              </h3>
              <p className="text-xs text-emerald-200">
                고객에게 카카오톡이나 문자로 주문 확인서와 계좌를 전송합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-white hover:bg-emerald-800 p-1.5 rounded-full cursor-pointer transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 탭 전환 (문구 보기 / 영수증 이미지 카드) */}
        <div className="flex border-b-2 border-slate-200 bg-slate-50 px-4 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className={`flex-1 py-2.5 px-3 rounded-t-xl font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              activeTab === "text"
                ? "bg-white text-emerald-800 border-t-2 border-x-2 border-slate-200 border-b-white -mb-[2px]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>문자 / 카톡 문구</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("image")}
            className={`flex-1 py-2.5 px-3 rounded-t-xl font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              activeTab === "image"
                ? "bg-white text-emerald-800 border-t-2 border-x-2 border-slate-200 border-b-white -mb-[2px]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span>영수증 사진 카드</span>
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-4 md:p-5 overflow-y-auto space-y-4 flex-1">
          {copiedToast && (
            <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-center text-sm shadow-md animate-in fade-in duration-200 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>안내 문구가 복사되었습니다!</span>
            </div>
          )}

          {activeTab === "text" ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700">
                  전송 문구 (필요시 내용을 직접 수정할 수 있습니다)
                </span>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>문구 복사</span>
                </button>
              </div>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={11}
                className="w-full text-base font-medium border-2 border-slate-300 rounded-2xl p-4 focus:border-emerald-600 focus:outline-hidden bg-slate-50 leading-relaxed text-slate-900"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700">
                  자동 생성된 주문 영수증 이미지
                </span>
                {imageDataUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>사진 저장</span>
                  </button>
                )}
              </div>

              {isGeneratingImage ? (
                <div className="py-20 text-center text-slate-500 font-bold">
                  영수증 카드를 생성하고 있습니다...
                </div>
              ) : imageDataUrl ? (
                <div className="border-2 border-slate-300 rounded-2xl overflow-hidden shadow-inner bg-slate-100 flex justify-center p-2">
                  <img
                    src={imageDataUrl}
                    alt="주문 확인서 영수증 카드"
                    className="max-h-[360px] w-auto object-contain rounded-xl shadow-md"
                  />
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">
                  이미지를 생성하지 못했습니다.
                </div>
              )}
              <p className="text-xs text-slate-500 text-center">
                ※ 스마트폰 공유 버튼을 누르면 이 영수증 사진과 문구가 함께 전송됩니다.
              </p>
            </div>
          )}

          {/* 주요 전송 액션 버튼들 */}
          <div className="space-y-2 pt-1">
            {/* 1. 스마트폰 시스템 공유 (카카오톡, 문자, 밴드 등 선택) */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2.5 shadow-md cursor-pointer transition-all"
            >
              <Smartphone className="w-6 h-6" />
              <span>📱 스마트폰 공유 (카카오톡·문자 선택)</span>
            </button>

            {/* 2. 전용 바로가기 버튼 2단 그리드 (카카오톡 / 문자) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleKakaoShare}
                className="py-3.5 bg-[#FEE500] hover:bg-[#FDD835] active:scale-98 text-[#3C1E1E] rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all border border-[#E6CF00]"
              >
                <MessageSquare className="w-5 h-5 fill-[#3C1E1E]" />
                <span>카카오톡 전송</span>
              </button>

              <button
                type="button"
                onClick={handleDirectSms}
                className="py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
              >
                <MessageSquare className="w-5 h-5" />
                <span>문자(SMS) 바로 전송</span>
              </button>
            </div>
          </div>
        </div>

        {/* 팝업 하단 닫기 */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-[20px] flex justify-between items-center">
          <button
            type="button"
            onClick={copyToClipboard}
            className="text-slate-600 hover:text-slate-900 font-bold text-sm flex items-center gap-1.5 cursor-pointer px-2 py-1"
          >
            <Copy className="w-4 h-4" />
            <span>문구 복사</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-base cursor-pointer transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
