"use client";

import React from "react";
import { LogOut, X, CheckCircle2, ShieldCheck } from "lucide-react";
import { useBackButtonModal } from "@/lib/useBackButtonModal";

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
}

export function ExitConfirmModal({
  isOpen,
  onClose,
  onConfirmExit,
}: ExitConfirmModalProps) {
  // 모바일 뒤로가기 버튼 누르면 종료 모달이 닫히며 계속 사용 상태로 유지됨
  useBackButtonModal(isOpen, onClose, "exit-confirm-modal");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden transform animate-in zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="bg-emerald-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">프로그램 종료</h3>
              <p className="text-xs text-emerald-100">장모님 절임배추 주문출고관리</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 안내 */}
        <div className="p-6">
          <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800 leading-snug font-medium">
              모든 주문 및 고객 데이터가 안전하게 저장되어 있습니다. 언제든 다시 열어 확인하실 수 있습니다.
            </p>
          </div>

          <p className="text-base text-slate-800 text-center font-semibold mb-6">
            프로그램을 지금 종료하시겠습니까?
          </p>

          {/* 버튼 2개 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="py-3 px-4 rounded-xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-100 active:scale-98 transition-all"
            >
              계속 사용
            </button>
            <button
              onClick={onConfirmExit}
              className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              프로그램 종료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
