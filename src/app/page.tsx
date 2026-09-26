"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { DashboardView } from "@/components/DashboardView";
import { NewOrderView } from "@/components/NewOrderView";
import { ShipmentView } from "@/components/ShipmentView";
import { CustomerView } from "@/components/CustomerView";
import { SettingsView } from "@/components/SettingsView";
import { TursoConfigModal } from "@/components/TursoConfigModal";
import { fetchSettingsService } from "@/lib/services";
import { getStoredTursoConfig, saveTursoConfig, initClientTables, getClientDb } from "@/lib/clientDb";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
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
      if (e.message === "DB_NOT_CONFIGURED") {
        setShowConfigModal(true);
      }
    }
  }, []);

  useEffect(() => {
    // 1. 만약 로컬스토리지에 Turso 설정이 없는데 환경변수가 주입되어 있는 경우 (로컬 개발 편의)
    const existing = getStoredTursoConfig();
    if (!existing) {
      const defaultUrl = process.env.NEXT_PUBLIC_TURSO_DATABASE_URL || "";
      const defaultToken = process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN || "";
      if (defaultUrl && defaultToken) {
        saveTursoConfig({ url: defaultUrl, authToken: defaultToken });
        const db = getClientDb();
        if (db) initClientTables(db).catch(console.error);
      } else {
        // 없으면 설정 모달 띄우기
        setShowConfigModal(true);
      }
    }

    loadSettings();
  }, [loadSettings]);

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

      {/* 메인 화면 영역 */}
      <main className="flex-1 px-4 py-6 md:py-8 max-w-6xl mx-auto w-full">
        {activeTab === "dashboard" && (
          <DashboardView
            onGoToNewOrder={() => handleTabChange("new-order")}
            onGoToShipments={() => handleTabChange("shipments")}
            onRequestConfig={() => setShowConfigModal(true)}
          />
        )}

        {activeTab === "new-order" && (
          <NewOrderView
            settings={settings}
            onOrderSaved={() => handleTabChange("dashboard")}
            onRequestConfig={() => setShowConfigModal(true)}
          />
        )}

        {activeTab === "shipments" && (
          <ShipmentView
            settings={settings}
            onRequestConfig={() => setShowConfigModal(true)}
          />
        )}

        {activeTab === "customers" && (
          <CustomerView onRequestConfig={() => setShowConfigModal(true)} />
        )}

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
            GitHub Pages 완전 무료 정적 PWA &middot; 클라이언트 직접 Turso DB 연동 &middot; 모바일 확대/축소 지원
          </p>
        </div>
      </footer>

      {/* Turso DB 연결 모달 */}
      <TursoConfigModal
        isOpen={showConfigModal}
        onConfigSaved={() => {
          setShowConfigModal(false);
          loadSettings();
        }}
        onClose={getStoredTursoConfig() ? () => setShowConfigModal(false) : undefined}
      />
    </div>
  );
}
