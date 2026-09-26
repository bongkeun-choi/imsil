"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { DashboardView } from "@/components/DashboardView";
import { CalendarView } from "@/components/CalendarView";
import { NewOrderView } from "@/components/NewOrderView";
import { ShipmentView } from "@/components/ShipmentView";
import { CustomerView } from "@/components/CustomerView";
import { SettingsView } from "@/components/SettingsView";
import { fetchSettingsService } from "@/lib/services";
import { initClientTables, getClientDb } from "@/lib/clientDb";

const VALID_TABS = [
  "dashboard",
  "calendar",
  "new-order",
  "shipments",
  "customers",
  "settings",
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showExitToast, setShowExitToast] = useState(false);
  const [orderTargetDate, setOrderTargetDate] = useState<string | undefined>(
    undefined
  );
  const [settings, setSettings] = useState<Record<string, string>>({
    shop_name: "임실 절임배추",
    shop_phone: "010-0000-0000",
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

    // 최초 진입 시 히스토리 스택 초기화
    if (typeof window !== "undefined") {
      if (!window.history.state || !window.history.state.tab) {
        window.history.replaceState({ tab: "dashboard", isRoot: true }, "", "#dashboard");
        if (initialTab !== "dashboard") {
          window.history.pushState({ tab: initialTab }, "", "#" + initialTab);
        }
      }
    }

    let exitToastTimer: NodeJS.Timeout | null = null;
    let lastBackPressTime = 0;

    const handlePopState = (e: PopStateEvent) => {
      const targetTab = e.state?.tab || getTabFromHash();

      if (targetTab && targetTab !== "dashboard" && VALID_TABS.includes(targetTab)) {
        setActiveTab(targetTab);
      } else {
        // 대시보드(홈) 도달 시
        setActiveTab("dashboard");

        const now = Date.now();
        // 2초 내에 뒤로 가기를 한 번 더 누르면 앱 정상 종료 허용
        if (now - lastBackPressTime < 2000) {
          return;
        }

        // 첫 번째 뒤로 가기: 종료 방지 토스트 표시 및 상태 복원
        lastBackPressTime = now;
        setShowExitToast(true);
        if (exitToastTimer) clearTimeout(exitToastTimer);
        exitToastTimer = setTimeout(() => setShowExitToast(false), 2000);

        window.history.pushState({ tab: "dashboard", isRoot: true }, "", "#dashboard");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (exitToastTimer) clearTimeout(exitToastTimer);
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
    setOrderTargetDate(dateStr);
    handleTabChange("new-order");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* 상단 실제 상호/전화번호/계좌 안내 및 네비게이션 헤더 */}
      <Header
        settings={settings}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />

      {/* 메인 화면 영역 */}
      <main className="flex-1 px-2 py-4 md:px-4 md:py-8 max-w-6xl mx-auto w-full">
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
            onOrderSaved={() => handleTabChange("dashboard")}
            onRequestConfig={() => {}}
          />
        )}

        {/* 4. 출고·택배 관리 */}
        {activeTab === "shipments" && (
          <ShipmentView settings={settings} onRequestConfig={() => {}} />
        )}

        {/* 5. 단골 고객 장부 */}
        {activeTab === "customers" && <CustomerView onRequestConfig={() => {}} />}

        {/* 6. 농가 정보 및 단가 설정 */}
        {activeTab === "settings" && (
          <SettingsView onSettingsUpdated={loadSettings} />
        )}
      </main>

      {/* 하단 푸터 */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-sm border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <p className="font-bold text-slate-200">
            {settings.shop_name || "임실 절임배추"} 주문·출고 관리 프로그램
          </p>
          <p className="text-xs text-slate-500">
            현장 전용 웹앱 &middot; 모바일 확대/축소 지원
          </p>
        </div>
      </footer>
      {/* 모바일 뒤로가기 종료 방지 안내 토스트 */}
      {showExitToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-6 py-3.5 rounded-full shadow-2xl text-base font-bold flex items-center gap-2 border border-slate-700">
          <span>&apos;뒤로 가기&apos;를 한 번 더 누르면 종료됩니다.</span>
        </div>
      )}
    </div>
  );
}
