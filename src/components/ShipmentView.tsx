"use client";

import React, { useState, useEffect } from "react";
import { formatPrice } from "@/lib/utils";
import { Download, CheckSquare, Square, MessageSquare, Phone, RefreshCw, Edit3, Share2 } from "lucide-react";
import { format } from "date-fns";
import { fetchOrdersService, updateOrderActionService, fetchOrderByIdService } from "@/lib/services";
import { OrderEditModal } from "@/components/OrderEditModal";
import { OrderShareModal } from "@/components/OrderShareModal";
import { OrderCardData } from "@/lib/orderCardCanvas";

interface ShipmentViewProps {
  settings: {
    shop_name?: string;
    shop_phone?: string;
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
      bankName: settings?.bank_name || "농협",
      bankAccount: settings?.bank_account || "",
      ownerName: settings?.owner_name || "",
    };
    setSharingOrder(shareData);
  };

  const handleOpenOrderEdit = async (ord: any) => {
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
      "받는분성명",
      "전화번호",
      "배송지주소",
      "상세주소",
      "주문품목및수량",
      "운송장번호",
      "배송메모",
    ];

    const rows = orders.map((o) => {
      const itemsStr = (o.items || [])
        .map((i: any) => `${i.product_name} ${i.quantity}개`)
        .join(" / ");
      return [
        `"${o.order_no}"`,
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
    const shop = settings.shop_name || "임실 절임배추";
    const bank = `${settings.bank_name || "농협"} ${settings.bank_account || ""} (${settings.owner_name || ""})`;
    const items = (ord.items || [])
      .map((i: any) => `${i.product_name} ${i.quantity}개`)
      .join(", ");
    
    let text = `[${shop}]\n안녕하세요 ${ord.customer_name}님.\n주문하신 ${items}가 ${ord.shipping_date} 출고 예정입니다.`;
    if (ord.payment_status !== "PAID") {
      text += `\n\n* 입금계좌: ${bank}\n* 금액: ${formatPrice(ord.total_amount)}`;
    }
    if (ord.tracking_no) {
      text += `\n* 운송장번호: ${ord.tracking_no}`;
    }
    text += `\n감사합니다.`;

    return `sms:${ord.customer_phone.replace(/[^0-9]/g, "")}?body=${encodeURIComponent(text)}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* 1. 상단 컨트롤 바 */}
      <div className="bg-white p-5 rounded-2xl border-2 border-slate-300 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <span className="text-xl md:text-2xl font-black text-slate-900">
            택배 도착일자:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xl font-bold border-2 border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:border-emerald-600 focus:outline-hidden"
          />
          <button
            onClick={() => fetchOrders(selectedDate)}
            className="p-3 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
            title="새로고침"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={downloadCsv}
          className="btn-large px-6 bg-slate-800 hover:bg-slate-900 text-white rounded-xl cursor-pointer flex items-center gap-2 font-bold shadow-xs transition-colors"
        >
          <Download className="w-5 h-5 text-emerald-400" />
          <span>우체국 택배용 CSV 다운로드</span>
        </button>
      </div>

      {/* 2. 발송 명단 목록 */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm">
        <div className="border-b border-slate-200 pb-3 mb-4 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">
              {selectedDate} 도착 대상 발송 명단 ({orders.length}건)
            </h2>
            <p className="text-xs md:text-sm font-bold text-emerald-800 mt-0.5">
              도착일 전날 포장하여 우체국택배로 전달합니다.
            </p>
          </div>
          <span className="text-sm md:text-base text-slate-600 font-semibold">
            박스 포장 후 체크 버튼을 누르면 포장완료 처리됩니다.
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xl font-bold text-slate-700">
            불러오는 중...
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-lg">
            해당 일자에 출고할 주문이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((ord) => {
              const isPacked =
                ord.order_status === "PACKED" || ord.order_status === "SHIPPED";
              return (
                <div
                  key={ord.id}
                  className={`border-2 rounded-2xl p-5 transition-all ${
                    isPacked
                      ? "bg-slate-50 border-slate-300 opacity-90"
                      : "bg-white border-emerald-400 shadow-xs"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-[280px]">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-slate-900">
                          {ord.customer_name}
                        </span>
                        <a
                          href={`tel:${ord.customer_phone.replace(/[^0-9]/g, "")}`}
                          className="inline-flex items-center gap-1 text-base font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md hover:bg-emerald-100"
                        >
                          <Phone className="w-4 h-4" />
                          <span>{ord.customer_phone}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleOpenOrderShare(ord)}
                          className="inline-flex items-center gap-1 text-sm font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                          title="문자·카톡 안내장 전송"
                        >
                          <Share2 className="w-4 h-4 text-amber-700" />
                          <span>문자·카톡</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenOrderEdit(ord)}
                          className="inline-flex items-center gap-1 text-sm font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                          title="주문 정보 수정"
                        >
                          <Edit3 className="w-4 h-4 text-blue-700" />
                          <span>수정</span>
                        </button>
                      </div>

                      <div className="text-xl font-black text-emerald-900">
                        {(ord.items || [])
                          .map((i: any) => `${i.product_name} × ${i.quantity}개`)
                          .join("  /  ")}
                      </div>

                      <div className="text-lg text-slate-800 font-medium">
                        주소: {ord.shipping_address} {ord.shipping_address_detail}
                      </div>

                      {ord.memo && (
                        <div className="text-base font-bold text-rose-700">
                          요청사항: {ord.memo}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <button
                        onClick={() => handleTogglePacked(ord.id)}
                        className={`btn-large px-5 rounded-xl border-2 cursor-pointer flex items-center gap-2 font-bold transition-all ${
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
