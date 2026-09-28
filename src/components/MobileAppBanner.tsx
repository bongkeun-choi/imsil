"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Smartphone, CheckCircle, Share } from "lucide-react";

export function MobileAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 이미 앱(PWA/Standalone)으로 실행 중인지 확인
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);

    // iOS 기기 여부 감지
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleMobile = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isAppleMobile);

    // 안드로이드/Chrome의 PWA 설치 이벤트 감지
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setDeferredPrompt(null);
        setIsDismissed(true);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      alert(
        "브라우저 상단 우측의 메뉴(⋮)를 누르신 후 [홈 화면에 추가] 또는 [앱 설치]를 선택하시면 바탕화면에 설치됩니다."
      );
    }
  };

  // 이미 앱으로 실행 중이거나 사용자가 배너를 닫은 경우 표시 안 함
  if (isStandalone || isDismissed) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-3 py-2.5 shadow-md flex items-center justify-between gap-2 border-b border-emerald-600">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-emerald-200" />
          </div>
          <div className="truncate">
            <p className="text-xs font-bold leading-tight">
              앱으로 설치하여 시원하게 사용하기
            </p>
            <p className="text-[11px] text-emerald-200 truncate">
              홈 화면에 추가하면 상단 주소창 없이 진짜 앱처럼 넓게 열립니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-2.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-extrabold text-xs rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            앱 설치
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-emerald-300 hover:text-white rounded"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS 사파리 홈 화면 추가 안내 모달 */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Share className="w-5 h-5 text-emerald-600" />
              아이폰 홈 화면에 앱 추가하기
            </h3>
            <ol className="text-sm text-slate-700 space-y-2.5 list-decimal list-inside bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
              <li>사파리 하단의 <strong>공유 버튼 [↑]</strong>을 누릅니다.</li>
              <li>메뉴를 위로 올려 <strong>[홈 화면에 추가]</strong>를 누릅니다.</li>
              <li>우측 상단의 <strong>[추가]</strong>를 누르면 배추 아이콘 앱이 생성됩니다!</li>
            </ol>
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
