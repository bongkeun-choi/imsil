"use client";

import React, { useState, useEffect } from "react";
import { formatPrice } from "@/lib/utils";
import { Download, CheckSquare, Square, Phone, RefreshCw, Edit3, Share2, Printer } from "lucide-react";
import { format } from "date-fns";
import { fetchOrdersService, updateOrderActionService, fetchOrderByIdService } from "@/lib/services";
import { OrderEditModal } from "@/components/OrderEditModal";
import { OrderShareModal } from "@/components/OrderShareModal";
import { ShipmentPrintModal } from "@/components/ShipmentPrintModal";
import { OrderCardData } from "@/lib/orderCardCanvas";
import { PhoneCallLink } from "@/components/PhoneCallLink";
import { parseExtraPhones, generateOrderShareMessage } from "@/lib/orderShareMessage";

interface ShipmentViewProps {
  settings: {
    shop_name?: string;
    shop_phone?: string;
    extra_phones?: string;
    share_message_template?: string;
    bank_name?: string;
    bank_account?: string;
    owner_name?: string;
  };
  onRequestConfig: () => void;
}

export function ShipmentView({ settings, onRequestConfig }: ShipmentViewProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    return format(new Date(), "yyyy-MM-dd");
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTrackingId, setEditingTrackingId] = useState<number | null>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [sharingOrder, setSharingOrder] = useState<OrderCardData | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [orderFilter, setOrderFilter] = useState<"ALL" | "NORMAL" | "EVENT">("ALL");

  const handleOpenOrderShare = (ord: any) => {
    const shareData: OrderCardData = {
      orderNo: ord.order_no || "",
      customerName: ord.customer_name || "",
      customerPhone: ord.customer_phone || "",
      shippingDate: ord.shipping_date || selectedDate,
      shippingAddress: ord.shipping_address || "",
      shippingAddressDetail: ord.shipping_address_detail || "",
      itemsSummary: (ord.items || []).map((i: any) => `${i.product_name} ${i.quantity}개`).join(", ") || "절임배추 20kg",
      totalAmount: Number(ord.total_amount) || 0,
      paymentStatus: ord.payment_status || "UNPAID",
      memo: ord.memo || "",
      shopName: settings?.shop_name || "임실참배추농원",
      shopPhone: settings?.shop_phone || "010-0000-0000",
      extraPhones: parseExtraPhones(settings?.extra_phones),
      shareMessageTemplate: settings?.share_message_template,
      bankName: settings?.bank_name || "농협",
      bankAccount: settings?.bank_account || "",
      ownerName: settings?.owner_name || "",
    };
    setSharingOrder(shareData);
  };

  const handleOpenOrderEdit = async (ord: any) => {
    const isEvent = ord.order_type === "EVENT" || !!ord.event_name;
    const qty20kg = (ord.items && ord.items[0]?.quantity) || ord.qty20kg || 1;
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
        console.error("출고 주문 상세 조회 에러:", err);
      }
    }
  };

  const handleOrderUpdated = (shareData?: OrderCardData) => {
    setEditingOrder(null);
    fetchOrders(selectedDate);
    if (shareData) {
      setSharingOrder(shareData);
    }
  };

  const handleOrderDeleted = () => {
    setEditingOrder(null);
    fetchOrders(selectedDate);
  };

  const fetchOrders = async (dateStr: string) => {
    setLoading(true);
    try {
      const res = await fetchOrdersService(dateStr);
      setOrders(res || []);
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
    fetchOrders(selectedDate);
  }, [selectedDate]);

  // 포장완료 원클릭 토글
  const handleTogglePacked = async (orderId: number) => {
    try {
      await updateOrderActionService(orderId, "mark_packed");
      fetchOrders(selectedDate);
    } catch (e) {
      alert("상태 변경 오류");
    }
  };

  // 운송장 저장
  const handleSaveTracking = async (orderId: number) => {
    if (!trackingInput.trim()) return;
    try {
      await updateOrderActionService(orderId, "mark_shipped", {
        tracking_no: trackingInput.trim(),
      });
      setEditingTrackingId(null);
      setTrackingInput("");
      fetchOrders(selectedDate);
    } catch (e) {
      alert("운송장 저장 오류");
    }
  };

  // 택배사 제출용 CSV 엑셀 다운로드 (BOM 추가)
  const downloadCsv = () => {
    if (orders.length === 0) {
      alert("출력할 주문 내역이 없습니다.");
      return;
    }

    const headers = [
      "주문번호",
      "구분",
      "행사명",
      "받는분성명",
      "전화번호",
      "배송지주소",
      "상세주소",
      "주문품목및수량",
      "운송장번호",
      "배송메모",
    ];

    const rows = orders.map((o) => {
      const isEv = o.order_type === "EVENT" || !!o.event_name;
      const itemsStr = (o.items || [])
        .map((i: any) => `${i.product_name} ${i.quantity}개`)
        .join(" / ");
      return [
        `"${o.order_no}"`,
        `"${isEv ? "행사납품" : "일반택배"}"`,
        `"${o.event_name || (isEv ? "임실 김치 축제" : "")}"`,
        `"${o.customer_name}"`,
        `"${o.customer_phone}"`,
        `"${o.shipping_address}"`,
        `"${o.shipping_address_detail || ""}"`,
        `"${itemsStr}"`,
        `"${o.tracking_no || ""}"`,
        `"${o.memo || ""}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `절임배추_택배명단_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 문자 발송 링크 생성
  const makeSmsUrl = (ord: any) => {
    const shareData: OrderCardData = {
      orderNo: ord.order_no || "",
      customerName: ord.customer_name || "",
      customerPhone: ord.customer_phone || "",
      shippingDate: ord.shipping_date || selectedDate,
      shippingAddress: ord.shipping_address || "",
      shippingAddressDetail: ord.shipping_address_detail || "",
      itemsSummary: (ord.items || []).map((i: any) => `${i.product_name} ${i.quantity}개`).join(", ") || "절임배추 20kg",
      totalAmount: Number(ord.total_amount) || 0,
      paymentStatus: ord.payment_status || "UNPAID",
      memo: ord.memo || "",
      shopName: settings?.shop_name || "임실참배추농원",
      shopPhone: settings?.shop_phone || "010-0000-0000",
      extraPhones: parseExtraPhones(settings?.extra_phones),
      shareMessageTemplate: settings?.share_message_template,
      bankName: settings?.bank_name || "농협",
      bankAccount: settings?.bank_account || "",
      ownerName: settings?.owner_name || "",
    };

    const text = generateOrderShareMessage(shareData, settings?.share_message_template);
    return `sms:${ord.customer_phone.replace(/[^0-9]/g, "")}?body=${encodeURIComponent(text)}`;
  };

  const eventOrders = orders.filter((o) => o.order_type === "EVENT" || !!o.event_name);
  const normalOrders = orders.filter((o) => !(o.order_type === "EVENT" || !!o.event_name));
  const totalQty20kg = orders.reduce((acc, o) => acc + (o.qty20kg || (o.items && o.items[0]?.quantity) || 1), 0);
  const eventQty20kg = eventOrders.reduce((acc, o) => acc + (o.qty20kg || (o.items && o.items[0]?.quantity) || 1), 0);
  const normalQty20kg = normalOrders.reduce((acc, o) => acc + (o.qty20kg || (o.items && o.items[0]?.quantity) || 1), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* 1. 상단 컨트롤 바 */}
      <div className="bg-white p-2.5 md:p-3 rounded-2xl border-2 border-slate-300 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
          <span className="text-lg md:text-xl font-black text-slate-900 whitespace-nowrap">
            택배 도착일자:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-lg font-bold border-2 border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:border-emerald-600 focus:outline-hidden"
          />
          <button
            onClick={() => fetchOrders(selectedDate)}
            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer shrink-0"
            title="새로고침"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowPrintModal(true)}
            className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl cursor-pointer flex items-center gap-1.5 font-bold text-sm md:text-base shadow-xs transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>인쇄 / PDF</span>
          </button>
          <button
            onClick={downloadCsv}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl cursor-pointer flex items-center gap-1.5 font-bold text-sm md:text-base shadow-xs transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>CSV 다운로드</span>
          </button>
        </div>
      </div>

      {/* 2. 발송 명단 목록 */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-3 md:p-4 shadow-sm">
        <div className="border-b border-slate-200 pb-2 mb-3 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">
              {selectedDate} 도착 대상 발송 명단 ({orders.length}건)
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-bold text-slate-600 mt-0.5">
              <span>도착일 전날 포장하여 전달합니다.</span>
              <span className="text-emerald-900 font-extrabold whitespace-nowrap">일반 택배: {normalQty20kg}박스</span>
              {eventQty20kg > 0 && (
                <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-full font-black flex items-center gap-1 whitespace-nowrap">
                  <span>🎪</span>
                  <span>임실 김치 축제: {eventQty20kg}박스 ({eventOrders.length}건)</span>
                </span>
              )}
              <span className="whitespace-nowrap">(총 {totalQty20kg}박스)</span>
            </div>
          </div>
          <span className="text-xs md:text-sm text-slate-600 font-semibold">
            박스 포장 후 체크 버튼을 누르면 포장완료 처리됩니다.
          </span>
        </div>

        {/* 행사 납품이 있을 때 탭 필터 */}
        {eventOrders.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap mb-3 pb-1">
            <button
              type="button"
              onClick={() => setOrderFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                orderFilter === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              전체 ({orders.length}건)
            </button>
            <button
              type="button"
              onClick={() => setOrderFilter("NORMAL")}
              className={`px-2.5 py-1 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                orderFilter === "NORMAL"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              일반 택배 ({normalOrders.length}건 &middot; {normalQty20kg}박스)
            </button>
            <button
              type="button"
              onClick={() => setOrderFilter("EVENT")}
              className={`px-2.5 py-1 rounded-lg text-xs md:text-sm font-black transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                orderFilter === "EVENT"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "bg-purple-100 text-purple-900 hover:bg-purple-200 border border-purple-300"
              }`}
            >
              <span>🎪</span>
              <span>행사 납품 ({eventOrders.length}건 &middot; {eventQty20kg}박스)</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-lg font-bold text-slate-700">
            불러오는 중...
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-base">
            해당 일자에 출고할 주문이 없습니다.
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders
              .filter((ord) => {
                const isEv = ord.order_type === "EVENT" || !!ord.event_name;
                if (orderFilter === "NORMAL") return !isEv;
                if (orderFilter === "EVENT") return isEv;
                return true;
              })
              .map((ord) => {
                const isEvent = ord.order_type === "EVENT" || !!ord.event_name;
                const isPacked =
                  ord.order_status === "PACKED" || ord.order_status === "SHIPPED";
                return (
                  <div
                    key={ord.id}
                    className={`border-2 rounded-xl p-2.5 md:p-3 transition-all ${
                      isPacked
                        ? "bg-slate-50 border-slate-300 opacity-90"
                        : isEvent
                        ? "bg-purple-50/40 border-purple-400 shadow-xs"
                        : "bg-white border-emerald-400 shadow-xs"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-[280px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isEvent && (
                            <span className="shrink-0 px-2 py-0.5 text-xs font-black bg-purple-100 text-purple-900 border border-purple-300 rounded-md inline-flex items-center gap-1 whitespace-nowrap">
                              <span>🎪</span>
                              <span>{ord.event_name || "임실 김치 축제"} 납품</span>
                            </span>
                          )}
                          <span className="text-xl md:text-2xl font-black text-slate-900">
                            {ord.customer_name}
                          </span>
                        {ord.customer_phone ? (
                          <div className="inline-flex items-center text-sm md:text-base font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap">
                            <PhoneCallLink
                              phone={ord.customer_phone}
                              name={ord.customer_name}
                              showIcon
                              className="text-emerald-800 font-bold hover:underline"
                            />
                          </div>
                        ) : !isEvent ? (
                          <div className="inline-flex items-center text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">
                            연락처 없음
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleOpenOrderShare(ord)}
                          className="inline-flex items-center gap-1 text-xs md:text-sm font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0"
                          title="문자·카톡 안내장 전송"
                        >
                          <Share2 className="w-3.5 h-3.5 text-amber-700" />
                          <span>문자·카톡</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenOrderEdit(ord)}
                          className="inline-flex items-center gap-1 text-xs md:text-sm font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0"
                          title="주문 정보 수정"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-700" />
                          <span>수정</span>
                        </button>
                      </div>

                      <div className="text-lg md:text-xl font-black text-emerald-900">
                        {(ord.items || [])
                          .map((i: any) => `${i.product_name} × ${i.quantity}개`)
                          .join("  /  ")}
                      </div>

                      {isEvent ? (
                        <div className="text-sm md:text-base text-purple-900 font-bold bg-purple-50/80 border border-purple-200 rounded-lg px-2.5 py-1 inline-block">
                          🎪 {ord.shipping_address ? `납품장소: ${ord.shipping_address} ${ord.shipping_address_detail || ""}` : "행사 현장 직접 납품 (택배 발송 없음)"}
                        </div>
                      ) : (
                        <div className="text-base md:text-lg text-slate-800 font-medium">
                          주소: {ord.shipping_address} {ord.shipping_address_detail}
                        </div>
                      )}

                      {ord.memo && (
                        <div className="text-sm md:text-base font-bold text-rose-700">
                          요청사항: {ord.memo}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={() => handleTogglePacked(ord.id)}
                        className={`py-1.5 px-3 rounded-xl border-2 cursor-pointer flex items-center gap-1.5 font-bold text-sm md:text-base transition-all whitespace-nowrap ${
                          isPacked
                            ? "bg-emerald-700 text-white border-emerald-800"
                            : "bg-white text-slate-800 border-slate-300 hover:border-emerald-600"
                        }`}
                      >
                        {isPacked ? (
                          <>
                            <CheckSquare className="w-6 h-6 text-white" />
                            <span>포장 완료됨</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-6 h-6 text-slate-400" />
                            <span>포장 대기 (터치 시 완료)</span>
                          </>
                        )}
                      </button>

                      {editingTrackingId === ord.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={trackingInput}
                            onChange={(e) => setTrackingInput(e.target.value)}
                            placeholder="운송장 번호 입력"
                            className="border-2 border-slate-400 rounded-lg px-3 py-2 text-base font-bold"
                          />
                          <button
                            onClick={() => handleSaveTracking(ord.id)}
                            className="bg-slate-900 text-white px-3 py-2 rounded-lg font-bold text-sm cursor-pointer"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingTrackingId(null)}
                            className="bg-slate-200 text-slate-800 px-3 py-2 rounded-lg font-bold text-sm cursor-pointer"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-base text-slate-600 font-medium">
                            운송장:{" "}
                            {ord.tracking_no ? (
                              <strong className="text-slate-900 font-extrabold">
                                {ord.tracking_no}
                              </strong>
                            ) : (
                              <span className="text-slate-400">미등록</span>
                            )}
                          </span>
                          <button
                            onClick={() => {
                              setEditingTrackingId(ord.id);
                              setTrackingInput(ord.tracking_no || "");
                            }}
                            className="text-sm font-bold text-slate-800 underline hover:text-emerald-700 cursor-pointer"
                          >
                            {ord.tracking_no ? "수정" : "+ 운송장 입력"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 인쇄 / PDF 미리보기 모달 */}
      {showPrintModal && (
        <ShipmentPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          orders={orders}
          selectedDate={selectedDate}
          settings={settings}
        />
      )}

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
