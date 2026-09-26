"use client";

import React, { useState, useEffect } from "react";
import { formatPrice } from "@/lib/utils";
import { Save, Building2, Phone, Tag, Database } from "lucide-react";
import { fetchSettingsService, saveSettingsService } from "@/lib/services";
import { getStoredTursoConfig } from "@/lib/clientDb";

interface SettingsViewProps {
  onSettingsUpdated: () => void;
  onRequestConfig: () => void;
}

export function SettingsView({
  onSettingsUpdated,
  onRequestConfig,
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
  const currentTurso = getStoredTursoConfig();

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
        if (e.message === "DB_NOT_CONFIGURED") {
          onRequestConfig();
        }
      })
      .finally(() => setLoading(false));
  }, [onRequestConfig]);

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
      {/* 1. Turso DB 연결 상태 카드 */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Database className="w-5 h-5 text-emerald-700" />
            <span>Turso 데이터베이스 연결 정보</span>
          </div>
          <p className="text-sm text-slate-600 mt-1 font-mono truncate max-w-md">
            연결 URL: {currentTurso?.url || "미설정"}
          </p>
        </div>

        <button
          type="button"
          onClick={onRequestConfig}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm cursor-pointer transition-colors"
        >
          DB 연결 정보 변경
        </button>
      </div>

      {/* 2. 농가 정보 및 단가 설정 폼 */}
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

          {/* 절임배추 단가 설정 */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-700" />
              <span>절임배추 상자별 판매 가격</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-300">
                <label className="block text-lg font-black text-slate-900 mb-2">
                  절임배추 10kg 단가 (원)
                </label>
                <input
                  type="number"
                  value={price10kg}
                  onChange={(e) => setPrice10kg(Number(e.target.value))}
                  step="1000"
                  className="w-full text-2xl font-black border-2 border-slate-300 rounded-lg px-4 py-3 stat-number"
                  required
                />
                <div className="text-sm font-semibold text-slate-500 mt-1">
                  현재 설정: {formatPrice(price10kg)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-300">
                <label className="block text-lg font-black text-slate-900 mb-2">
                  절임배추 20kg 단가 (원)
                </label>
                <input
                  type="number"
                  value={price20kg}
                  onChange={(e) => setPrice20kg(Number(e.target.value))}
                  step="1000"
                  className="w-full text-2xl font-black border-2 border-slate-300 rounded-lg px-4 py-3 stat-number"
                  required
                />
                <div className="text-sm font-semibold text-slate-500 mt-1">
                  현재 설정: {formatPrice(price20kg)}
                </div>
              </div>
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
