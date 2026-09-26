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
} from "@/lib/services";

interface CalendarViewProps {
  onSelectDateForNewOrder: (dateStr: string) => void;
}

export function CalendarView({ onSelectDateForNewOrder }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [scheduleData, setScheduleData] = useState<
    Record<string, DayScheduleSummary>
  >({});
  const [loading, setLoading] = useState(false);

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
    totalWeight: 0,
    orders: [],
  };

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* 1. 상단 컨트롤 바 */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-7 h-7 text-emerald-700" />
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">
            {format(currentDate, "yyyy년 M월")}
            {viewMode === "week" && ` (주간 일정)`}
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
                  onClick={() => setSelectedDate(dateStr)}
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

                  {/* 물량 요약 (10kg / 20kg) */}
                  {hasOrders ? (
                    <div className="space-y-0.5 md:space-y-1 my-0.5 md:my-1 text-[10px] sm:text-xs md:text-sm font-black leading-tight">
                      {summary.qty10kg > 0 && (
                        <div className="bg-emerald-100 text-emerald-900 px-1 py-0.2 md:px-1.5 md:py-0.5 rounded-xs truncate">
                          10k: {summary.qty10kg}개
                        </div>
                      )}
                      {summary.qty20kg > 0 && (
                        <div className="bg-blue-100 text-blue-900 px-1 py-0.2 md:px-1.5 md:py-0.5 rounded-xs truncate">
                          20k: {summary.qty20kg}개
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] md:text-xs text-slate-300 font-medium py-1 hidden sm:block">
                      출고없음
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
                onClick={() => setSelectedDate(dateStr)}
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
                          총 출고 건수
                        </div>
                        <div className="text-2xl font-black text-emerald-950">
                          {summary.orderCount}건
                        </div>
                      </div>

                      <div className="text-sm font-black space-y-1">
                        <div className="flex justify-between text-emerald-800">
                          <span>10kg:</span>
                          <span>{summary.qty10kg}개</span>
                        </div>
                        <div className="flex justify-between text-blue-800">
                          <span>20kg:</span>
                          <span>{summary.qty20kg}개</span>
                        </div>
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
                      출고 일정 없음
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

      {/* 3. 선택된 일자 상세 출고 목록 (달력 바로 아래 즉시 노출) */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">
              {selectedDate} 출고 상세 ({selectedDaySummary.orderCount}건)
            </h2>
            <p className="text-base text-slate-600 font-bold mt-1">
              10kg: {selectedDaySummary.qty10kg}개 &middot; 20kg:{" "}
              {selectedDaySummary.qty20kg}개 &middot; 총 중량:{" "}
              {selectedDaySummary.totalWeight}kg
            </p>
          </div>

          <button
            onClick={() => onSelectDateForNewOrder(selectedDate)}
            className="btn-large px-6 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black cursor-pointer flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>이 날짜로 새 주문 등록</span>
          </button>
        </div>

        {selectedDaySummary.orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-lg font-bold">
            선택하신 날짜({selectedDate})에는 등록된 출고 예약이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {selectedDaySummary.orders.map((ord: any) => (
              <div
                key={ord.id}
                className="py-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-extrabold text-slate-900">
                      {ord.customer_name}
                    </span>
                    <a
                      href={`tel:${ord.customer_phone.replace(/[^0-9]/g, "")}`}
                      className="text-base text-emerald-800 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{ord.customer_phone}</span>
                    </a>
                  </div>
                  <div className="text-base text-slate-700 mt-1">
                    배송지: {ord.shipping_address}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold ${
                      ord.payment_status === "PAID"
                        ? "bg-blue-100 text-blue-900 border border-blue-300"
                        : "bg-red-100 text-red-900 border border-red-300"
                    }`}
                  >
                    {ord.payment_status === "PAID" ? "입금완료" : "미입금"}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold ${
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
                  <span className="text-base font-black text-slate-900 stat-number">
                    {formatPrice(ord.total_amount)}
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
