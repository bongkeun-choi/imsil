"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { DashboardView } from "@/components/DashboardView";
import { CalendarView } from "@/components/CalendarView";
import { NewOrderView } from "@/components/NewOrderView";
import { ShipmentView } from "@/components/ShipmentView";
import { CustomerView } from "@/components/CustomerView";
import { SettingsView } from "@/components/SettingsView";
import { TursoConfigModal } from "@/components/TursoConfigModal";
import { fetchSettingsService } from "@/lib/services";
import { initClientTables, getClientDb } from "@/lib/clientDb";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [orderTargetDate, setOrderTargetDate] = useState<string | undefined>(
    undefined
  );
  const [showConfigModal, setShowConfigModal] = useState(false);
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

  useEffect(() => {
    // 접속하자마자 기본 Turso DB와 자동 연결 및 초기화 수행
    const db = getClientDb();
    initClientTables(db)
      .then(() => loadSettings())
      .catch((err) => console.error("초기화 오류:", err));
  }, [loadSettings]);

  const handleTabChange = (tab: string) => {
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
      <main className="flex-1 px-4 py-6 md:py-8 max-w-6xl mx-auto w-full">
        {/* 1. 홈 / 오늘 출고 현황 (이번 주 7일 스케줄러 포함) */}
        {activeTab === "dashboard" && (
          <DashboardView
            onGoToNewOrder={() => {
              setOrderTargetDate(undefined);
              handleTabChange("new-order");
            }}
            onGoToShipments={() => handleTabChange("shipments")}
            onGoToCalendar={() => handleTabChange("calendar")}
            onRequestConfig={() => {}}
          />
        )}

        {/* 2. [신규] 월별·주간별 출고 달력 스케줄러 */}
        {activeTab === "calendar" && (
          <CalendarView
            onSelectDateForNewOrder={handleSelectDateForNewOrder}
          />
        )}

        {/* 3. 새 주문 등록 */}
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
          <SettingsView
            onSettingsUpdated={loadSettings}
            onRequestConfig={() => setShowConfigModal(true)}
          />
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

      {/* Turso DB 연결 정보 모달 (설정 탭에서 필요할 때만 열림) */}
      <TursoConfigModal
        isOpen={showConfigModal}
        onConfigSaved={() => {
          setShowConfigModal(false);
          loadSettings();
        }}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
}
