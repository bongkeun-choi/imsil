"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { DashboardView } from "@/components/DashboardView";
import { NewOrderView } from "@/components/NewOrderView";
import { ShipmentView } from "@/components/ShipmentView";
import { CustomerView } from "@/components/CustomerView";
import { SettingsView } from "@/components/SettingsView";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [settings, setSettings] = useState<Record<string, string>>({
    shop_name: "임실 절임배추",
    shop_phone: "010-0000-0000",
    bank_name: "농협",
    bank_account: "351-0000-0000-00",
    owner_name: "대표자",
  });

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error("설정 로드 실패:", e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* 상단 실제 상호/전화번호/계좌 안내 및 네비게이션 헤더 */}
      <Header
        settings={settings}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
      />

      {/* 메인 화면 영역 (한 화면에 너무 많은 것을 담지 않고 탭별로 시원하게 분리) */}
      <main className="flex-1 px-4 py-6 md:py-8 max-w-6xl mx-auto w-full">
        {activeTab === "dashboard" && (
          <DashboardView
            onGoToNewOrder={() => handleTabChange("new-order")}
            onGoToShipments={() => handleTabChange("shipments")}
          />
        )}

        {activeTab === "new-order" && (
          <NewOrderView
            settings={settings}
            onOrderSaved={() => handleTabChange("dashboard")}
          />
        )}

        {activeTab === "shipments" && <ShipmentView settings={settings} />}

        {activeTab === "customers" && <CustomerView />}

        {activeTab === "settings" && (
          <SettingsView onSettingsUpdated={loadSettings} />
        )}
      </main>

      {/* 하단 푸터 (단정하고 신뢰감 있는 텍스트) */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-sm border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <p className="font-bold text-slate-200">
            {settings.shop_name || "임실 절임배추"} 주문·출고 관리 프로그램
          </p>
          <p className="text-xs text-slate-500">
            현장 작업용 PWA 웹앱 &middot; Turso libSQL Database &middot; 모바일 확대 축소 지원
          </p>
        </div>
      </footer>
    </div>
  );
}
