"use client";

import React, { useState, useEffect } from "react";
import { formatPrice } from "@/lib/utils";
import { Save, Building2, Phone, Tag } from "lucide-react";
import { fetchSettingsService, saveSettingsService } from "@/lib/services";

interface SettingsViewProps {
  onSettingsUpdated: () => void;
}

export function SettingsView({
  onSettingsUpdated,
}: SettingsViewProps) {
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [defaultCourier, setDefaultCourier] = useState("우체국택배");

  const [price10kg, setPrice10kg] = useState(38000);
  const [price20kg, setPrice20kg] = useState(68000);
  const [product10Id, setProduct10Id] = useState<number | null>(null);
  const [product20Id, setProduct20Id] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettingsService()
      .then((data) => {
        if (data.settings) {
          setShopName(data.settings.shop_name || "임실 절임배추");
          setShopPhone(data.settings.shop_phone || "010-0000-0000");
          setBankName(data.settings.bank_name || "농협");
          setBankAccount(data.settings.bank_account || "351-0000-0000-00");
          setOwnerName(data.settings.owner_name || "대표자");
          setDefaultCourier(data.settings.default_courier || "우체국택배");
        }
        if (data.products && Array.isArray(data.products)) {
          for (const p of data.products) {
            if (Number(p.weight_kg) === 10) {
              setPrice10kg(Number(p.price));
              setProduct10Id(Number(p.id));
            }
            if (Number(p.weight_kg) === 20) {
              setPrice20kg(Number(p.price));
              setProduct20Id(Number(p.id));
            }
          }
        }
      })
      .catch((e) => {
        console.error("Failed to load settings:", e);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettingsService(
        {
          shop_name: shopName,
          shop_phone: shopPhone,
          bank_name: bankName,
          bank_account: bankAccount,
          owner_name: ownerName,
          default_courier: defaultCourier,
        },
        [
          { id: product10Id!, price: price10kg },
          { id: product20Id!, price: price20kg },
        ].filter((p) => p.id !== null)
      );

      alert("농가 정보 및 판매 단가가 저장되었습니다.");
      onSettingsUpdated();
    } catch (e: any) {
      alert("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xl font-bold text-slate-700">
        설정 정보를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-6">
      {/* 농가 정보 및 단가 설정 폼 */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 md:p-8 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 border-b border-slate-200 pb-4 mb-6">
          농가 기본 정보 및 판매 단가 설정
        </h1>

        <form onSubmit={handleSave} className="space-y-6">
          {/* 상호명 및 대표 전화번호 */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-700" />
              <span>농가 상호 및 연락처</span>
            </h2>

            <div>
              <label className="block text-base font-bold text-slate-800 mb-1">
                상호명
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full text-lg font-bold border-2 border-slate-300 rounded-lg px-4 py-2.5 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-base font-bold text-slate-800 mb-1">
                실제 대표 전화번호
              </label>
              <input
                type="text"
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                className="w-full text-lg font-bold border-2 border-slate-300 rounded-lg px-4 py-2.5 bg-white"
                required
              />
            </div>
          </div>

          {/* 실제 입금 계좌정보 */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-600" />
              <span>실제 입금 계좌정보</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-base font-bold text-slate-800 mb-1">
                  은행명
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full text-lg font-bold border-2 border-slate-300 rounded-lg px-4 py-2.5 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-800 mb-1">
                  예금주
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full text-lg font-bold border-2 border-slate-300 rounded-lg px-4 py-2.5 bg-white"
                  required
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-base font-bold text-slate-800 mb-1">
                  기본 택배사
                </label>
                <input
                  type="text"
                  value={defaultCourier}
                  onChange={(e) => setDefaultCourier(e.target.value)}
                  className="w-full text-lg font-bold border-2 border-slate-300 rounded-lg px-4 py-2.5 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-bold text-slate-800 mb-1">
                계좌번호
              </label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="예: 351-0000-0000-00"
                className="w-full text-lg font-bold border-2 border-slate-300 rounded-lg px-4 py-2.5 bg-white"
                required
              />
            </div>
          </div>

          {/* 판매 상품 단가 설정 */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-700" />
                <span>판매 상품 단가 설정</span>
              </h2>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md">
                현재 판매 품목: 절임배추 20kg 단일 규격
              </span>
            </div>

            <div className="bg-emerald-50/80 p-5 rounded-2xl border-2 border-emerald-400 space-y-2">
              <label className="block text-xl font-black text-emerald-950 mb-1">
                절임배추 20kg (1박스) 판매 단가 (원) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                value={price20kg}
                onChange={(e) => setPrice20kg(Number(e.target.value))}
                step="1000"
                className="w-full text-3xl font-black border-2 border-emerald-500 rounded-xl px-4 py-3 stat-number bg-white text-emerald-950 focus:border-emerald-700 focus:outline-hidden"
                required
              />
              <div className="text-sm font-black text-emerald-800">
                현재 주문서 적용 단가: {formatPrice(price20kg)}원
              </div>
            </div>

            <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 text-xs md:text-sm text-slate-600 font-medium leading-relaxed">
              💡 <strong>상품 확장 안내:</strong> 현재는 <strong>절임배추 20kg</strong> 단일 규격으로만 주문 접수됩니다. 추후 알타리김치, 갓김치, 고춧가루 또는 10kg 포장 등 추가 품목 판매 시 관리자 설정에서 즉시 확장할 수 있도록 시스템이 구축되어 있습니다.
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full btn-large bg-slate-900 hover:bg-slate-800 text-white text-xl font-black py-4 rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            <Save className="w-6 h-6 text-emerald-400" />
            <span>{saving ? "저장 중..." : "설정 저장하기"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
