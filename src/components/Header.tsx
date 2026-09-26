"use client";

import React from "react";
import { Phone, Building2, Copy, Check } from "lucide-react";

interface HeaderProps {
  settings: {
    shop_name?: string;
    shop_phone?: string;
    bank_name?: string;
    bank_account?: string;
    owner_name?: string;
  };
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Header({ settings, activeTab, setActiveTab }: HeaderProps) {
  const [copied, setCopied] = React.useState(false);

  const shopName = settings.shop_name || "임실 절임배추";
  const shopPhone = settings.shop_phone || "010-0000-0000";
  const bankInfo = `${settings.bank_name || "농협"} ${settings.bank_account || "351-0000-0000-00"} (${settings.owner_name || "대표자"})`;

  const copyBank = () => {
    navigator.clipboard.writeText(bankInfo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: "dashboard", label: "오늘 출고 현황" },
    { id: "new-order", label: "새 주문 등록" },
    { id: "shipments", label: "출고·택배 관리" },
    { id: "customers", label: "고객 장부" },
    { id: "settings", label: "농가 정보·설정" },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* 실제 상호명 및 계좌/전화번호 안내 바 (시니어 고대비 & 큼직한 가독성) */}
      <div className="bg-slate-900 text-white px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm md:text-base">
          <div className="flex items-center gap-2 font-bold tracking-tight">
            <span className="text-emerald-400 font-extrabold text-lg md:text-xl">
              {shopName}
            </span>
            <span className="text-slate-400 text-xs md:text-sm">주문·출고 관리시스템</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm">
            {/* 대표 전화번호 연결 */}
            <a
              href={`tel:${shopPhone.replace(/[^0-9]/g, "")}`}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md font-semibold text-slate-100 transition-colors"
              title="터치 시 바로 전화 연결"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>전화 {shopPhone}</span>
            </a>

            {/* 입금 계좌정보 및 복사 */}
            <button
              onClick={copyBank}
              type="button"
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md font-semibold text-slate-100 transition-colors cursor-pointer"
              title="클릭 시 계좌번호 복사"
            >
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>계좌 {bankInfo}</span>
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>

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
