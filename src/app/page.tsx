"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { DashboardView } from "@/components/DashboardView";
import { CalendarView } from "@/components/CalendarView";
import { NewOrderView } from "@/components/NewOrderView";
import { ShipmentView } from "@/components/ShipmentView";
import { LedgerView } from "@/components/LedgerView";
import { SettingsView } from "@/components/SettingsView";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileAppBanner } from "@/components/MobileAppBanner";
import { ExitConfirmModal } from "@/components/ExitConfirmModal";
import { fetchSettingsService } from "@/lib/services";
import { initClientTables, getClientDb } from "@/lib/clientDb";

const VALID_TABS = [
  "dashboard",
  "calendar",
  "new-order",
  "shipments",
  "ledger",
  "settings",
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExited, setIsExited] = useState(false);
  const [orderTargetDate, setOrderTargetDate] = useState<string | undefined>(
    undefined
  );
  const [orderPreFill, setOrderPreFill] = useState<{
    customer?: any;
    address?: any;
  } | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({
    shop_name: "임실 절임배추",
    shop_phone: "010-0000-0000",
    extra_phones: "[]",
    share_message_template: "",
    bank_name: "농협",
    bank_account: "351-0000-0000-00",
    owner_name: "대표자",
  });

  const loadSettings = useCallback(async () => {
    try {
      const data = await fetchSettingsService();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (e: any) {
      console.error("설정 로드 실패:", e);
    }
  }, []);

  // 모바일 뒤로가기(popstate) 및 브라우저 히스토리 연동
  useEffect(() => {
    const getTabFromHash = () => {
      if (typeof window === "undefined") return "dashboard";
      const raw = window.location.hash.replace("#", "").split("/")[0].split("?")[0];
      return VALID_TABS.includes(raw) ? raw : "dashboard";
    };

    const initialTab = getTabFromHash();
    setActiveTab(initialTab);

    // 최초 진입 시 히스토리 스택 초기화 (뒤로가기로 인한 브라우저 종료 방지)
    if (typeof window !== "undefined") {
      if (!window.history.state || !window.history.state.tab) {
        window.history.replaceState({ tab: "dashboard", isRoot: true }, "", "#dashboard");
        if (initialTab !== "dashboard") {
          window.history.pushState({ tab: initialTab }, "", "#" + initialTab);
        }
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      // 1. 만약 모달/팝업이 열려있어서 닫힌 경우, 탭 변경이나 종료를 하지 않음
      if (e.state?.isModal) {
        return;
      }

      const targetTab = e.state?.tab || getTabFromHash();

      // 2. 다른 탭에 있을 때 뒤로가기 누르면 이전 탭 또는 대시보드(홈)으로 안전 이동
      if (targetTab && targetTab !== "dashboard" && VALID_TABS.includes(targetTab)) {
        setActiveTab(targetTab);
      } else {
        // 3. 대시보드(홈) 상태에서 뒤로가기를 누른 경우
        // 브라우저가 그냥 꺼지지 않도록 히스토리 보호 후 종료 확인 모달 표시
        setActiveTab("dashboard");
        if (typeof window !== "undefined") {
          window.history.pushState({ tab: "dashboard", isRoot: true }, "", "#dashboard");
        }
        setShowExitConfirm(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    // 접속하자마자 기본 Turso DB와 자동 연결 및 초기화 수행
    const db = getClientDb();
    initClientTables(db)
      .then(() => loadSettings())
      .catch((err) => console.error("초기화 오류:", err));
  }, [loadSettings]);

  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    if (typeof window !== "undefined") {
      window.history.pushState({ tab }, "", "#" + tab);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectDateForNewOrder = (dateStr: string) => {
    setOrderPreFill(null);
    setOrderTargetDate(dateStr);
    handleTabChange("new-order");
  };

  const handleSelectCustomerForOrder = (customer: any, address?: any) => {
    setOrderPreFill({ customer, address });
    setOrderTargetDate(undefined);
    handleTabChange("new-order");
  };

  // 프로그램 종료 실행 함수
  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    try {
      // PWA / 바로가기 앱 창일 경우 창 닫기 시도
      window.close();
    } catch {
      // ignore
    }
    // 창이 닫히지 않는 일반 브라우저 탭일 경우 안전 종료 화면으로 전환
    setIsExited(true);
  };

  // 프로그램 종료 화면
  if (isExited) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-24 h-24 rounded-full bg-emerald-950/80 border-2 border-emerald-500/50 flex items-center justify-center mb-6 shadow-2xl">
          <img
            src="./icons/icon-192.png"
            alt="배추 아이콘"
            className="w-16 h-16 rounded-full object-cover"
          />
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-emerald-400 mb-3">
          프로그램이 안전하게 종료되었습니다
        </h2>
        <p className="text-slate-400 text-base max-w-sm mb-8 leading-relaxed">
          모든 주문 및 고객 데이터가 안전하게 보관되어 있습니다.
          <br />
          스마트폰 홈 버튼을 누르시거나 창을 닫아주세요.
        </p>
        <button
          onClick={() => {
            setIsExited(false);
            setActiveTab("dashboard");
          }}
          className="px-6 py-3.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-extrabold rounded-2xl shadow-xl transition-all text-base md:text-lg cursor-pointer"
        >
          프로그램 다시 시작
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* 모바일 PWA 앱 설치 유도 배너 (홈 화면 추가) */}
      <MobileAppBanner />

      {/* 상단 실제 상호/전화번호/계좌 안내 및 네비게이션 헤더 */}
      <Header
        settings={settings}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onExitClick={() => setShowExitConfirm(true)}
      />

      {/* 메인 화면 영역 (모바일 하단 탭바 높이만큼 하단 패딩 pb-28 확보) */}
      <main className="flex-1 px-2 py-4 md:px-4 md:py-8 max-w-6xl mx-auto w-full pb-28 md:pb-8">
        {/* 1. 홈 / 오늘 출고 현황 (이번 주 7일 스케줄러 포함) */}
        {activeTab === "dashboard" && (
          <DashboardView
            settings={settings}
            onGoToNewOrder={() => {
              setOrderTargetDate(undefined);
              handleTabChange("new-order");
            }}
            onGoToShipments={() => handleTabChange("shipments")}
            onGoToCalendar={() => handleTabChange("calendar")}
            onRequestConfig={() => {}}
          />
        )}

        {/* 2. 월별·주간별 출고 달력 스케줄러 */}
        {activeTab === "calendar" && (
          <CalendarView
            onSelectDateForNewOrder={handleSelectDateForNewOrder}
            settings={settings}
          />
        )}

        {/* 3. 통합 주문 등록 (문자·사진 자동 입력 및 수기 등록) */}
        {activeTab === "new-order" && (
          <NewOrderView
            settings={settings}
            initialShippingDate={orderTargetDate}
            preFillCustomer={orderPreFill?.customer}
            preFillAddress={orderPreFill?.address}
            onOrderSaved={() => {
              setOrderPreFill(null);
              handleTabChange("dashboard");
            }}
            onRequestConfig={() => {}}
          />
        )}

        {/* 4. 출고·택배 관리 */}
        {activeTab === "shipments" && (
          <ShipmentView settings={settings} onRequestConfig={() => {}} />
        )}

        {/* 5. 장부 관리 (판매 리스트 + 고객 리스트) */}
        {activeTab === "ledger" && (
          <LedgerView
            settings={settings}
            onRequestConfig={() => {}}
            onSelectCustomerForOrder={handleSelectCustomerForOrder}
          />
        )}  

        {/* 6. 설정 */}
        {activeTab === "settings" && (
          <SettingsView
            onSettingsUpdated={loadSettings}
          />
        )}
      </main>

      {/* 모바일 전용 하단 네비게이션 탭바 (네이티브 앱 UX) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onExitClick={() => setShowExitConfirm(true)}
      />

      {/* 하단 푸터 (데스크톱/태블릿) */}
      <footer className="hidden md:block bg-slate-900 text-slate-400 py-6 text-center text-sm border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <p className="font-bold text-slate-200">
            {settings.shop_name || "임실 절임배추"} 주문·출고 관리 프로그램
          </p>
          <p className="text-xs text-slate-500">
            현장 전용 웹앱 &middot; 모바일 확대/축소 지원
          </p>
        </div>
      </footer>

      {/* 프로그램 종료 확인 모달 */}
      <ExitConfirmModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirmExit={handleConfirmExit}
      />
    </div>
  );
}
