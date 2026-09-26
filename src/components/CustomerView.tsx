"use client";

import React, { useState, useEffect } from "react";
import { formatPrice } from "@/lib/utils";
import { Phone, MessageSquare, MapPin } from "lucide-react";
import { fetchCustomersService, fetchCustomerDetailService } from "@/lib/services";

interface CustomerViewProps {
  onRequestConfig: () => void;
}

export function CustomerView({ onRequestConfig }: CustomerViewProps) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);

  const fetchCustomers = async (searchQuery: string = "") => {
    setLoading(true);
    try {
      const res = await fetchCustomersService(searchQuery);
      setCustomers(res || []);
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
    fetchCustomers("");
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(query);
  };

  const loadCustomerDetail = async (id: number) => {
    setSelectedCustomerId(id);
    try {
      const res = await fetchCustomerDetailService(id);
      setCustomerDetail(res);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="bg-white p-6 rounded-2xl border-2 border-slate-300 shadow-xs">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="고객 이름 또는 전화번호 뒷자리 검색"
            className="flex-1 text-xl font-bold border-2 border-slate-300 rounded-xl px-4 py-3.5 focus:border-emerald-600 focus:outline-hidden"
          />
          <button
            type="submit"
            className="btn-large px-8 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer transition-colors"
          >
            검색
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900 border-b border-slate-200 pb-3 mb-4">
            등록된 단골 고객 목록 ({customers.length}명)
          </h2>

          {loading ? (
            <div className="py-12 text-center text-lg font-bold text-slate-600">
              불러오는 중...
            </div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-lg">
              일치하는 고객 정보가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {customers.map((c) => (
                <div
                  key={c.id}
                  onClick={() => loadCustomerDetail(c.id)}
                  className={`py-4 cursor-pointer hover:bg-slate-50 p-3 rounded-xl transition-colors ${
                    selectedCustomerId === c.id ? "bg-emerald-50 border-2 border-emerald-400" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-2xl font-black text-slate-900 mr-3">
                        {c.name}
                      </span>
                      <span className="text-lg font-bold text-slate-700">
                        {c.phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${c.phone.replace(/[^0-9]/g, "")}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold"
                      >
                        <Phone className="w-4 h-4" />
                        <span>전화</span>
                      </a>
                      <a
                        href={`sms:${c.phone.replace(/[^0-9]/g, "")}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>문자</span>
                      </a>
                    </div>
                  </div>

                  <div className="text-base text-slate-700 mt-1 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>
                      {c.address} {c.address_detail}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-500 mt-1">
                    총 {c.order_count}회 주문
                    {c.last_order_date && ` (최근 주문: ${c.last_order_date})`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 border-b border-slate-200 pb-3 mb-4">
            과거 주문 이력
          </h3>

          {!customerDetail ? (
            <div className="py-12 text-center text-slate-500 text-base">
              왼쪽에서 고객을 선택하면 과거 주문 내역이 여기에 표시됩니다.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-100 p-4 rounded-xl">
                <div className="text-2xl font-black text-slate-900">
                  {customerDetail.customer.name} 님
                </div>
                <div className="text-base font-bold text-slate-700 mt-1">
                  {customerDetail.customer.phone}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-base font-extrabold text-slate-800">
                  주문 기록 ({customerDetail.orders?.length || 0}건)
                </div>

                {customerDetail.orders?.length === 0 ? (
                  <div className="text-slate-500 text-sm">주문 기록이 없습니다.</div>
                ) : (
                  customerDetail.orders?.map((ord: any) => (
                    <div
                      key={ord.id}
                      className="border border-slate-300 rounded-xl p-3 bg-slate-50 text-sm space-y-1"
                    >
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>출고일: {ord.shipping_date}</span>
                        <span className="text-emerald-700 font-extrabold">
                          {formatPrice(ord.total_amount)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        주문번호: {ord.order_no}
                      </div>
                      <div className="flex justify-between text-xs font-semibold pt-1">
                        <span>
                          {ord.payment_status === "PAID" ? "입금완료" : "미입금"}
                        </span>
                        <span>
                          {ord.order_status === "SHIPPED"
                            ? "발송완료"
                            : ord.order_status === "PACKED"
                            ? "포장완료"
                            : "접수"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
