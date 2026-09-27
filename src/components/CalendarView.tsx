"use client";

import React, { useState, useEffect } from "react";
import { formatPrice } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Phone,
  Plus,
  X,
  Package,
  Share2,
  Edit3,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addWeeks,
  subWeeks,
} from "date-fns";
import {
  fetchScheduleSummaryService,
  DayScheduleSummary,
  fetchOrderByIdService,
} from "@/lib/services";
import { OrderShareModal } from "@/components/OrderShareModal";
import { OrderEditModal } from "@/components/OrderEditModal";
import { OrderCardData } from "@/lib/orderCardCanvas";
import { useBackButtonModal } from "@/lib/useBackButtonModal";
import { PhoneCallLink } from "@/components/PhoneCallLink";
import { parseExtraPhones } from "@/lib/orderShareMessage";

interface CalendarViewProps {
  onSelectDateForNewOrder: (dateStr: string) => void;
  settings?: any;
}

export function CalendarView({ onSelectDateForNewOrder, settings }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [showOrderListModal, setShowOrderListModal] = useState(false);
  const [sharingOrder, setSharingOrder] = useState<OrderCardData | null>(null);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [scheduleData, setScheduleData] = useState<
    Record<string, DayScheduleSummary>
  >({});
  const [loading, setLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState<"ALL" | "NORMAL" | "EVENT">("ALL");

  // 모바일 뒤로가기 버튼 시 날짜별 주문목록 팝업 닫기
  useBackButtonModal(
    showOrderListModal,
    () => setShowOrderListModal(false),
    "calendar-date-orders-modal"
  );

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

  const handleOpenOrderEdit = async (ord: any) => {
    // 날짜별 주문목록 팝업 모달이 열려있다면 즉시 닫기
    setShowOrderListModal(false);

    const isEvent = ord.order_type === "EVENT" || !!ord.event_name;
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
      order_type: ord.order_type || (isEvent ? "EVENT" : "NORMAL"),
      event_name: ord.event_name || (isEvent ? "임실 김치 축제" : ""),
    });

    if (ord.id) {
      try {
        const fullDetail = await fetchOrderByIdService(ord.id);
        if (fullDetail) {
          const detailQty20 =
            (fullDetail.items && fullDetail.items[0]?.quantity) || qty20kg;
          const fullIsEvent = fullDetail.order_type === "EVENT" || !!fullDetail.event_name;
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
            order_type: fullDetail.order_type || (fullIsEvent ? "EVENT" : "NORMAL"),
            event_name: fullDetail.event_name || (fullIsEvent ? "임실 김치 축제" : ""),
          });
        }
      } catch (err) {
        console.error("주문 상세 조회 에러:", err);
      }
    }
  };

  const handleOrderUpdated = (shareData?: OrderCardData) => {
    setEditingOrder(null);
    loadSchedule();
    if (shareData) {
      setSharingOrder(shareData);
    }
  };

  const handleOrderDeleted = () => {
    setEditingOrder(null);
    loadSchedule();
  };

  // 현재 월의 시작/끝 날짜 (달력 그리드용)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 일요일 시작
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // 주간 보기용 시작/끝 날짜
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // 월요일 시작
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // 데이터 조회 범위
  const queryStart =
    viewMode === "month"
      ? format(calendarStart, "yyyy-MM-dd")
      : format(weekStart, "yyyy-MM-dd");
  const queryEnd =
    viewMode === "month"
      ? format(calendarEnd, "yyyy-MM-dd")
      : format(weekEnd, "yyyy-MM-dd");

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const data = await fetchScheduleSummaryService(queryStart, queryEnd);
      setScheduleData(data);
    } catch (e) {
      console.error("스케줄 조회 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [queryStart, queryEnd]);

  // 이전/다음 이동
  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else {
      setCurrentDate((prev) => subWeeks(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(format(today, "yyyy-MM-dd"));
  };

  // 날짜 클릭 시 처리: 물량(주문)이 있으면 즉시 팝업 모달 노출!
  const handleDateClick = (dateStr: string, orderCount: number) => {
    setSelectedDate(dateStr);
    if (orderCount > 0) {
      setShowOrderListModal(true);
      if (typeof window !== "undefined") {
        window.history.pushState({ tab: "calendar", modal: "orders" }, "", "#calendar-orders");
      }
    }
  };

  const handleCloseModal = () => {
    setShowOrderListModal(false);
    if (typeof window !== "undefined" && window.location.hash === "#calendar-orders") {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      if (showOrderListModal && e.state?.modal !== "orders") {
        setShowOrderListModal(false);
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [showOrderListModal]);

  // 월간 달력 날짜 목록
  const daysInMonth = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // 주간 일정 날짜 목록 (7일)
  const daysInWeek = eachDayOfInterval({
    start: weekStart,
    end: weekEnd,
  });

  const selectedDaySummary = scheduleData[selectedDate] || {
    date: selectedDate,
    orderCount: 0,
    qty10kg: 0,
    qty20kg: 0,
    normalQty20kg: 0,
    eventQty20kg: 0,
    eventOrdersCount: 0,
    eventNames: [],
    totalWeight: 0,
    orders: [],
  };

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* 1. 상단 컨트롤 바 */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-7 h-7 text-emerald-700" />
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              {format(currentDate, "yyyy년 M월")} 주문일정
              {viewMode === "week" && ` (주간)`}
            </h1>

            <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1 bg-slate-50">
              <button
                onClick={handlePrev}
                className="p-2 hover:bg-slate-200 rounded-md cursor-pointer"
                title="이전"
              >
                <ChevronLeft className="w-5 h-5 text-slate-700" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 font-bold text-sm text-slate-800 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                오늘
              </button>
              <button
                onClick={handleNext}
                className="p-2 hover:bg-slate-200 rounded-md cursor-pointer"
                title="다음"
              >
                <ChevronRight className="w-5 h-5 text-slate-700" />
              </button>
            </div>
          </div>
          <p className="text-xs md:text-sm font-bold text-emerald-800 mt-1">
            고객 배추 수령(도착) 기준 일정입니다.
          </p>
        </div>

        {/* 월간 / 주간 보기 전환 탭 */}
        <div className="flex border-2 border-slate-300 rounded-xl p-1 bg-slate-100">
          <button
            onClick={() => setViewMode("month")}
            className={`px-5 py-2 rounded-lg font-black text-base cursor-pointer transition-all ${
              viewMode === "month"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            월간 달력
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`px-5 py-2 rounded-lg font-black text-base cursor-pointer transition-all ${
              viewMode === "week"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            주간 일정
          </button>
        </div>
      </div>

      {/* 2. 메인 스케줄러 뷰 */}
      {viewMode === "month" ? (
        /* ================= [월간 달력 보기] ================= */
        <div className="bg-white rounded-2xl border-2 border-slate-300 p-2 sm:p-4 md:p-6 shadow-sm w-full">
          {/* 요일 헤더 (일 ~ 토) */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 text-center mb-1.5 w-full">
            {dayNames.map((d, i) => (
              <div
                key={d}
                className={`py-1 md:py-2 text-sm md:text-lg font-black ${
                  i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : "text-slate-800"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 달력 날짜 그리드 (모바일 화면 폭 100% 맞춤) */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 w-full">
            {daysInMonth.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDate === dateStr;
              const isToday = isSameDay(day, new Date());
              const summary = scheduleData[dateStr];
              const hasOrders = summary && summary.orderCount > 0;

              return (
                <div
                  key={dateStr}
                  onClick={() => handleDateClick(dateStr, summary?.orderCount || 0)}
                  className={`min-h-[72px] sm:min-h-[85px] md:min-h-[110px] p-1 md:p-2 rounded-lg md:rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50 shadow-md ring-2 ring-emerald-500"
                      : hasOrders
                      ? "border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50"
                      : isCurrentMonth
                      ? "border-slate-200 bg-white hover:bg-slate-50"
                      : "border-slate-100 bg-slate-50 opacity-30"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span
                      className={`text-xs sm:text-sm md:text-lg font-black ${
                        isToday
                          ? "bg-slate-900 text-white w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[10px] md:text-sm"
                          : day.getDay() === 0
                          ? "text-red-600"
                          : day.getDay() === 6
                          ? "text-blue-600"
                          : "text-slate-900"
                      }`}
                    >
                      {format(day, "d")}
                    </span>

                    {hasOrders && (
                      <span className="text-[10px] md:text-xs font-black bg-slate-800 text-white px-1 py-0.2 md:px-1.5 md:py-0.5 rounded-xs">
                        {summary.orderCount}건
                      </span>
                    )}
                  </div>

                  {/* 물량 요약 (20kg 중심 + 행사/축제 분리) */}
                  {hasOrders ? (
                    <div className="space-y-0.5 md:space-y-1 my-0.5 md:my-1 text-[10px] sm:text-xs md:text-sm font-black leading-tight">
                      {summary.qty20kg > 0 ? (
                        summary.eventQty20kg && summary.eventQty20kg > 0 ? (
                          <div className="space-y-0.5">
                            {(summary.normalQty20kg ?? 0) > 0 && (
                              <div className="bg-emerald-100 text-emerald-900 px-1 py-0.2 md:px-1.5 md:py-0.5 rounded-xs truncate">
                                일반: {summary.normalQty20kg}박스
                              </div>
                            )}
                            <div className="bg-purple-100 text-purple-900 border border-purple-300 px-1 py-0.2 md:px-1.5 md:py-0.5 rounded-xs truncate font-black flex items-center gap-0.5" title={`${summary.eventNames?.join(", ") || "임실 김치 축제"} 납품`}>
                              <span className="text-[10px]">🎪</span>
                              <span>축제: {summary.eventQty20kg}박스</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-emerald-100 text-emerald-900 px-1 py-0.2 md:px-1.5 md:py-0.5 rounded-xs truncate">
                            20k: {summary.qty20kg}박스
                          </div>
                        )
                      ) : summary.qty10kg > 0 ? (
                        <div className="bg-slate-100 text-slate-800 px-1 py-0.2 md:px-1.5 md:py-0.5 rounded-xs truncate">
                          {summary.totalWeight}kg
                        </div>
                      ) : (
                        <div className="bg-emerald-100 text-emerald-900 px-1 py-0.2 md:px-1.5 md:py-0.5 rounded-xs truncate">
                          도착 {summary.orderCount}건
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] md:text-xs text-slate-300 font-medium py-1 hidden sm:block">
                      도착없음
                    </div>
                  )}

                  {hasOrders && (
                    <div className="text-right text-[10px] md:text-xs font-extrabold text-slate-700 stat-number">
                      {summary.totalWeight}kg
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================= [주간 일정 보기] ================= */
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {daysInWeek.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const isSelected = selectedDate === dateStr;
            const isToday = isSameDay(day, new Date());
            const summary = scheduleData[dateStr];
            const hasOrders = summary && summary.orderCount > 0;
            const dayOfWeekName = dayNames[day.getDay()];

            return (
              <div
                key={dateStr}
                onClick={() => handleDateClick(dateStr, summary?.orderCount || 0)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50 shadow-md ring-2 ring-emerald-500"
                    : hasOrders
                    ? "border-emerald-300 bg-white hover:bg-emerald-50/50"
                    : "border-slate-200 bg-slate-50/70 hover:bg-white"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                    <span
                      className={`text-xl font-black ${
                        day.getDay() === 0
                          ? "text-red-600"
                          : day.getDay() === 6
                          ? "text-blue-600"
                          : "text-slate-900"
                      }`}
                    >
                      {dayOfWeekName}요일
                    </span>
                    <span
                      className={`text-base font-bold ${
                        isToday
                          ? "bg-slate-900 text-white px-2 py-0.5 rounded-full text-xs"
                          : "text-slate-600"
                      }`}
                    >
                      {format(day, "M/d")}
                    </span>
                  </div>

                  {hasOrders ? (
                    <div className="space-y-2 mb-4">
                      <div className="text-center py-2 bg-emerald-100 rounded-xl">
                        <div className="text-xs text-emerald-800 font-bold">
                          택배 도착 건수
                        </div>
                        <div className="text-2xl font-black text-emerald-950">
                          {summary.orderCount}건
                        </div>
                      </div>

                      <div className="text-sm font-black space-y-1">
                        {summary.eventQty20kg && summary.eventQty20kg > 0 ? (
                          <>
                            <div className="flex justify-between text-emerald-900">
                              <span>일반 20kg:</span>
                              <span>{summary.normalQty20kg ?? 0}박스</span>
                            </div>
                            <div className="flex justify-between text-purple-900 font-black bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                              <span className="flex items-center gap-1">🎪 축제 납품:</span>
                              <span>{summary.eventQty20kg}박스</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-emerald-900">
                            <span>절임배추 20kg:</span>
                            <span>{summary.qty20kg}박스</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1">
                          <span>총 중량:</span>
                          <span>{summary.totalWeight}kg</span>
                        </div>
                      </div>

                      {/* 고객 이름 요약 */}
                      <div className="border-t border-slate-200 pt-2 text-xs text-slate-600 space-y-0.5">
                        {summary.orders.slice(0, 3).map((o: any) => (
                          <div key={o.id} className="truncate font-semibold">
                            &middot; {o.customer_name}
                          </div>
                        ))}
                        {summary.orders.length > 3 && (
                          <div className="text-slate-400 font-bold">
                            외 {summary.orders.length - 3}명
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 text-sm font-semibold">
                      도착 일정 없음
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDateForNewOrder(dateStr);
                  }}
                  className="w-full mt-2 py-2 bg-white hover:bg-emerald-700 hover:text-white text-emerald-800 border border-emerald-600 rounded-xl text-xs font-black transition-colors"
                >
                  + 주문 추가
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. 선택된 일자 상세 도착 목록 (달력 바로 아래 즉시 노출) */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">
              {selectedDate} 택배 도착 상세 ({selectedDaySummary.orderCount}건)
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-base text-slate-600 font-bold mt-1">
              <span>절임배추 20kg: <span className="text-emerald-800 font-black">{selectedDaySummary.normalQty20kg ?? selectedDaySummary.qty20kg}박스</span></span>
              {(selectedDaySummary.eventQty20kg ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full text-xs font-black">
                  <span>🎪</span>
                  <span>{selectedDaySummary.eventNames?.join(", ") || "임실 김치 축제"}: {selectedDaySummary.eventQty20kg}박스 ({selectedDaySummary.eventOrdersCount}건)</span>
                </span>
              )}
              <span>(총 {selectedDaySummary.totalWeight}kg)</span>
            </div>
          </div>

          <button
            onClick={() => onSelectDateForNewOrder(selectedDate)}
            className="btn-large px-6 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black cursor-pointer flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>이 날짜 도착으로 새 주문 등록</span>
          </button>
        </div>

        {/* 축제 주문이 있을 경우 필터 탭 */}
        {(selectedDaySummary.eventOrdersCount ?? 0) > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
            <button
              type="button"
              onClick={() => setOrderFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                orderFilter === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              전체 ({selectedDaySummary.orderCount}건)
            </button>
            <button
              type="button"
              onClick={() => setOrderFilter("NORMAL")}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                orderFilter === "NORMAL"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              일반 택배 ({selectedDaySummary.orderCount - (selectedDaySummary.eventOrdersCount ?? 0)}건)
            </button>
            <button
              type="button"
              onClick={() => setOrderFilter("EVENT")}
              className={`px-3 py-1.5 rounded-lg text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                orderFilter === "EVENT"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "bg-purple-100 text-purple-900 hover:bg-purple-200 border border-purple-300"
              }`}
            >
              <span>🎪</span>
              <span>행사 납품 ({selectedDaySummary.eventOrdersCount}건 &middot; {selectedDaySummary.eventQty20kg}박스)</span>
            </button>
          </div>
        )}

        {selectedDaySummary.orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-lg font-bold">
            선택하신 날짜({selectedDate})에는 등록된 택배 도착 예약이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {selectedDaySummary.orders
              .filter((ord: any) => {
                const isEv = ord.order_type === "EVENT" || !!ord.event_name;
                if (orderFilter === "NORMAL") return !isEv;
                if (orderFilter === "EVENT") return isEv;
                return true;
              })
              .map((ord: any) => {
                const isEvent = ord.order_type === "EVENT" || !!ord.event_name;
                return (
                  <div
                    key={ord.id}
                    className={`py-3 border-b border-slate-200 last:border-0 rounded-xl px-2 transition-colors ${
                      isEvent ? "bg-purple-50/40 border-purple-200" : ""
                    }`}
                  >
                    {/* 고객 정보 행 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEvent && (
                        <span className="shrink-0 px-2 py-0.5 text-xs font-black bg-purple-100 text-purple-900 border border-purple-300 rounded-md inline-flex items-center gap-1">
                          <span>🎪</span>
                          <span>{ord.event_name || "임실 김치 축제"}</span>
                        </span>
                      )}
                      <span className="text-lg font-extrabold text-slate-900">{ord.customer_name}</span>
                      <PhoneCallLink
                        phone={ord.customer_phone}
                        name={ord.customer_name}
                        showIcon
                        className="text-sm text-emerald-800 font-bold hover:underline inline-flex items-center gap-1"
                      />
                      <span className="text-sm font-black text-slate-900 ml-auto stat-number">{formatPrice(ord.total_amount)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {isEvent ? (ord.shipping_address ? `납품위치: ${ord.shipping_address}` : "🎪 행사 현장 직접 납품 (택배 없음)") : (ord.shipping_address || "주소 미입력")}
                    </div>
                    {/* 상태 + 버튼 행 - 한 줄 유지 */}
                    <div className="flex items-center gap-1.5 mt-2 overflow-x-auto whitespace-nowrap">
                      <span className={`shrink-0 px-2 py-0.5 text-xs font-bold ${
                        ord.payment_status === "PAID"
                          ? "bg-blue-100 text-blue-900 border border-blue-300"
                          : "bg-red-100 text-red-900 border border-red-300"
                      }`}>
                        {ord.payment_status === "PAID" ? "입금완료" : "미입금"}
                      </span>
                      <span className={`shrink-0 px-2 py-0.5 text-xs font-bold ${
                        ord.order_status === "SHIPPED"
                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                          : ord.order_status === "PACKED"
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-slate-100 text-slate-800 border border-slate-300"
                      }`}>
                        {ord.order_status === "SHIPPED" ? "발송완료" : ord.order_status === "PACKED" ? "포장완료" : "포장대기"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenOrderShare(ord)}
                        className="shrink-0 inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                        title="카톡·문자 안내장 보내기"
                      >
                        <Share2 className="w-3.5 h-3.5 text-amber-700" />
                        <span>문자·카톡</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenOrderEdit(ord)}
                        className="shrink-0 inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                        title="주문 정보 수정"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-700" />
                        <span>수정</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 4. 출고 물량 상세 팝업 모달 (날짜 클릭 시 물량이 있으면 즉시 팝업 노출) */}
      {showOrderListModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 md:p-6 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={handleCloseModal}
        >
          <div
            className="max-w-2xl w-full bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-slate-300 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="bg-slate-900 text-white p-4 md:p-6 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-xl md:text-2xl font-black">
                    {selectedDate} 택배 도착 목록
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs md:text-sm font-bold">
                  <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">
                    총 {selectedDaySummary.orderCount}건 도착
                  </span>
                  <span className="bg-slate-800 text-emerald-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                    일반 20kg: {selectedDaySummary.normalQty20kg ?? selectedDaySummary.qty20kg}박스
                  </span>
                  {(selectedDaySummary.eventQty20kg ?? 0) > 0 && (
                    <span className="bg-purple-900 text-purple-200 border border-purple-400 px-2.5 py-0.5 rounded-full font-black flex items-center gap-1">
                      <span>🎪</span>
                      <span>{selectedDaySummary.eventNames?.join(", ") || "축제"}: {selectedDaySummary.eventQty20kg}박스</span>
                    </span>
                  )}
                  <span className="bg-slate-800 text-amber-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                    총 {selectedDaySummary.totalWeight}kg
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                title="닫기"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 모달 내 축제 필터 탭 */}
            {(selectedDaySummary.eventOrdersCount ?? 0) > 0 && (
              <div className="px-4 md:px-6 pt-3 pb-1 border-b border-slate-200 bg-slate-50 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setOrderFilter("ALL")}
                  className={`px-3 py-1 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
                    orderFilter === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300"
                  }`}
                >
                  전체 ({selectedDaySummary.orderCount}건)
                </button>
                <button
                  type="button"
                  onClick={() => setOrderFilter("NORMAL")}
                  className={`px-3 py-1 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
                    orderFilter === "NORMAL"
                      ? "bg-emerald-700 text-white"
                      : "bg-white text-emerald-800 hover:bg-emerald-50 border border-slate-300"
                  }`}
                >
                  일반 택배 ({selectedDaySummary.orderCount - (selectedDaySummary.eventOrdersCount ?? 0)}건)
                </button>
                <button
                  type="button"
                  onClick={() => setOrderFilter("EVENT")}
                  className={`px-3 py-1 rounded-lg text-xs md:text-sm font-black transition-all cursor-pointer flex items-center gap-1 ${
                    orderFilter === "EVENT"
                      ? "bg-purple-700 text-white"
                      : "bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-300"
                  }`}
                >
                  <span>🎪 행사 납품 ({selectedDaySummary.eventOrdersCount}건)</span>
                </button>
              </div>
            )}

            {/* 모달 본문 (주문 리스트) */}
            <div className="p-4 md:p-6 overflow-y-auto divide-y divide-slate-200 flex-1 space-y-4">
              {selectedDaySummary.orders
                .filter((ord: any) => {
                  const isEv = ord.order_type === "EVENT" || !!ord.event_name;
                  if (orderFilter === "NORMAL") return !isEv;
                  if (orderFilter === "EVENT") return isEv;
                  return true;
                })
                .map((ord: any) => {
                  const isEvent = ord.order_type === "EVENT" || !!ord.event_name;
                  return (
                <div
                  key={ord.id}
                  className={`pt-3 first:pt-0 space-y-2 p-3 rounded-2xl transition-colors cursor-pointer border ${
                    isEvent
                      ? "bg-purple-50/60 border-purple-300 hover:bg-purple-100/60"
                      : "hover:bg-slate-50 border-transparent hover:border-slate-200"
                  }`}
                  onClick={() => handleOpenOrderEdit(ord)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEvent && (
                        <span className="shrink-0 px-2 py-0.5 text-xs font-black bg-purple-100 text-purple-900 border border-purple-300 rounded-md inline-flex items-center gap-1">
                          <span>🎪</span>
                          <span>{ord.event_name || "임실 김치 축제"}</span>
                        </span>
                      )}
                      <span className="text-lg md:text-xl font-black text-slate-900">
                        {ord.customer_name}
                      </span>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm md:text-base text-emerald-700 font-bold inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                      >
                        <PhoneCallLink
                          phone={ord.customer_phone}
                          name={ord.customer_name}
                          showIcon
                          className="text-emerald-700 font-bold hover:underline"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenOrderShare(ord);
                        }}
                        className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md text-xs font-bold cursor-pointer transition-colors"
                        title="카톡·문자 안내장 보내기"
                      >
                        <Share2 className="w-3.5 h-3.5 text-amber-700" />
                        <span>문자·카톡</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenOrderEdit(ord);
                        }}
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg text-xs md:text-sm font-bold cursor-pointer transition-colors shadow-xs"
                        title="주문 정보 수정"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-white" />
                        <span>주문 수정</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          ord.payment_status === "PAID"
                            ? "bg-blue-100 text-blue-900 border border-blue-300"
                            : "bg-red-100 text-red-900 border border-red-300"
                        }`}
                      >
                        {ord.payment_status === "PAID" ? "입금완료" : "미입금"}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          ord.order_status === "SHIPPED"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : ord.order_status === "PACKED"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-slate-100 text-slate-800 border border-slate-300"
                        }`}
                      >
                        {ord.order_status === "SHIPPED"
                          ? "발송완료"
                          : ord.order_status === "PACKED"
                          ? "포장완료"
                          : "포장대기"}
                      </span>
                      <span className="text-sm md:text-base font-black text-slate-900 ml-1">
                        {formatPrice(ord.total_amount)}
                      </span>
                    </div>
                  </div>

                  {/* 배송지 & 품목 요약 */}
                  <div className="text-sm md:text-base text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="font-semibold">
                      <span className="text-slate-500 font-normal mr-1.5">{isEvent ? "납품장소:" : "배송지:"}</span>
                      {isEvent ? (ord.shipping_address || "🎪 행사 현장 직접 납품 (택배 없음)") : (ord.shipping_address || "주소 미입력")}
                    </div>
                    {ord.items_summary && (
                      <div className="mt-1 font-bold text-emerald-900">
                        <span className="text-slate-500 font-normal mr-1.5">품목:</span>
                        {ord.items_summary}
                      </div>
                    )}
                  </div>
                </div>
                  );
                })}
            </div>

            {/* 모달 하단 버튼 바 */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  handleCloseModal();
                  onSelectDateForNewOrder(selectedDate);
                }}
                className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-base md:text-lg font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>+ 이 날짜 도착으로 주문 추가 등록</span>
              </button>

              <button
                type="button"
                onClick={handleCloseModal}
                className="py-3 px-6 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-base font-bold cursor-pointer transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
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

      {/* 주문 수정 모달 */}
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
    </div>
  );
}
