"use client";

import React, { useState, useEffect, useRef } from "react";
import { formatPrice } from "@/lib/utils";
import {
  Save,
  Building2,
  Phone,
  Tag,
  MessageSquare,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Eye,
  CheckCircle2,
  Info,
} from "lucide-react";
import { fetchSettingsService, saveSettingsService } from "@/lib/services";
import {
  ExtraPhone,
  parseExtraPhones,
  DEFAULT_SHARE_MESSAGE_TEMPLATE,
  AVAILABLE_TEMPLATE_VARIABLES,
  generateOrderShareMessage,
} from "@/lib/orderShareMessage";

interface SettingsViewProps {
  onSettingsUpdated: () => void;
}

const QUICK_PHONE_LABELS = ["배송문의", "농장직통", "사모님", "관리자", "작업장"];

export function SettingsView({
  onSettingsUpdated,
}: SettingsViewProps) {
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [extraPhones, setExtraPhones] = useState<ExtraPhone[]>([]);
  const [shareMessageTemplate, setShareMessageTemplate] = useState(DEFAULT_SHARE_MESSAGE_TEMPLATE);

  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [defaultCourier, setDefaultCourier] = useState("우체국택배");

  const [price10kg, setPrice10kg] = useState(38000);
  const [price20kg, setPrice20kg] = useState(68000);
  const [product10Id, setProduct10Id] = useState<number | null>(null);
  const [product20Id, setProduct20Id] = useState<number | null>(null);

  const [previewTab, setPreviewTab] = useState<"unpaid" | "paid">("unpaid");
  const [showPreview, setShowPreview] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          
          if (data.settings.extra_phones) {
            setExtraPhones(parseExtraPhones(data.settings.extra_phones));
          }

          if (data.settings.share_message_template) {
            setShareMessageTemplate(data.settings.share_message_template);
          } else {
            setShareMessageTemplate(DEFAULT_SHARE_MESSAGE_TEMPLATE);
          }
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

  // 추가 연락처 추가
  const handleAddExtraPhone = (defaultLabel = "") => {
    setExtraPhones((prev) => [
      ...prev,
      {
        id: "phone-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        label: defaultLabel || "",
        phone: "",
      },
    ]);
  };

  // 추가 연락처 수정
  const handleUpdateExtraPhone = (id: string, field: "label" | "phone", value: string) => {
    setExtraPhones((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // 추가 연락처 삭제
  const handleRemoveExtraPhone = (id: string) => {
    setExtraPhones((prev) => prev.filter((item) => item.id !== id));
  };

  // 템플릿 변수 태그 삽입
  const handleInsertTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) {
      setShareMessageTemplate((prev) => prev + " " + tag);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = shareMessageTemplate;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const nextText = before + tag + after;

    setShareMessageTemplate(nextText);

    setTimeout(() => {
      el.focus();
      const newPos = start + tag.length;
      el.setSelectionRange(newPos, newPos);
    }, 10);
  };

  // 기본 문구로 복원
  const handleResetTemplate = () => {
    if (confirm("문자/카톡 발송 문구를 기본 추천 문구로 되돌리시겠습니까?")) {
      setShareMessageTemplate(DEFAULT_SHARE_MESSAGE_TEMPLATE);
    }
  };

  // 저장 처리
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 빈 추가 연락처 필터링
      const validExtraPhones = extraPhones.filter(
        (p) => p.phone.trim() !== "" || p.label.trim() !== ""
      );

      await saveSettingsService(
        {
          shop_name: shopName.trim(),
          shop_phone: shopPhone.trim(),
          extra_phones: JSON.stringify(validExtraPhones),
          share_message_template: shareMessageTemplate.trim(),
          bank_name: bankName.trim(),
          bank_account: bankAccount.trim(),
          owner_name: ownerName.trim(),
          default_courier: defaultCourier.trim(),
        },
        [
          { id: product10Id!, price: price10kg },
          { id: product20Id!, price: price20kg },
        ].filter((p) => p.id !== null)
      );

      alert("농가 정보, 대표/추가 연락처 및 카톡·문자 발송 문구가 성공적으로 저장되었습니다.");
      onSettingsUpdated();
    } catch (e: any) {
      alert("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // 실시간 미리보기 샘플 데이터 생성
  const previewSampleData = {
    orderNo: "ORD-20261105-001",
    customerName: "홍길동",
    customerPhone: "010-9876-5432",
    shippingDate: "2026-11-20(금)",
    shippingAddress: "전북 임실군 임실읍 봉황로 123",
    shippingAddressDetail: "101동 202호",
    itemsSummary: `절임배추 20kg 2박스`,
    totalAmount: price20kg * 2,
    paymentStatus: previewTab === "paid" ? "PAID" : "UNPAID",
    memo: "경비실에 맡겨주세요",
    shopName: shopName || "임실참배추농원",
    shopPhone: shopPhone || "010-8452-9988",
    extraPhones: extraPhones.filter((p) => p.phone.trim() !== ""),
    bankName: bankName || "농협",
    bankAccount: bankAccount || "351-0000-0000-00",
    ownerName: ownerName || "대표자",
  };

  const previewMessageText = generateOrderShareMessage(
    previewSampleData,
    shareMessageTemplate
  );

  if (loading) {
    return (
      <div className="py-20 text-center text-xl font-bold text-slate-700">
        설정 정보를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      {/* 상단 타이틀 */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 md:p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              시스템 환경 설정
            </h1>
            <p className="text-sm text-slate-500 font-semibold mt-1">
              농가 상호, 실제 대표/추가 연락처 및 고객 문자·카톡 발송 문구를 설정합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-large bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-base md:text-lg font-black px-6 py-3 rounded-xl cursor-pointer flex items-center gap-2 shadow-md transition-all shrink-0 whitespace-nowrap"
          >
            <Save className="w-5 h-5 text-emerald-200" />
            <span>{saving ? "저장 중..." : "설정 저장"}</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* 1. 상호명 및 실제 대표/추가 연락처 설정 */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 md:p-6 space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                <Phone className="w-6 h-6 text-emerald-700" />
                <span>농가 상호 및 연락처 관리</span>
              </h2>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
                실제 대표 연락처와 추가 연락처를 등록하여 문자·카톡 및 영수증 카드에 맞춤 표기합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-bold text-slate-800 mb-1">
                  농가 상호명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="예: 임실 절임배추"
                  className="w-full text-lg font-bold border-2 border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-base font-bold text-emerald-950 mb-1 flex items-center justify-between">
                  <span>
                    실제 대표 전화번호 (대표 연락처) <span className="text-red-500">*</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    기본 대표
                  </span>
                </label>
                <input
                  type="text"
                  value={shopPhone}
                  onChange={(e) => setShopPhone(e.target.value)}
                  placeholder="예: 010-8452-9988"
                  className="w-full text-lg font-bold border-2 border-emerald-500 rounded-xl px-4 py-2.5 bg-white focus:border-emerald-700 focus:outline-hidden text-emerald-950"
                  required
                />
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  ※ 고객 주문 접수 문자, 영수증 카드의 최우선 대표 번호로 적용됩니다.
                </p>
              </div>
            </div>

            {/* 추가 연락처 관리 */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                    <span>추가 연락처 목록</span>
                    <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                      {extraPhones.length}개 등록됨
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    배송 담당자, 농장 직통, 가족/관리자 등 추가 안내할 번호를 등록할 수 있습니다.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {QUICK_PHONE_LABELS.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => handleAddExtraPhone(lbl)}
                      className="text-xs font-bold text-slate-700 bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-slate-300 hover:border-emerald-300 px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                    >
                      + {lbl}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddExtraPhone("")}
                    className="text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>연락처 직접 추가</span>
                  </button>
                </div>
              </div>

              {extraPhones.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4 text-center text-slate-500 text-sm font-medium">
                  등록된 추가 연락처가 없습니다. 상단의 <strong>[+ 배송문의]</strong> 또는 <strong>[연락처 직접 추가]</strong> 버튼으로 추가해 보세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {extraPhones.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-300 shadow-2xs animate-in fade-in duration-100"
                    >
                      <span className="text-xs font-black text-slate-400 w-5 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-full sm:w-36 shrink-0">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) =>
                            handleUpdateExtraPhone(item.id, "label", e.target.value)
                          }
                          placeholder="구분 (예: 배송문의)"
                          className="w-full text-sm font-bold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <input
                          type="text"
                          value={item.phone}
                          onChange={(e) =>
                            handleUpdateExtraPhone(item.id, "phone", e.target.value)
                          }
                          placeholder="전화번호 (예: 010-1234-5678)"
                          className="w-full text-sm font-bold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraPhone(item.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="연락처 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. 카톡 / 문자 발송 문구 설정 (핵심 신규 기능) */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 md:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-emerald-700" />
                  <span>카톡 / 문자 발송 문구 설정</span>
                </h2>
                <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
                  고객 주문 확인 시 카카오톡 또는 문자로 자동 전송되는 안내 문구를 직접 편집하고 저장합니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                  title="기본 추천 문구로 되돌리기"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>기본 문구 복원</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview((prev) => !prev)}
                  className={`text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                    showPreview
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-white text-slate-700 border border-slate-300"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showPreview ? "미리보기 닫기" : "미리보기 보기"}</span>
                </button>
              </div>
            </div>

            {/* 치환 변수 삽입 도구 모음 */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <Sparkles className="w-3.5 h-3.5" />
                <span>클릭하면 해당 위치에 자동 삽입되는 변수 목록:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleInsertTag(v.tag)}
                    title={`${v.description} (예시: ${v.example})`}
                    className="text-xs font-extrabold text-slate-700 hover:text-emerald-800 bg-slate-100 hover:bg-emerald-50 border border-slate-300 hover:border-emerald-400 px-2.5 py-1 rounded-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  >
                    {v.tag}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                💡 팁: <strong>{`{입금계좌안내}`}</strong>를 넣으면 고객의 입금 여부에 따라 계좌번호 안내 또는 입금 확인 문구가 자동으로 교체됩니다.
              </p>
            </div>

            {/* 템플릿 텍스트 입력창 & 실시간 미리보기 (2단 그리드) */}
            <div className={`grid grid-cols-1 ${showPreview ? "lg:grid-cols-2" : ""} gap-4`}>
              {/* 왼쪽: 에디터 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 px-1">
                  <span>발송 문구 템플릿 편집</span>
                  <span className="text-slate-400 font-medium">
                    {shareMessageTemplate.length}자 &middot; {shareMessageTemplate.split("\n").length}줄
                  </span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={shareMessageTemplate}
                  onChange={(e) => setShareMessageTemplate(e.target.value)}
                  rows={16}
                  placeholder="카톡 / 문자 발송 문구를 입력하세요..."
                  className="w-full text-sm md:text-base font-mono border-2 border-slate-300 rounded-xl p-3.5 focus:border-emerald-600 focus:outline-hidden bg-white text-slate-900 leading-relaxed shadow-inner"
                />
              </div>

              {/* 오른쪽: 실시간 치환 미리보기 */}
              {showPreview && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700 px-1">
                    <span className="flex items-center gap-1 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      실제 발송 문구 미리보기
                    </span>
                    <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-md">
                      <button
                        type="button"
                        onClick={() => setPreviewTab("unpaid")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                          previewTab === "unpaid"
                            ? "bg-white text-amber-900 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        입금 대기 예시
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab("paid")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                          previewTab === "paid"
                            ? "bg-white text-emerald-900 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        입금 완료 예시
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#E7F3E8] border-2 border-emerald-300 rounded-xl p-4 text-xs md:text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed shadow-xs min-h-[380px] max-h-[440px] overflow-y-auto">
                    {previewMessageText}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium px-1">
                    ※ 상호명, 실제 대표/추가 연락처, 계좌정보를 위에서 수정하면 실시간 반영됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. 실제 입금 계좌정보 */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-amber-600" />
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
                  placeholder="예: 농협"
                  className="w-full text-lg font-bold border-2 border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:border-emerald-600 focus:outline-hidden"
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
                  placeholder="예: 홍길동"
                  className="w-full text-lg font-bold border-2 border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:border-emerald-600 focus:outline-hidden"
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
                  placeholder="예: 우체국택배"
                  className="w-full text-lg font-bold border-2 border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:border-emerald-600 focus:outline-hidden"
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
                className="w-full text-lg font-bold border-2 border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* 4. 판매 상품 단가 설정 */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                <Tag className="w-6 h-6 text-emerald-700" />
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

          {/* 최종 저장 버튼 */}
          <button
            type="submit"
            disabled={saving}
            className="w-full btn-large bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white text-xl font-black py-4 rounded-xl cursor-pointer flex items-center justify-center gap-2.5 shadow-lg transition-all"
          >
            <Save className="w-6 h-6 text-emerald-200" />
            <span>{saving ? "설정 저장 중..." : "전체 설정 저장하기"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
