"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatPrice, formatPhone } from "@/lib/utils";
import {
  Search, RefreshCw, Users, ShoppingBag, ChevronDown, ChevronUp,
  Edit3, Trash2, Phone, X, CheckCircle2, AlertCircle, Save,
  TrendingUp, TrendingDown, DollarSign, Package, Calendar,
} from "lucide-react";
import { format, subDays, addDays, startOfYear, endOfYear } from "date-fns";
import {
  fetchAllOrdersService,
  fetchCustomersService,
  fetchCustomerDetailService,
  updateOrderDetailService,
  deleteOrderService,
  updateCustomerService,
  deleteCustomerService,
} from "@/lib/services";
import { OrderEditModal } from "@/components/OrderEditModal";
import { OrderCardData } from "@/lib/orderCardCanvas";
import { PhoneCallLink } from "@/components/PhoneCallLink";
import { CustomerView } from "@/components/CustomerView";

interface LedgerViewProps {
  settings?: any;
  onRequestConfig: () => void;
  onSelectCustomerForOrder?: (customer: any, address?: any) => void;
}

type LedgerTab = "sales" | "customers";

// ──────────────────────────────────────────────
// 고객 수정 모달
// ──────────────────────────────────────────────
function CustomerEditModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer.name || "");
  const [phone, setPhone] = useState(formatPhone(customer.phone || ""));
  const [address, setAddress] = useState(customer.address || "");
  const [addressDetail, setAddressDetail] = useState(customer.address_detail || "");
  const [memo, setMemo] = useState(customer.memo || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      setError("이름과 전화번호는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      await updateCustomerService({ id: customer.id, name, phone, address, address_detail: addressDetail, memo });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || "저장 오류");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
          <h3 className="font-black text-lg">고객 정보 수정</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="text-red-600 text-sm font-bold bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">이름 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-slate-300 px-3 py-2 text-base font-bold focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">전화번호 *</label>
            <input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="w-full border-2 border-slate-300 px-3 py-2 text-base font-bold focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">주소</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border-2 border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none mb-1" placeholder="기본 주소" />
            <input value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} className="w-full border-2 border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="상세 주소" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">메모</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} className="w-full border-2 border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? "저장 중..." : "저장"}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 border-2 border-slate-300 text-slate-700 font-bold cursor-pointer hover:bg-slate-50">취소</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 판매 리스트 탭
// ──────────────────────────────────────────────
function SalesListTab({ settings }: { settings?: any }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [paidSales, setPaidSales] = useState(0);
  const [unpaidSales, setUnpaidSales] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<"ALL" | "CUSTOMER" | "PHONE" | "ADDRESS">("ALL");

  // 현재 날짜 기준 일주일 기본 설정 (택배 도착일 기준)
  const today = new Date();
  const [datePreset, setDatePreset] = useState<"1week" | "1month" | "1year" | "all" | "custom">("1week");
  const [dateFrom, setDateFrom] = useState(() => format(subDays(today, 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(addDays(today, 7), "yyyy-MM-dd"));

  const [payFilter, setPayFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PACKED" | "SHIPPED">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "NORMAL" | "EVENT">("ALL");
  const [editingOrder, setEditingOrder] = useState<any | null>(null);

  const handlePresetChange = (preset: "1week" | "1month" | "1year" | "all") => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "1week") {
      setDateFrom(format(subDays(now, 7), "yyyy-MM-dd"));
      setDateTo(format(addDays(now, 7), "yyyy-MM-dd"));
    } else if (preset === "1month") {
      setDateFrom(format(subDays(now, 30), "yyyy-MM-dd"));
      setDateTo(format(addDays(now, 30), "yyyy-MM-dd"));
    } else if (preset === "1year") {
      setDateFrom(format(startOfYear(now), "yyyy-MM-dd"));
      setDateTo(format(endOfYear(now), "yyyy-MM-dd"));
    } else if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetchAllOrdersService({
        search,
        searchType,
        dateFrom,
        dateTo,
        paymentStatus: payFilter,
        orderStatus: statusFilter,
        orderType: typeFilter,
        limit: 200,
      });
      setOrders(res.orders as any[]);
      setTotal(res.total);
      setTotalSales(res.totalSales);
      setPaidSales(res.paidSales);
      setUnpaidSales(res.unpaidSales);
    } catch (e: any) {
      console.error(e);
      setFetchError(e?.message || "주문 내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [search, searchType, dateFrom, dateTo, payFilter, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteOrder = async (id: number) => {
    if (!confirm("이 주문을 삭제하시겠습니까? 복구할 수 없습니다.")) return;
    try {
      await deleteOrderService(id);
      load();
    } catch (e: any) {
      alert(e.message || "삭제 실패");
    }
  };

  const payBadge = (status: string) =>
    status === "PAID"
      ? "bg-blue-100 text-blue-900 border border-blue-300"
      : "bg-red-100 text-red-900 border border-red-300";

  const statusBadge = (status: string) => {
    if (status === "SHIPPED") return "bg-emerald-100 text-emerald-900 border border-emerald-300";
    if (status === "PACKED") return "bg-amber-100 text-amber-900 border border-amber-300";
    return "bg-slate-100 text-slate-700 border border-slate-300";
  };

  const statusLabel = (s: string) => s === "SHIPPED" ? "발송완료" : s === "PACKED" ? "포장완료" : "포장대기";

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "전체 주문", value: `${total}건`, icon: Package, color: "slate" },
          { label: "총 매출", value: formatPrice(totalSales), icon: DollarSign, color: "emerald" },
          { label: "입금 완료", value: formatPrice(paidSales), icon: TrendingUp, color: "blue" },
          { label: "미입금", value: formatPrice(unpaidSales), icon: TrendingDown, color: "red" },
        ].map((s) => (
          <div key={s.label} className={`bg-white border-2 border-${s.color}-200 p-4`}>
            <div className={`text-xs font-bold text-${s.color}-600 mb-1`}>{s.label}</div>
            <div className={`text-lg font-black text-${s.color}-900 stat-number`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="bg-white border border-slate-200 p-3.5 space-y-3">
        {/* 1행: 검색 필터 (전체/고객/전화/주소 + 검색어 + 입금 + 상태 + 새로고침) */}
        <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center">
          {/* 검색 구분 드롭다운 */}
          <div className="flex items-center gap-1.5 min-w-[130px]">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">구분</span>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as any)}
              className="border-2 border-slate-300 px-2 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none bg-white w-full"
            >
              <option value="ALL">전체</option>
              <option value="CUSTOMER">고객 검색</option>
              <option value="PHONE">연락처</option>
              <option value="ADDRESS">주소</option>
            </select>
          </div>

          {/* 검색어 입력창 */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                searchType === "CUSTOMER"
                  ? "고객명 또는 고객코드 (예: C-1001, 홍길동)"
                  : searchType === "PHONE"
                  ? "연락처 입력 (예: 01012345678)"
                  : searchType === "ADDRESS"
                  ? "배송지 주소 입력..."
                  : "이름·고객코드(C-1001)·전화·주소 검색"
              }
              className="w-full pl-9 pr-8 py-2 border-2 border-slate-300 text-sm font-bold focus:border-emerald-500 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <select
              value={payFilter}
              onChange={(e) => setPayFilter(e.target.value as any)}
              className="border-2 border-slate-300 px-2 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">입금 전체</option>
              <option value="PAID">입금완료</option>
              <option value="UNPAID">미입금</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border-2 border-slate-300 px-2 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">상태 전체</option>
              <option value="PENDING">포장대기</option>
              <option value="PACKED">포장완료</option>
              <option value="SHIPPED">발송완료</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="border-2 border-slate-300 px-2 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">구분 전체</option>
              <option value="NORMAL">일반 택배</option>
              <option value="EVENT">[행사] 행사 납품</option>
            </select>

            <button
              onClick={load}
              title="새로고침"
              className="p-2 border-2 border-slate-300 hover:bg-slate-100 cursor-pointer text-slate-600 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2행: 날짜 필터 (택배 도착일 기준 + 1주일/1달/1년/전체 버튼 + 기간 직접선택) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1.5 flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              택배 도착일 기준
            </span>

            {/* 빠른 선택 버튼들 */}
            <div className="inline-flex border-2 border-slate-300 overflow-hidden text-xs font-bold shrink-0">
              {[
                { id: "1week", label: "1주일" },
                { id: "1month", label: "1달" },
                { id: "1year", label: "1년" },
                { id: "all", label: "전체" },
              ].map((p) => {
                const isActive = datePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetChange(p.id as any)}
                    className={`px-3 py-1.5 transition-colors cursor-pointer border-r last:border-r-0 border-slate-200 whitespace-nowrap shrink-0 ${
                      isActive
                        ? "bg-emerald-700 text-white font-black"
                        : "bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 직접 날짜 선택 */}
          <div className="flex items-center gap-1.5 text-xs font-bold shrink-0 flex-nowrap">
            <span className="text-slate-500 whitespace-nowrap shrink-0">직접선택:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDatePreset("custom");
              }}
              className="border-2 border-slate-300 px-2 py-1 text-xs font-bold focus:border-emerald-500 focus:outline-none whitespace-nowrap shrink-0"
            />
            <span className="text-slate-500 font-bold shrink-0">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDatePreset("custom");
              }}
              className="border-2 border-slate-300 px-2 py-1 text-xs font-bold focus:border-emerald-500 focus:outline-none whitespace-nowrap shrink-0"
            />
          </div>
        </div>
      </div>

      {/* 주문 테이블 */}
      <div className="bg-white border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 font-bold">불러오는 중...</div>
        ) : fetchError ? (
          <div className="py-16 text-center space-y-2">
            <div className="text-red-600 font-bold">{fetchError}</div>
            <button
              onClick={load}
              className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              다시 시도
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-bold">조건에 맞는 주문이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-3 py-3 text-left font-bold whitespace-nowrap min-w-[95px]">도착일</th>
                  <th className="px-3 py-3 text-left font-bold whitespace-nowrap min-w-[70px]">이름</th>
                  <th className="px-3 py-3 text-left font-bold whitespace-nowrap min-w-[125px]">연락처</th>
                  <th className="px-3 py-3 text-center font-bold whitespace-nowrap min-w-[65px]">수량</th>
                  <th className="px-3 py-3 text-right font-bold whitespace-nowrap min-w-[90px]">금액</th>
                  <th className="px-3 py-3 text-center font-bold whitespace-nowrap min-w-[65px]">입금</th>
                  <th className="px-3 py-3 text-center font-bold whitespace-nowrap min-w-[75px]">상태</th>
                  <th className="px-3 py-3 text-left font-bold min-w-[200px]">주소</th>
                  <th className="px-3 py-3 text-center font-bold whitespace-nowrap min-w-[70px]">관리</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, idx) => {
                  const isEv = o.order_type === "EVENT" || !!o.event_name;
                  return (
                  <tr key={o.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap">{o.shipping_date}</td>
                    <td className="px-3 py-2.5 font-extrabold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-nowrap">
                        {o.customer_code && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-black bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-sm whitespace-nowrap">
                            #{o.customer_code}
                          </span>
                        )}
                        {isEv && (
                          <span className="shrink-0 px-1.5 py-0.5 text-xs font-bold bg-slate-200 text-slate-800 border border-slate-300 rounded-sm whitespace-nowrap">
                            [행사] {o.event_name || "행사납품"}
                          </span>
                        )}
                        <span>{o.customer_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-emerald-800 font-bold whitespace-nowrap">
                      <PhoneCallLink phone={o.customer_phone} name={o.customer_name} />
                    </td>
                    <td className="px-3 py-2.5 text-center font-black text-emerald-900 whitespace-nowrap">
                      {o.total_boxes || "-"}박스
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-slate-900 stat-number whitespace-nowrap">
                      {formatPrice(o.total_amount)}
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 text-xs font-bold whitespace-nowrap ${payBadge(o.payment_status)}`}>
                        {o.payment_status === "PAID" ? "입금" : "미입금"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 text-xs font-bold whitespace-nowrap ${statusBadge(o.order_status)}`}>
                        {statusLabel(o.order_status)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs max-w-[240px] truncate" title={[o.shipping_address, o.shipping_address_detail].filter(Boolean).join(" ")}>
                      {[o.shipping_address, o.shipping_address_detail].filter(Boolean).join(" ")}
                      {o.memo && <span className="ml-1 text-rose-600 font-bold">[{o.memo}]</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center gap-1 justify-center whitespace-nowrap">
                        <button
                          onClick={() => setEditingOrder(o)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 cursor-pointer shrink-0"
                          title="수정"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(o.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 cursor-pointer shrink-0"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && orders.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-bold text-right">
            총 {total}건 표시 중 (최대 200건)
          </div>
        )}
      </div>

      {editingOrder && (
        <OrderEditModal
          order={{
            id: editingOrder.id,
            customer_id: editingOrder.customer_id,
            order_no: editingOrder.order_no,
            customer_name: editingOrder.customer_name,
            customer_phone: editingOrder.customer_phone,
            shipping_date: editingOrder.shipping_date,
            shipping_address: editingOrder.shipping_address,
            shipping_address_detail: editingOrder.shipping_address_detail || "",
            qty20kg: Number(editingOrder.total_boxes) || 1,
            unit_price: 68000,
            total_amount: Number(editingOrder.total_amount) || 0,
            payment_status: editingOrder.payment_status || "UNPAID",
            memo: editingOrder.memo || "",
            order_type: editingOrder.order_type || (editingOrder.event_name ? "EVENT" : "NORMAL"),
            event_name: editingOrder.event_name || "",
            items: [],
          }}
          isOpen={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          onOrderUpdated={() => { setEditingOrder(null); load(); }}
          onOrderDeleted={() => { setEditingOrder(null); load(); }}
          settings={settings}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 고객 리스트 탭
// ──────────────────────────────────────────────
function CustomerListTab({ settings }: { settings?: any }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<any>(null);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCustomersService(search);
      setCustomers(res as any[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setExpandedDetail(null); return; }
    setExpandedId(id);
    try {
      const detail = await fetchCustomerDetailService(id);
      setExpandedDetail(detail);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (c: any) => {
    if (!confirm(`"${c.name}" 고객을 삭제하시겠습니까?\n(주문 이력이 없어야 삭제 가능합니다.)`)) return;
    try {
      await deleteCustomerService(c.id);
      load();
    } catch (e: any) {
      alert(e.message || "삭제 실패");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-4 flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호 검색"
            className="w-full pl-9 pr-3 py-2 border-2 border-slate-300 text-sm font-bold focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button onClick={load} className="p-2 border-2 border-slate-300 hover:bg-slate-100 cursor-pointer text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-sm text-slate-500 font-bold">{customers.length}명</span>
      </div>

      <div className="bg-white border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 font-bold">불러오는 중...</div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-bold">고객이 없습니다.</div>
        ) : (
          <div>
            {customers.map((c: any) => (
              <div key={c.id} className="border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-base">{c.name}</span>
                      <PhoneCallLink
                        phone={c.phone}
                        name={c.name}
                        showIcon
                        className="text-sm font-bold text-emerald-700 hover:underline"
                      />
                      <span className="text-xs text-slate-500">{c.address}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                      <span>총 주문 <strong className="text-slate-800">{c.order_count}건</strong></span>
                      {c.last_order_date && <span>최근 도착 <strong className="text-slate-800">{c.last_order_date}</strong></span>}
                      {c.memo && <span className="text-rose-600 font-bold">[{c.memo}]</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingCustomer(c)}
                      className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 cursor-pointer"
                      title="수정"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleExpand(c.id)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 cursor-pointer"
                      title="주문 내역 보기"
                    >
                      {expandedId === c.id
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {expandedId === c.id && expandedDetail && (
                  <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
                    <div className="text-xs font-black text-slate-700 mb-2">주문 내역 ({(expandedDetail.orders || []).length}건)</div>
                    {(expandedDetail.orders || []).length === 0 ? (
                      <div className="text-xs text-slate-400">주문 내역이 없습니다.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {expandedDetail.orders.map((o: any) => (
                          <div key={o.id} className="flex items-center gap-2 text-xs bg-white border border-slate-200 px-3 py-2">
                            <span className="font-bold text-slate-700 whitespace-nowrap">{o.shipping_date}</span>
                            <span className="font-bold text-emerald-800">{o.items_summary || "-"}</span>
                            <span className="font-black stat-number ml-auto whitespace-nowrap">{formatPrice(o.total_amount)}</span>
                            <span className={`px-1.5 py-0.5 font-bold ${o.payment_status === "PAID" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}`}>
                              {o.payment_status === "PAID" ? "입금" : "미입금"}
                            </span>
                          </div>
                        ))}
                        <div className="text-xs text-right font-black text-slate-700 pt-1">
                          총 구매액: <span className="stat-number text-emerald-800">{formatPrice(expandedDetail.orders.reduce((s: number, o: any) => s + Number(o.total_amount), 0))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editingCustomer && (
        <CustomerEditModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 메인 LedgerView
// ──────────────────────────────────────────────
export function LedgerView({ settings, onRequestConfig, onSelectCustomerForOrder }: LedgerViewProps) {
  const [tab, setTab] = useState<LedgerTab>("sales");

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-24">
      {/* 헤더 */}
      <div className="bg-white border-2 border-slate-300 px-5 py-4 rounded-2xl shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">판매 및 데이터 관리</h1>
        <p className="text-xs text-slate-500 mt-0.5">전체 판매 내역 및 단골 고객 데이터를 관리합니다</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b-2 border-slate-300 bg-white rounded-t-xl overflow-hidden">
        <button
          onClick={() => setTab("sales")}
          className={`flex items-center gap-2 px-6 py-3.5 text-base font-bold border-b-4 transition-colors cursor-pointer ${
            tab === "sales"
              ? "border-emerald-600 text-emerald-800 bg-emerald-50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          판매 리스트
        </button>
        <button
          onClick={() => setTab("customers")}
          className={`flex items-center gap-2 px-6 py-3.5 text-base font-bold border-b-4 transition-colors cursor-pointer ${
            tab === "customers"
              ? "border-emerald-600 text-emerald-800 bg-emerald-50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Users className="w-5 h-5" />
          고객 리스트
        </button>
      </div>

      {/* 콘텐츠 */}
      {tab === "sales" && <SalesListTab settings={settings} />}
      {tab === "customers" && (
        <CustomerView
          onRequestConfig={onRequestConfig}
          onSelectAddressForOrder={onSelectCustomerForOrder}
        />
      )}
    </div>
  );
}
