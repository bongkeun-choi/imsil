"use client";

import { LogOut } from "lucide-react";

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
  onExitClick?: () => void;
}

export function Header({
  settings,
  activeTab,
  setActiveTab,
  onExitClick,
}: HeaderProps) {
  const navItems = [
    { id: "dashboard", label: "당일현황" },
    { id: "calendar", label: "주문일정" },
    { id: "new-order", label: "주문 등록" },
    { id: "shipments", label: "발송·운송장 관리" },
    { id: "ledger", label: "관리" },
    { id: "settings", label: "설정" },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* 상단 브랜드 및 프로그램 종료 바 */}
      <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between border-b border-slate-100">
        <div
          onClick={() => setActiveTab("dashboard")}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <img
            src="./icons/icon-192.png"
            alt="배추 아이콘"
            className="w-8 h-8 rounded-full shadow-xs object-cover"
          />
          <div>
            <h1 className="text-base md:text-lg font-black text-emerald-800 leading-tight">
              {settings?.shop_name || "장모님 절임배추"}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              주문·출고·배송 통합 관리 시스템
            </p>
          </div>
        </div>

        {/* 프로그램 종료 버튼 */}
        {onExitClick && (
          <button
            onClick={onExitClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:text-red-600 hover:border-red-300 hover:bg-red-50 text-xs md:text-sm font-bold transition-colors cursor-pointer"
            title="프로그램 안전 종료"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">프로그램</span> 종료
          </button>
        )}
      </div>

      {/* 데스크톱/태블릿 메인 메뉴 네비게이션 */}
      <div className="hidden md:block max-w-6xl mx-auto px-2 md:px-4">
        <nav className="flex overflow-x-auto no-scrollbar gap-1 py-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-lg text-base md:text-lg font-bold transition-all cursor-pointer ${
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
