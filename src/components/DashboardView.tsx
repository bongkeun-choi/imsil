"use client";

import React, { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";
import {
  fetchDashboardService,
  updateOrderActionService,
  fetchScheduleSummaryService,
  DayScheduleSummary,
  fetchOrderByIdService,
} from "@/lib/services";
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Calendar,
  CalendarDays,
  Sparkles,
  Share2,
  Edit3,
} from "lucide-react";
import { format, addDays, eachDayOfInterval, isSameDay } from "date-fns";
import { OrderShareModal } from "@/components/OrderShareModal";
import { OrderEditModal } from "@/components/OrderEditModal";
import { OrderCardData } from "@/lib/orderCardCanvas";
import { PhoneCallLink } from "@/components/PhoneCallLink";
import { parseExtraPhones } from "@/lib/orderShareMessage";

interface DashboardViewProps {
  onGoToNewOrder: () => void;
  onGoToSmartImport?: () => void;
  onGoToShipments: () => void;
  onGoToCalendar: () => void;
  onRequestConfig: () => void;
  settings?: any;
}

export function DashboardView({
  onGoToNewOrder,
  onGoToSmartImport,
  onGoToShipments,
  onGoToCalendar,
  onRequestConfig,
  settings,
}: DashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    return format(new Date(), "yyyy-MM-dd");
  });
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [sharingOrder, setSharingOrder] = useState<OrderCardData | null>(null);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);

  const handleOpenOrderEdit = async (ord: any) => {
    const qty20kg = ord.qty20kg || ord.quantity || (ord.items && ord.items[0]?.quantity) || 1;
    setEditingOrder({
      id: ord.id,
      customer_id: ord.customer_id,
      order_no: ord.order_no,
      customer_name: ord.customer_name,
      customer_phone: ord.customer_phone,
      shipping_date: ord.shipping_date || selectedDate,
      shipping_address: ord.shipping_address,
      shipping_address_detail: ord.shipping_address_detail || "",
      qty20kg: qty20kg,
      unit_price: 68000,
      total_amount: Number(ord.total_amount) || 68000 * qty20kg,
      payment_status: ord.payment_status || "UNPAID",
      memo: ord.memo || "",
      items: ord.items || [],
    });

    if (ord.id) {
      try {
        const fullDetail = await fetchOrderByIdService(ord.id);
        if (fullDetail) {
          const detailQty20 =
            (fullDetail.items && fullDetail.items[0]?.quantity) || qty20kg;
          setEditingOrder({
            id: fullDetail.id,
            customer_id: fullDetail.customer_id,
            order_no: fullDetail.order_no,
            customer_name: fullDetail.customer_name,
            customer_phone: fullDetail.customer_phone,
            shipping_date: fullDetail.shipping_date || selectedDate,
            shipping_address: fullDetail.shipping_address,
            shipping_address_detail: fullDetail.shipping_address_detail || "",
            qty20kg: detailQty20,
            unit_price: 68000,
            total_amount: Number(fullDetail.total_amount) || 68000 * detailQty20,
            payment_status: fullDetail.payment_status || "UNPAID",
            memo: fullDetail.memo || "",
            items: fullDetail.items || [],
          });
        }
      } catch (err) {
        console.error("대시보드 주문 상세 조회 에러:", err);
      }
    }
  };

  const handleOrderUpdated = (shareData?: OrderCardData) => {
    setEditingOrder(null);
    fetchDashboard(selectedDate);
    fetchWeekly();
    if (shareData) {
      setSharingOrder(shareData);
    }
  };

  const handleOrderDeleted = () => {
    setEditingOrder(null);
    fetchDashboard(selectedDate);
    fetchWeekly();
  };

  const handleOpenOrderShare = (ord: any) => {
    const shareData: OrderCardData = {
      orderNo: ord.order_no || "",
      customerName: ord.customer_name || "",
      customerPhone: ord.customer_phone || "",
      shippingDate: ord.shipping_date || selectedDate,
      shippingAddress: ord.shipping_address || "",
      shippingAddressDetail: ord.shipping_address_detail || "",
      itemsSummary: ord.items_summary || "절임배추",
      totalAmount: Number(ord.total_amount) || 0,
      paymentStatus: ord.payment_status || "UNPAID",
      memo: ord.memo || "",
      shopName: settings?.shop_name || "임실참배추농원",
      shopPhone: settings?.shop_phone || settings?.phone || "010-0000-0000",
      extraPhones: parseExtraPhones(settings?.extra_phones),
      shareMessageTemplate: settings?.share_message_template,
      bankName: settings?.bank_name || "농협",
      bankAccount: settings?.bank_account || "",
      ownerName: settings?.owner_name || "",
    };
    setSharingOrder(shareData);
  };

  // 이번 주 7일간 스케줄러 데이터
  const [weeklySchedule, setWeeklySchedule] = useState<
    Record<string, DayScheduleSummary>
  >({});

  const today = new Date();
  const next7Days = eachDayOfInterval({
    start: today,
    end: addDays(today, 6),
  });

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

  const fetchWeekly = async () => {
    try {
      const startStr = format(today, "yyyy-MM-dd");
      const endStr = format(addDays(today, 6), "yyyy-MM-dd");
      const res = await fetchScheduleSummaryService(startStr, endStr);
      setWeeklySchedule(res);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDashboard(selectedDate);
    fetchWeekly();
  }, [selectedDate]);

  // 원클릭 입금완료 처리
  const handleMarkPaid = async (orderId: number) => {
    if (!confirm("해당 주문을 입금 완료 처리하시겠습니까?")) return;
    setUpdatingId(orderId);
    try {
      await updateOrderActionService(orderId, "mark_paid");
      fetchDashboard(selectedDate);
      fetchWeekly();
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
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. 상단 날짜 및 바로가기 액션 바 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Calendar className="w-6 h-6 text-emerald-700 shrink-0" />
          <span className="text-xl md:text-2xl font-black text-slate-900">
            택배 도착 기준일:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-lg md:text-xl font-black border-2 border-emerald-500 rounded-lg px-3 py-2 bg-emerald-50/40 focus:border-emerald-700 focus:bg-white focus:outline-hidden"
          />
          <span className="text-xs md:text-sm font-bold text-slate-500">
            (소비자 배추 수령일 기준)
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchDashboard(selectedDate);
              fetchWeekly();
            }}
            className="p-3 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
            title="새로고침"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={onGoToNewOrder}
            className="btn-large px-6 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg cursor-pointer flex items-center gap-2 shadow-xs transition-colors"
          >
            <span className="text-xl font-black">+</span>
            <span className="font-bold text-lg">주문 등록</span>
          </button>
        </div>
      </div>

      {/* 2. 오늘 도착 절임배추 수량 요약 카드 & 발송 안내 */}
      <div className="bg-white rounded-xl border border-slate-300 p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="border-b border-slate-200 pb-2.5 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              {selectedDate} 택배 도착 현황
            </h2>
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
            총 {summary.totalOrders}건 도착 예정
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
          <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-3 sm:p-3.5 shadow-2xs">
            <div className="text-xs sm:text-sm font-bold text-emerald-900 mb-0.5">
              절임배추 20kg
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 stat-number">
              {summary.qty20kg} <span className="text-base sm:text-lg font-bold">박스</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 sm:p-3.5">
            <div className="text-xs sm:text-sm font-bold text-slate-700 mb-0.5">
              총 중량
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 stat-number">
              {summary.totalWeight} <span className="text-base sm:text-lg font-bold">kg</span>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-3 sm:p-3.5">
            <div className="text-xs sm:text-sm font-bold text-amber-900 mb-0.5">
              당일 미입금
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-800 stat-number">
              {summary.unpaidCount} <span className="text-base sm:text-lg font-bold">건</span>
            </div>
            <div className="text-xs font-semibold text-amber-700 mt-0.5">
              {formatPrice(summary.unpaidTotal)}
            </div>
          </div>
        </div>

        <div className="pt-1 flex flex-wrap justify-between items-center gap-2">
          <div className="text-xs sm:text-sm font-medium text-slate-600">
            💡 내일 도착할 배추는 오늘 우체국택배로 발송해야 합니다.
          </div>
          <button
            onClick={onGoToShipments}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
          >
            택배 발송 및 운송장 등록 바로가기 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. [신규 기능] 홈 화면 "이번 주 7일 택배 도착 스케줄러" 위젯 */}
      <div className="bg-white rounded-2xl border-2 border-emerald-300 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-emerald-700" />
            <h2 className="text-2xl font-black text-slate-900">
              이번 주 7일 택배 도착 스케줄러
            </h2>
          </div>

          <button
            onClick={onGoToCalendar}
            className="inline-flex items-center gap-1.5 text-base font-black text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
          >
            <span>주문일정 전체 보기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 font-semibold mb-3">
          날짜 카드를 누르면 해당 날짜의 택배 도착 현황과 주문 목록으로 즉시 전환됩니다:
        </p>

        {/* 7일간 카드 가로 스크롤/그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {next7Days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const isSelected = selectedDate === dateStr;
            const isToday = isSameDay(day, today);
            const sched = weeklySchedule[dateStr];
            const count = sched?.orderCount || 0;
            const dayName = dayNames[day.getDay()];

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[110px] ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-100/80 shadow-md ring-2 ring-emerald-500"
                    : count > 0
                    ? "border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100"
                    : "border-slate-200 bg-slate-50 hover:bg-white"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-sm font-black ${
                        day.getDay() === 0
                          ? "text-red-600"
                          : day.getDay() === 6
                          ? "text-blue-600"
                          : "text-slate-800"
                      }`}
                    >
                      {dayName} {format(day, "d")}일
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-black bg-slate-900 text-white px-1 py-0.5 rounded-sm">
                        오늘
                      </span>
                    )}
                  </div>

                  {count > 0 ? (
                    <div className="space-y-0.5 text-xs font-black">
                      <div className="text-emerald-950 font-black">20kg {sched.qty20kg}박스</div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 py-1 font-medium">
                      도착 없음
                    </div>
                  )}
                </div>

                {count > 0 && (
                  <div className="text-right text-xs font-black text-slate-800 border-t border-emerald-200 pt-1">
                    {count}건 ({sched.totalWeight}kg)
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. 미입금 확인 및 원클릭 입금 처리 카드 */}
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
                className="bg-amber-50/70 border border-amber-300 p-3"
              >
                {/* 고객 정보 행 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-slate-900">{ord.customer_name}</span>
                  <PhoneCallLink
                    phone={ord.customer_phone}
                    name={ord.customer_name}
                    showIcon
                    className="text-sm text-emerald-800 font-bold hover:underline"
                  />
                  <span className="text-sm font-extrabold text-amber-900 ml-auto">{formatPrice(ord.total_amount)}</span>
                </div>
                {/* 버튼 행 - 한 줄 유지 */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => handleOpenOrderShare(ord)}
                    className="shrink-0 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer flex items-center gap-1 font-bold text-sm transition-colors whitespace-nowrap"
                    title="입금 안내 문자/카톡 전송"
                  >
                    <Share2 className="w-3.5 h-3.5 text-amber-800" />
                    <span>문자·카톡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenOrderEdit(ord)}
                    className="shrink-0 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 cursor-pointer flex items-center gap-1 font-bold text-sm transition-colors whitespace-nowrap"
                    title="주문 정보 수정"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-700" />
                    <span>수정</span>
                  </button>
                  <button
                    onClick={() => handleMarkPaid(ord.id)}
                    disabled={updatingId === ord.id}
                    className="shrink-0 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer flex items-center gap-1.5 font-bold text-sm transition-colors whitespace-nowrap ml-auto"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{updatingId === ord.id ? "처리 중..." : "입금 완료"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. 선택된 일자 택배 도착 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-black text-slate-900">
            {selectedDate} 택배 도착 목록 ({orders.length}명)
          </h2>
        </div>

        {orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-lg">
            해당 날짜에 등록된 택배 도착 주문이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {orders.map((ord: any) => (
              <div key={ord.id} className="py-3 border-b border-slate-200 last:border-0">
                {/* 고객 정보 행 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-extrabold text-slate-900">{ord.customer_name}</span>
                  <PhoneCallLink
                    phone={ord.customer_phone}
                    name={ord.customer_name}
                    showIcon
                    className="text-sm text-emerald-800 font-bold hover:underline"
                  />
                  {ord.memo && (
                    <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 border border-rose-200">
                      메모: {ord.memo}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{ord.shipping_address} {ord.shipping_address_detail}</div>
                {/* 상태 + 버튼 행 - 한 줄 유지 */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto">
                  <span className={`shrink-0 px-2 py-0.5 text-xs font-bold ${
                    ord.payment_status === "PAID"
                      ? "bg-blue-100 text-blue-900 border border-blue-300"
                      : "bg-red-100 text-red-900 border border-red-300"
                  }`}>
                    {ord.payment_status === "PAID" ? "입금완료" : "미입금"}
                  </span>
                  <span className={`shrink-0 px-2 py-0.5 text-xs font-bold ${
                    ord.order_status === "PACKED" || ord.order_status === "SHIPPED"
                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      : "bg-slate-100 text-slate-800 border border-slate-300"
                  }`}>
                    {ord.order_status === "PACKED" ? "포장완료" : ord.order_status === "SHIPPED" ? "발송완료" : "포장대기"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenOrderShare(ord)}
                    className="shrink-0 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                    title="문자/카톡 발송"
                  >
                    <Share2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>문자·카톡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenOrderEdit(ord)}
                    className="shrink-0 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                    title="주문 정보 수정"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-700" />
                    <span>수정</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 주문 상세 수정 모달 */}
      {editingOrder && (
        <OrderEditModal
          order={editingOrder}
          isOpen={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          onOrderUpdated={handleOrderUpdated}
          onOrderDeleted={handleOrderDeleted}
          settings={settings}
        />
      )}

      {/* 주문 문자 / 카카오톡 전송 모달 */}
      {sharingOrder && (
        <OrderShareModal
          orderData={sharingOrder}
          isOpen={!!sharingOrder}
          onClose={() => setSharingOrder(null)}
          isNewOrder={false}
        />
      )}
    </div>
  );
}
