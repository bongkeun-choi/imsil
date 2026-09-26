"use client";

import React from "react";

interface HeaderProps {
  settings?: {
    shop_name?: string;
    shop_phone?: string;
    bank_name?: string;
    bank_account?: string;
    owner_name?: string;
  };
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Header({ activeTab, setActiveTab }: HeaderProps) {
  const navItems = [
    { id: "dashboard", label: "오늘 출고 현황" },
    { id: "calendar", label: "출고 달력" },
    { id: "new-order", label: "주문 등록" },
    { id: "shipments", label: "출고·택배 관리" },
    { id: "customers", label: "고객 장부" },
    { id: "settings", label: "농가 정보·설정" },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* 큼직한 메인 메뉴 네비게이션 (시니어 친화 터치 영역) */}
      <div className="max-w-6xl mx-auto px-2 md:px-4">
        <nav className="flex overflow-x-auto no-scrollbar gap-1 py-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap px-4 py-3 rounded-lg text-base md:text-lg font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
