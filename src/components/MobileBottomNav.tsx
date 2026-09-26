"use client";

import React from "react";
import {
  Home,
  Calendar,
  PlusCircle,
  Truck,
  Settings,
  Users,
} from "lucide-react";

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExitClick: () => void;
}

export function MobileBottomNav({
  activeTab,
  setActiveTab,
  onExitClick,
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: "dashboard",
      label: "홈",
      icon: Home,
    },
    {
      id: "calendar",
      label: "도착달력",
      icon: Calendar,
    },
    {
      id: "new-order",
      label: "주문등록",
      icon: PlusCircle,
      isCenter: true,
    },
    {
      id: "shipments",
      label: "발송관리",
      icon: Truck,
    },
    {
      id: "settings",
      label: "설정·더보기",
      icon: Settings,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 pb-safe">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center -mt-5 group"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    isActive
                      ? "bg-emerald-700 text-white ring-4 ring-emerald-100"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  <Icon className="w-8 h-8" />
                </div>
                <span
                  className={`text-[11px] font-bold mt-1 ${
                    isActive ? "text-emerald-700 font-extrabold" : "text-slate-600"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive
                  ? "text-emerald-700 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
