"use client";

import React, { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";
import { fetchDashboardService, updateOrderActionService } from "@/lib/services";
import { CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Calendar } from "lucide-react";

interface DashboardViewProps {
  onGoToNewOrder: () => void;
  onGoToShipments: () => void;
  onRequestConfig: () => void;
}

export function DashboardView({
  onGoToNewOrder,
  onGoToShipments,
  onRequestConfig,
}: DashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchDashboard = async (dateStr: string) => {
    setLoading(true);
    try {
      const res = await fetchDashboardService(dateStr);
      setData(res);
    } catch (e: any) {
      if (e.message === "DB_NOT_CONFIGURED") {
        onRequestConfig();
      } else {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(selectedDate);
  }, [selectedDate]);

  // 원클릭 입금완료 처리
  const handleMarkPaid = async (orderId: number) => {
    if (!confirm("해당 주문을 입금 완료 처리하시겠습니까?")) return;
    setUpdatingId(orderId);
    try {
      await updateOrderActionService(orderId, "mark_paid");
      fetchDashboard(selectedDate);
    } catch (e) {
      alert("입금 처리에 실패했습니다.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-20 text-center">
        <p className="text-xl font-bold text-slate-700">현황을 불러오는 중입니다...</p>
      </div>
    );
  }

  const summary = data?.summary || {
    totalOrders: 0,
    totalWeight: 0,
    qty10kg: 0,
    qty20kg: 0,
    unpaidCount: 0,
    unpaidTotal: 0,
  };

  const orders = data?.orders || [];
  const unpaidOrders = orders.filter((o: any) => o.payment_status !== "PAID");

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. 상단 날짜 및 바로가기 액션 바 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-slate-700" />
          <span className="text-xl md:text-2xl font-extrabold text-slate-900">
            출고 기준일:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-lg md:text-xl font-bold border-2 border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => fetchDashboard(selectedDate)}
            className="p-3 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
            title="새로고침"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={onGoToNewOrder}
            className="btn-large px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer flex items-center gap-2 shadow-xs transition-colors"
          >
            <span className="text-xl font-black">+</span> 새 주문 등록
          </button>
        </div>
      </div>

      {/* 2. 오늘 보낼 절임배추 수량 요약 카드 */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm">
        <div className="border-b border-slate-200 pb-3 mb-5 flex justify-between items-center">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">
            오늘 보낼 절임배추
          </h2>
          <span className="text-base md:text-lg font-bold text-slate-600">
            총 {summary.totalOrders}건 출고 예정
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5">
            <div className="text-lg md:text-xl font-extrabold text-emerald-900 mb-1">
              절임배추 10kg
            </div>
            <div className="text-4xl md:text-5xl font-black text-emerald-700 stat-number">
              {summary.qty10kg} <span className="text-2xl font-bold">박스</span>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-5">
            <div className="text-lg md:text-xl font-extrabold text-blue-900 mb-1">
              절임배추 20kg
            </div>
            <div className="text-4xl md:text-5xl font-black text-blue-700 stat-number">
              {summary.qty20kg} <span className="text-2xl font-bold">박스</span>
            </div>
          </div>

          <div className="bg-slate-100 border-2 border-slate-300 rounded-xl p-5">
            <div className="text-lg md:text-xl font-extrabold text-slate-800 mb-1">
              오늘 총 중량
            </div>
            <div className="text-4xl md:text-5xl font-black text-slate-900 stat-number">
              {summary.totalWeight} <span className="text-2xl font-bold">kg</span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200 text-right">
          <button
            onClick={onGoToShipments}
            className="inline-flex items-center gap-2 text-lg font-bold text-emerald-800 hover:text-emerald-900 hover:underline cursor-pointer"
          >
            포장 및 택배 운송장 등록하러 가기 <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 3. 미입금 확인 및 원클릭 입금 처리 카드 */}
      <div className="bg-white rounded-2xl border-2 border-amber-300 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-7 h-7 text-amber-600" />
            <h2 className="text-2xl font-black text-slate-900">
              미입금 확인
            </h2>
          </div>
          <div className="text-xl md:text-2xl font-black text-amber-800">
            총 미입금: {formatPrice(summary.unpaidTotal)} ({summary.unpaidCount}건)
          </div>
        </div>

        {unpaidOrders.length === 0 ? (
          <div className="p-6 bg-amber-50 rounded-xl text-center text-slate-700 text-lg font-semibold">
            현재 확인된 당일 미입금 내역이 없습니다. (모두 입금 완료)
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-base text-slate-600 font-medium">
              통장에 돈이 들어왔으면 아래 <strong>[입금 완료]</strong> 버튼을 누르면 즉시 완료 처리됩니다:
            </p>
            {unpaidOrders.map((ord: any) => (
              <div
                key={ord.id}
                className="bg-amber-50/70 border border-amber-300 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <span>{ord.customer_name}</span>
                    <span className="text-base text-slate-600 font-normal">
                      ({ord.customer_phone})
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-amber-900 mt-1">
                    주문금액: {formatPrice(ord.total_amount)}
                  </div>
                </div>

                <button
                  onClick={() => handleMarkPaid(ord.id)}
                  disabled={updatingId === ord.id}
                  className="btn-large px-6 bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer flex items-center gap-2 font-bold shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{updatingId === ord.id ? "처리 중..." : "입금 완료"}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. 오늘 출고 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-black text-slate-900">
            오늘 출고 목록 ({orders.length}명)
          </h2>
        </div>

        {orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-lg">
            해당 날짜에 등록된 출고 주문이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {orders.map((ord: any) => (
              <div key={ord.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-extrabold text-slate-900">
                      {ord.customer_name}
                    </span>
                    <a
                      href={`tel:${ord.customer_phone.replace(/[^0-9]/g, "")}`}
                      className="text-base text-emerald-800 font-bold hover:underline"
                    >
                      {ord.customer_phone}
                    </a>
                  </div>
                  <div className="text-base text-slate-700 mt-1">
                    배송지: {ord.shipping_address} {ord.shipping_address_detail}
                  </div>
                  {ord.memo && (
                    <div className="text-sm font-semibold text-rose-700 mt-0.5">
                      메모: {ord.memo}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-base font-bold ${
                      ord.payment_status === "PAID"
                        ? "bg-blue-100 text-blue-900 border border-blue-300"
                        : "bg-red-100 text-red-900 border border-red-300"
                    }`}
                  >
                    {ord.payment_status === "PAID" ? "입금완료" : "미입금"}
                  </span>

                  <span
                    className={`px-3 py-1 rounded-full text-base font-bold ${
                      ord.order_status === "PACKED" || ord.order_status === "SHIPPED"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-slate-100 text-slate-800 border border-slate-300"
                    }`}
                  >
                    {ord.order_status === "PACKED"
                      ? "포장완료"
                      : ord.order_status === "SHIPPED"
                      ? "발송완료"
                      : "포장대기"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
