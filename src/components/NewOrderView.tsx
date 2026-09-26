"use client";

import React, { useState, useEffect } from "react";
import { formatPrice } from "@/lib/utils";
import { Plus, Minus, UserCheck } from "lucide-react";
import { format, addDays } from "date-fns";
import {
  fetchSettingsService,
  fetchCustomersService,
  createOrderService,
} from "@/lib/services";

interface NewOrderViewProps {
  settings: {
    shop_name?: string;
    bank_name?: string;
    bank_account?: string;
    owner_name?: string;
  };
  onOrderSaved: () => void;
  onRequestConfig: () => void;
  initialShippingDate?: string;
}

export function NewOrderView({
  settings,
  onOrderSaved,
  onRequestConfig,
  initialShippingDate,
}: NewOrderViewProps) {
  // 고객 정보
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [memo, setMemo] = useState("");

  // 기존 고객 자동검색 결과
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);

  // 상품 단가 및 수량
  const [products, setProducts] = useState<any[]>([]);
  const [qty10kg, setQty10kg] = useState(0);
  const [qty20kg, setQty20kg] = useState(1); // 기본 20kg 1박스

  // 출고일 (달력에서 선택한 날짜가 있으면 우선 반영)
  const [shippingDate, setShippingDate] = useState(() => {
    return initialShippingDate || format(addDays(new Date(), 1), "yyyy-MM-dd");
  });

  useEffect(() => {
    if (initialShippingDate) {
      setShippingDate(initialShippingDate);
    }
  }, [initialShippingDate]);

  // 입금 상태
  const [paymentStatus, setPaymentStatus] = useState<"UNPAID" | "PAID">("UNPAID");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 상품 목록 불러오기
  useEffect(() => {
    fetchSettingsService()
      .then((data) => {
        if (data.products) {
          setProducts(data.products);
        }
      })
      .catch((e) => {
        if (e.message === "DB_NOT_CONFIGURED") {
          onRequestConfig();
        }
      });
  }, [onRequestConfig]);

  // 전화번호 뒷자리 또는 입력 시 기존 고객 검색
  useEffect(() => {
    const clean = phone.replace(/[^0-9]/g, "");
    if (clean.length >= 3) {
      fetchCustomersService(clean)
        .then((res) => {
          setCustomerSuggestions(res || []);
        })
        .catch(() => setCustomerSuggestions([]));
    } else {
      setCustomerSuggestions([]);
    }
  }, [phone]);

  const selectExistingCustomer = (cust: any) => {
    setName(cust.name || "");
    setPhone(cust.phone || "");
    setAddress(cust.address || "");
    setAddressDetail(cust.address_detail || "");
    setCustomerSuggestions([]);
  };

  const product10 = products.find((p) => Number(p.weight_kg) === 10) || {
    id: 1,
    name: "절임배추 10kg",
    price: 38000,
    weight_kg: 10,
  };
  const product20 = products.find((p) => Number(p.weight_kg) === 20) || {
    id: 2,
    name: "절임배추 20kg",
    price: 68000,
    weight_kg: 20,
  };

  const totalAmount =
    qty10kg * Number(product10.price) + qty20kg * Number(product20.price);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("고객 이름을 입력해 주세요.");
      return;
    }
    if (!phone.trim()) {
      alert("전화번호를 입력해 주세요.");
      return;
    }
    if (!address.trim()) {
      alert("배송지 주소를 입력해 주세요.");
      return;
    }
    if (qty10kg === 0 && qty20kg === 0) {
      alert("10kg 또는 20kg 수량을 1개 이상 선택해 주세요.");
      return;
    }

    const items = [];
    if (qty10kg > 0) {
      items.push({
        product_id: product10.id,
        product_name: product10.name,
        quantity: qty10kg,
        unit_price: product10.price,
        weight_kg: 10,
      });
    }
    if (qty20kg > 0) {
      items.push({
        product_id: product20.id,
        product_name: product20.name,
        quantity: qty20kg,
        unit_price: product20.price,
        weight_kg: 20,
      });
    }

    setIsSubmitting(true);
    try {
      await createOrderService({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        address_detail: addressDetail.trim(),
        shipping_date: shippingDate,
        items,
        payment_status: paymentStatus,
        memo: memo.trim(),
      });

      alert("주문이 성공적으로 등록되었습니다!");
      onOrderSaved();
    } catch (e: any) {
      alert("주문 처리 중 오류가 발생했습니다: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 md:p-8 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 border-b border-slate-200 pb-4">
          새 주문 입력
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. 전화번호 및 기존 고객 자동완성 */}
          <div>
            <label className="block text-lg md:text-xl font-extrabold text-slate-900 mb-2">
              전화번호 (뒷자리 또는 전체) <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="예: 010-1234-5678 또는 뒷 4자리"
              className="w-full text-xl md:text-2xl font-bold border-2 border-slate-300 rounded-xl px-4 py-3.5 focus:border-emerald-600 focus:outline-hidden bg-slate-50"
              required
            />

            {customerSuggestions.length > 0 && (
              <div className="mt-2 bg-emerald-50 border-2 border-emerald-400 rounded-xl p-3 space-y-2">
                <div className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" />
                  <span>기존 고객이 검색되었습니다. 터치하면 주소가 자동 입력됩니다:</span>
                </div>
                <div className="space-y-1.5">
                  {customerSuggestions.map((cust) => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => selectExistingCustomer(cust)}
                      className="w-full text-left bg-white hover:bg-emerald-100 p-3 rounded-lg border border-emerald-200 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div>
                        <span className="text-lg font-bold text-slate-900 mr-3">
                          {cust.name}
                        </span>
                        <span className="text-base text-slate-600">{cust.phone}</span>
                        <div className="text-sm text-slate-500 truncate">
                          {cust.address} {cust.address_detail}
                        </div>
                      </div>
                      <span className="bg-emerald-700 text-white text-xs font-bold px-2.5 py-1 rounded-sm">
                        선택
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. 고객 이름 */}
          <div>
            <label className="block text-lg md:text-xl font-extrabold text-slate-900 mb-2">
              고객 이름 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 홍길동"
              className="w-full text-xl font-bold border-2 border-slate-300 rounded-xl px-4 py-3 focus:border-emerald-600 focus:outline-hidden"
              required
            />
          </div>

          {/* 3. 배송지 주소 */}
          <div>
            <label className="block text-lg md:text-xl font-extrabold text-slate-900 mb-2">
              배송 주소 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="시·군·구·도로명 주소"
              className="w-full text-xl font-bold border-2 border-slate-300 rounded-xl px-4 py-3 mb-2 focus:border-emerald-600 focus:outline-hidden"
              required
            />
            <input
              type="text"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              placeholder="동/호수, 마을이름 등 상세 주소 (선택)"
              className="w-full text-lg font-medium border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {/* 4. 포장 단위 및 수량 선택 */}
          <div className="border-t border-b border-slate-200 py-6 space-y-4">
            <h2 className="text-xl md:text-2xl font-black text-slate-900">
              주문 품목 및 수량
            </h2>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xl font-black text-slate-900">
                  {product10.name}
                </div>
                <div className="text-base font-bold text-slate-600">
                  단가: {formatPrice(product10.price)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty10kg((prev) => Math.max(0, prev - 1))}
                  className="w-14 h-14 bg-white border-2 border-slate-300 rounded-xl text-2xl font-black flex items-center justify-center hover:bg-slate-100 active:scale-95 cursor-pointer"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <span className="text-3xl font-black w-14 text-center stat-number">
                  {qty10kg}
                </span>
                <button
                  type="button"
                  onClick={() => setQty10kg((prev) => prev + 1)}
                  className="w-14 h-14 bg-emerald-600 text-white rounded-xl text-2xl font-black flex items-center justify-center hover:bg-emerald-700 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xl font-black text-slate-900">
                  {product20.name}
                </div>
                <div className="text-base font-bold text-slate-600">
                  단가: {formatPrice(product20.price)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty20kg((prev) => Math.max(0, prev - 1))}
                  className="w-14 h-14 bg-white border-2 border-slate-300 rounded-xl text-2xl font-black flex items-center justify-center hover:bg-slate-100 active:scale-95 cursor-pointer"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <span className="text-3xl font-black w-14 text-center stat-number">
                  {qty20kg}
                </span>
                <button
                  type="button"
                  onClick={() => setQty20kg((prev) => prev + 1)}
                  className="w-14 h-14 bg-emerald-600 text-white rounded-xl text-2xl font-black flex items-center justify-center hover:bg-emerald-700 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* 5. 출고 희망일 선택 */}
          <div>
            <label className="block text-lg md:text-xl font-extrabold text-slate-900 mb-2">
              출고 예정일 <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={shippingDate}
              onChange={(e) => setShippingDate(e.target.value)}
              className="w-full text-xl font-bold border-2 border-slate-300 rounded-xl px-4 py-3.5 focus:border-emerald-600 focus:outline-hidden bg-slate-50"
              required
            />
          </div>

          {/* 6. 입금 상태 선택 */}
          <div>
            <label className="block text-lg md:text-xl font-extrabold text-slate-900 mb-2">
              입금 여부
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentStatus("UNPAID")}
                className={`btn-large rounded-xl border-2 cursor-pointer transition-all ${
                  paymentStatus === "UNPAID"
                    ? "bg-red-50 border-red-500 text-red-900 font-black shadow-xs"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              >
                미입금 (입금 대기)
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus("PAID")}
                className={`btn-large rounded-xl border-2 cursor-pointer transition-all ${
                  paymentStatus === "PAID"
                    ? "bg-blue-50 border-blue-600 text-blue-900 font-black shadow-xs"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              >
                입금 완료 (확인됨)
              </button>
            </div>
          </div>

          {/* 7. 배송 메모 */}
          <div>
            <label className="block text-lg font-bold text-slate-800 mb-2">
              배송 및 고객 요청사항 (선택)
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 문 앞에 놓아주세요 / 오후 배송 요망"
              className="w-full text-base border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {/* 8. 총 금액 요약 */}
          <div className="bg-slate-900 text-white rounded-2xl p-6">
            <div className="flex justify-between items-center text-xl font-bold mb-2">
              <span>총 주문 금액:</span>
              <span className="text-3xl md:text-4xl font-black text-amber-400 stat-number">
                {formatPrice(totalAmount)}
              </span>
            </div>
            <div className="text-sm text-slate-300 border-t border-slate-800 pt-3 mt-3">
              입금 안내 계좌: {settings.bank_name || "농협"} {settings.bank_account || "351-0000-0000-00"} ({settings.owner_name || "대표자"})
            </div>
          </div>

          {/* 9. 저장 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-large bg-emerald-600 hover:bg-emerald-700 text-white text-2xl font-black py-4 rounded-xl shadow-md cursor-pointer transition-colors"
          >
            {isSubmitting ? "주문 저장 중..." : "주문 저장하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
