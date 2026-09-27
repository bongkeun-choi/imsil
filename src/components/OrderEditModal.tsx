"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Trash2,
  AlertTriangle,
  Minus,
  Plus,
  CheckCircle2,
  Share2,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { formatPrice, formatPhone } from "@/lib/utils";
import { updateOrderDetailService, deleteOrderService } from "@/lib/services";
import { OrderCardData } from "@/lib/orderCardCanvas";
import { useBackButtonModal } from "@/lib/useBackButtonModal";
import { parseExtraPhones } from "@/lib/orderShareMessage";

interface OrderEditModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: (shareData?: OrderCardData) => void;
  onOrderDeleted?: () => void;
  settings?: any;
}

export function OrderEditModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
  onOrderDeleted,
  settings,
}: OrderEditModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [shippingDate, setShippingDate] = useState("");
  const [qty20kg, setQty20kg] = useState(1);
  const [unitPrice, setUnitPrice] = useState(68000);
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("UNPAID");
  const [memo, setMemo] = useState("");
  // 행사·축제 납품 구분 상태
  const [isEvent, setIsEvent] = useState(false);
  const [eventName, setEventName] = useState("임실 김치 축제");
  const [isSaving, setIsSaving] = useState(false);

  // 저장 완료 후 문자/카톡 발송 여부 확인 팝업 상태
  const [savedShareData, setSavedShareData] = useState<OrderCardData | null>(null);
  const [showPostEditPrompt, setShowPostEditPrompt] = useState(false);

  // 모바일 뒤로가기 버튼 연동 (뒤로가기 시 팝업만 안전하게 닫힘)
  useBackButtonModal(isOpen, onClose, "order-edit-modal");
  useBackButtonModal(
    showPostEditPrompt,
    () => setShowPostEditPrompt(false),
    "order-post-edit-prompt"
  );

  useEffect(() => {
    if (!isOpen || !order) return;

    setName(order.customer_name || "");
    setPhone(formatPhone(order.customer_phone || ""));
    setAddress(order.shipping_address || "");
    setAddressDetail(order.shipping_address_detail || "");
    setShippingDate(order.shipping_date || format(new Date(), "yyyy-MM-dd"));
    setPaymentStatus(order.payment_status === "PAID" ? "PAID" : "UNPAID");
    setMemo(order.memo || "");
    setIsEvent(order.order_type === "EVENT");
    setEventName(order.event_name || "임실 김치 축제");

    // 수량 파싱: 20kg 아이템이 있으면 그 수량, 없으면 총 금액 기준 역산 또는 1
    let q20 = 1;
    let price = 68000;
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      const found20 = order.items.find((i: any) => Number(i.weight_kg) === 20);
      if (found20) {
        q20 = Number(found20.quantity) || 1;
        price = Number(found20.unit_price) || 68000;
      } else {
        q20 = Number(order.items[0].quantity) || 1;
        price = Number(order.items[0].unit_price) || 68000;
      }
    } else if (order.total_amount) {
      q20 = Math.max(1, Math.round(Number(order.total_amount) / 68000));
    }
    setQty20kg(q20);
    setUnitPrice(price);
    setShowPostEditPrompt(false);
    setSavedShareData(null);
  }, [isOpen, order]);

  // 스마트폰 뒤로가기 버튼 안전 연동
  useEffect(() => {
    if (!isOpen) return;

    let closedByPop = false;
    const currentState = window.history.state;
    if (currentState?.modal !== "order-edit") {
      window.history.pushState({ ...currentState, modal: "order-edit" }, "");
    }

    const handlePopState = () => {
      closedByPop = true;
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!closedByPop && window.history.state?.modal === "order-edit") {
        window.history.back();
      }
    };
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handleCloseSafely = () => {
    onClose();
  };

  const totalAmount = qty20kg * unitPrice;

  // 1. 주문 수정 저장
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert(isEvent ? "납품처 / 수령처 명칭을 입력해 주세요." : "고객 성함을 입력해 주세요.");
    if (!isEvent && !phone.trim()) return alert("전화번호를 입력해 주세요.");
    if (!isEvent && !address.trim()) return alert("배송지 주소를 입력해 주세요.");
    if (qty20kg < 1) return alert("수량을 1박스 이상 지정해 주세요.");

    const finalAddress = address.trim() || (isEvent ? "행사 현장 납품 (택배 없음)" : "");

    setIsSaving(true);
    try {
      await updateOrderDetailService({
        orderId: order.id,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        shippingDate: shippingDate,
        shippingAddress: finalAddress,
        shippingAddressDetail: addressDetail.trim(),
        orderType: isEvent ? "EVENT" : "NORMAL",
        eventName: isEvent ? (eventName.trim() || "임실 김치 축제") : null,
        items: [
          {
            product_id: 2,
            product_name: "절임배추 20kg",
            quantity: qty20kg,
            unit_price: unitPrice,
            weight_kg: 20,
          },
        ],
        paymentStatus,
        memo: memo.trim(),
      });

      const shareData: OrderCardData = {
        orderNo: order.order_no,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        shippingDate: shippingDate,
        shippingAddress: address.trim(),
        shippingAddressDetail: addressDetail.trim(),
        itemsSummary: `절임배추 20kg ${qty20kg}박스`,
        totalAmount,
        paymentStatus,
        memo: memo.trim(),
        shopName: settings?.shop_name || "임실참배추농원",
        shopPhone: settings?.shop_phone || settings?.phone || "010-0000-0000",
        extraPhones: parseExtraPhones(settings?.extra_phones),
        shareMessageTemplate: settings?.share_message_template,
        bankName: settings?.bank_name || "농협",
        bankAccount: settings?.bank_account || "",
        ownerName: settings?.owner_name || "",
      };

      setSavedShareData(shareData);
      setShowPostEditPrompt(true);
    } catch (err: any) {
      console.error(err);
      alert("주문 수정 중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 2. 주문 삭제 처리
  const handleDelete = async () => {
    if (
      !confirm(
        `정말로 ${name} 고객님의 주문(주문번호 #${order.order_no})을 삭제하시겠습니까?\n삭제된 주문은 복구할 수 없습니다.`
      )
    ) {
      return;
    }

    try {
      await deleteOrderService(order.id);
      alert("주문이 삭제되었습니다.");
      handleCloseSafely();
      if (onOrderDeleted) onOrderDeleted();
    } catch (err: any) {
      console.error(err);
      alert("주문 삭제 실패: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-3 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border-4 border-slate-700 animate-in fade-in zoom-in duration-150">
        {/* 모달 상단 헤더 */}
        <div className="bg-slate-900 text-white p-4 md:p-5 rounded-t-[20px] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xl md:text-2xl font-black">
              주문 상세 및 정보 수정
            </h3>
            <p className="text-xs text-slate-300 font-semibold mt-0.5">
              주문번호: #{order.order_no} | 등록일: {order.order_date || order.created_at?.slice(0, 10)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseSafely}
            className="text-white hover:bg-slate-800 p-2 rounded-full cursor-pointer transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 폼 본문 */}
        <form onSubmit={handleSave} className="p-3 md:p-4 overflow-y-auto space-y-2.5 flex-1">
          {/* 주문 구분: 일반 주문 vs 행사·축제 납품 */}
          <div className="bg-slate-100 p-2.5 rounded-xl border-2 border-slate-300 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs md:text-sm font-extrabold text-slate-800">
                주문 구분 설정
              </label>
              {isEvent && (
                <span className="text-xs font-black text-purple-800 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                  🎪 행사 납품 모드
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setIsEvent(false)}
                className={`py-1.5 px-2 rounded-lg font-black text-xs md:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all border-2 whitespace-nowrap ${
                  !isEvent
                    ? "bg-emerald-700 text-white border-emerald-800 shadow-sm"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>📦 일반 고객 주문</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEvent(true)}
                className={`py-1.5 px-2 rounded-lg font-black text-xs md:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all border-2 whitespace-nowrap ${
                  isEvent
                    ? "bg-purple-700 text-white border-purple-800 shadow-sm ring-2 ring-purple-300"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>🎪 행사·축제 납품</span>
              </button>
            </div>

            {isEvent && (
              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-2 space-y-1 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-purple-950">
                    행사 / 축제 명칭
                  </label>
                  <button
                    type="button"
                    onClick={() => setEventName("임실 김치 축제")}
                    className="text-[11px] font-bold bg-white text-purple-800 border border-purple-300 px-2 py-0.5 rounded-md hover:bg-purple-100 cursor-pointer whitespace-nowrap"
                  >
                    + 임실 김치 축제
                  </button>
                </div>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="예: 임실 김치 축제"
                  className="w-full text-sm font-black border-2 border-purple-400 rounded-lg px-2.5 py-1 bg-white text-purple-950 focus:border-purple-600 focus:outline-hidden"
                  required={isEvent}
                />
              </div>
            )}
          </div>

          {/* 고객명 & 전화번호 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-sm md:text-base font-bold text-slate-900 mb-0.5">
                {isEvent ? (
                  <span>납품처 / 수령처 명칭 <span className="text-red-600">*</span></span>
                ) : (
                  <span>고객 성함 (받는 분) <span className="text-red-600">*</span></span>
                )}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isEvent ? "예: 축제 본부석, 체험관" : "예: 홍길동"}
                className={`w-full text-base font-bold border-2 rounded-xl px-2.5 py-1.5 focus:outline-hidden ${
                  isEvent
                    ? "border-purple-300 focus:border-purple-600 bg-white"
                    : "border-slate-300 focus:border-emerald-600"
                }`}
                required
              />
            </div>
            <div>
              <label className="block text-sm md:text-base font-bold text-slate-900 mb-0.5 flex items-center justify-between">
                <span>{isEvent ? "현장 연락처" : "전화번호"} {!isEvent && <span className="text-red-600">*</span>}</span>
                {isEvent && <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded whitespace-nowrap">생략 가능</span>}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder={isEvent ? "예: 010-0000-0000 (선택)" : "예: 010-1234-5678"}
                className="w-full text-base font-bold border-2 border-slate-300 rounded-xl px-2.5 py-1.5 focus:border-emerald-600 focus:outline-hidden"
                required={!isEvent}
              />
            </div>
          </div>

          {/* 택배 도착 희망일 선택 */}
          <div className={`border-2 rounded-xl p-2.5 space-y-1.5 ${
            isEvent ? "bg-purple-50/70 border-purple-300" : "bg-emerald-50/70 border-emerald-400"
          }`}>
            <div className="flex justify-between items-center">
              <label className="text-sm md:text-base font-black text-slate-900">
                {isEvent ? "현장 납품 희망일" : "택배 도착 희망일 (배추 받는 날)"} <span className="text-red-600">*</span>
              </label>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                isEvent ? "text-purple-900 bg-purple-100" : "text-emerald-800 bg-emerald-100"
              }`}>
                {isEvent ? "행사 현장 납품 기준" : "소비자 수령 기준"}
              </span>
            </div>
            <input
              type="date"
              value={shippingDate}
              onChange={(e) => setShippingDate(e.target.value)}
              className={`w-full text-lg font-black border-2 rounded-xl px-2.5 py-1.5 bg-white ${
                isEvent ? "border-purple-400 focus:border-purple-600" : "border-emerald-500 focus:border-emerald-700"
              }`}
              required
            />
          </div>

          {/* 배송 주소 / 납품 장소 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm md:text-base font-bold text-slate-900 mb-0.5">
                {isEvent ? "납품 장소 / 부스 위치" : "배송지 주소"} {!isEvent && <span className="text-red-600">*</span>}
              </label>
              {isEvent && (
                <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded whitespace-nowrap">
                  생략 가능 (행사 현장 직납)
                </span>
              )}
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isEvent ? "예: 축제장 종합안내소 옆 (선택/불필요 시 비워두셔도 됩니다)" : "기본 도로명/지번 주소"}
              className="w-full text-base font-bold border-2 border-slate-300 rounded-xl px-2.5 py-1.5 focus:border-emerald-600 focus:outline-hidden"
              required={!isEvent}
            />
            <input
              type="text"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              placeholder={isEvent ? "상세 위치 메모 (선택)" : "동/호수, 마을이름 등 상세 주소 (선택)"}
              className="w-full text-sm border-2 border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {/* 절임배추 20kg 수량 변경 */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-2.5 space-y-1.5">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-base font-black text-slate-900">
                  절임배추 20kg
                </span>
                <div className="text-xs text-slate-500 font-bold">
                  단가: {formatPrice(unitPrice)}원 / 1박스
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQty20kg((prev) => Math.max(1, prev - 1))}
                  className="w-9 h-9 bg-white border-2 border-slate-300 rounded-xl text-lg font-black flex items-center justify-center hover:bg-slate-100 active:scale-95 cursor-pointer shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-2xl font-black w-8 text-center stat-number text-slate-900">
                  {qty20kg}
                </span>
                <button
                  type="button"
                  onClick={() => setQty20kg((prev) => prev + 1)}
                  className="w-9 h-9 bg-emerald-700 text-white rounded-xl text-lg font-black flex items-center justify-center hover:bg-emerald-800 active:scale-95 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center text-xs md:text-sm font-bold">
              <span className="text-slate-600">총 결제 금액:</span>
              <span className="text-lg font-black text-amber-600 stat-number">
                {formatPrice(totalAmount)}원
              </span>
            </div>
          </div>

          {/* 입금 여부 */}
          <div>
            <label className="block text-sm md:text-base font-bold text-slate-900 mb-0.5">
              입금 상태
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentStatus("UNPAID")}
                className={`py-1.5 rounded-xl font-black text-sm md:text-base border-2 cursor-pointer transition-all whitespace-nowrap ${
                  paymentStatus === "UNPAID"
                    ? "bg-red-50 text-red-700 border-red-400 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                입금 대기 (미입금)
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus("PAID")}
                className={`py-1.5 rounded-xl font-black text-sm md:text-base border-2 cursor-pointer transition-all whitespace-nowrap ${
                  paymentStatus === "PAID"
                    ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                입금 완료
              </button>
            </div>
          </div>

          {/* 고객 메모 */}
          <div>
            <label className="block text-sm md:text-base font-bold text-slate-900 mb-0.5">
              배송 / 주문 메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 문 앞에 놓아주세요 / 오후 배송 요망"
              rows={2}
              className="w-full text-sm md:text-base border-2 border-slate-200 rounded-xl px-2.5 py-1.5 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {/* 하단 저장 & 삭제 버튼 */}
          <div className="pt-1.5 flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-xl font-bold text-sm md:text-base flex items-center justify-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="주문 영구 삭제"
            >
              <Trash2 className="w-4 h-4 text-red-600 shrink-0" />
              <span>주문 삭제</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl font-black text-base md:text-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{isSaving ? "저장 중..." : "수정 완료 저장"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 수정 완료 후 문자/카톡 발송 여부 확인 팝업 */}
      {showPostEditPrompt && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl border-4 border-emerald-600 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-900">
                주문 수정이 완료되었습니다!
              </h3>
              <p className="text-base text-slate-600 mt-2 font-semibold leading-relaxed">
                고객님(<strong>{name}</strong>)에게 변경된 택배 도착일과 주문 내역을 <strong>문자나 카카오톡으로 발송</strong>하시겠습니까?
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPostEditPrompt(false);
                  handleCloseSafely();
                  onOrderUpdated(savedShareData || undefined);
                }}
                className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-lg font-black flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition-all"
              >
                <Share2 className="w-5 h-5" />
                <span>예, 문자·카톡 발송하기</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPostEditPrompt(false);
                  handleCloseSafely();
                  onOrderUpdated(undefined);
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-base font-bold cursor-pointer transition-colors"
              >
                발송 안 함 (수정만 완료)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
