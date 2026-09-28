"use client";

import React, { useState, useRef, useCallback } from "react";
import { formatPhone } from "@/lib/utils";
import { Phone, Copy, X, Check } from "lucide-react";

interface PhoneCallLinkProps {
  phone?: string | null;
  name?: string | null;
  className?: string;
  showIcon?: boolean;
}

export function PhoneCallLink({
  phone,
  name,
  className = "",
  showIcon = false,
}: PhoneCallLinkProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const cleanPhone = (phone || "").replace(/[^0-9]/g, "");
  const formattedPhone = formatPhone(phone);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2000);
  }, []);

  const handleStart = (clientX: number, clientY: number) => {
    isLongPressRef.current = false;
    startPosRef.current = { x: clientX, y: clientY };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(50);
        } catch (_) {}
      }
      setShowModal(true);
    }, 500); // 500ms 이상 길게 누르면 팝업 발동
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!startPosRef.current) return;
    const diffX = Math.abs(clientX - startPosRef.current.x);
    const diffY = Math.abs(clientY - startPosRef.current.y);
    // 스크롤 등 손가락이 10px 이상 움직이면 롱프레스 취소
    if (diffX > 10 || diffY > 10) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLongPressRef.current) {
      // 롱프레스로 팝업이 뜬 경우 클릭 무시
      isLongPressRef.current = false;
      return;
    }
    // 짧게 클릭/탭했을 때 바로 전화 걸리지 않고 안내
    showToast("전화 연결은 번호를 길게 꾹 눌러주세요.");
  };

  const handleCall = () => {
    if (!cleanPhone) return;
    setShowModal(false);
    window.location.href = `tel:${cleanPhone}`;
  };

  const handleCopy = async () => {
    if (!formattedPhone) return;
    try {
      await navigator.clipboard.writeText(formattedPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      showToast("복사 실패");
    }
  };

  if (!phone || !cleanPhone) {
    return <span className="text-slate-400 font-normal text-xs">연락처 없음</span>;
  }

  return (
    <>
      <span
        onTouchStart={(e) => {
          const t = e.touches[0];
          handleStart(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          handleMove(t.clientX, t.clientY);
        }}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onClick={handleClick}
        className={`cursor-pointer select-none inline-flex items-center gap-1 active:opacity-70 transition-opacity ${
          className || "text-emerald-800 font-bold hover:underline"
        }`}
        title="길게 누르면 전화 연결 팝업이 뜹니다"
      >
        {showIcon && <Phone className="w-3.5 h-3.5 shrink-0 text-emerald-600" />}
        <span>{formattedPhone}</span>
      </span>

      {/* 짧게 탭했을 때 안내 토스트 */}
      {toastMsg && (
        <span className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/90 text-white text-xs font-bold px-3.5 py-2 rounded-full shadow-lg pointer-events-none animate-fade-in">
          {toastMsg}
        </span>
      )}

      {/* 길게 눌렀을 때 전화 확인 팝업 모달 */}
      {showModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 text-center space-y-4 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 아이콘 */}
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700">
              <Phone className="w-7 h-7 animate-pulse" />
            </div>

            {/* 안내 텍스트 */}
            <div>
              <div className="text-sm font-bold text-slate-500 mb-1">전화 연결</div>
              <div className="text-xl font-black text-slate-900">
                {name ? `${name}님께` : "해당 번호로"}
              </div>
              <div className="text-lg font-bold text-emerald-700 mt-1 tracking-wider">
                {formattedPhone}
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">
                전화를 걸까요?
              </p>
            </div>

            {/* 버튼 그룹 */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleCall}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-lg shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-98"
              >
                <Phone className="w-5 h-5" />
                전화 걸기
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 font-black">복사되었습니다!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>번호 복사</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-700 font-bold text-xs cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
