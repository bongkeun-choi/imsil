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
} from "lucide-react";
import {
  fetchSettingsService,
  saveSettingsService,
  fetchAllProductsService,
  createProductService,
  updateProductService,
  deleteProductService,
  ProductItem,
} from "@/lib/services";
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

export function SettingsView({
  onSettingsUpdated,
}: SettingsViewProps) {
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  // 추가 대표 연락처 목록 (단순 개수 확장)
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
  const [defaultProductId, setDefaultProductId] = useState<number | null>(null);

  // 전체 품목 목록 및 모달 상태
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdCode, setNewProdCode] = useState("");
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("절임배추류");
  const [newProdWeight, setNewProdWeight] = useState(20);
  const [newProdPrice, setNewProdPrice] = useState(50000);
  const [newProdUnit, setNewProdUnit] = useState("박스");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  const [previewTab, setPreviewTab] = useState<"unpaid" | "paid">("unpaid");
  const [showPreview, setShowPreview] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadAllProducts = async () => {
    try {
      const items = await fetchAllProductsService();
      setProductsList(items);
    } catch (e) {
      console.error("Failed to load products list:", e);
    }
  };

  useEffect(() => {
    fetchSettingsService()
      .then((data) => {
        if (data.settings) {
          setShopName(data.settings.shop_name || "장모님 절임배추");
          setShopPhone(data.settings.shop_phone || "010-7180-2496");
          setBankName(data.settings.bank_name || "농협");
          setBankAccount(data.settings.bank_account || "351-0000-0000-00");
          setOwnerName(data.settings.owner_name || "백양임");
          setDefaultCourier(data.settings.default_courier || "우체국택배");
          if (data.settings.default_product_id) {
            setDefaultProductId(Number(data.settings.default_product_id));
          }
          
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
              // 기본 상품이 아직 설정되지 않았으면 20kg 상품을 기본으로 지정
              if (!data.settings?.default_product_id) {
                setDefaultProductId(Number(p.id));
              }
            }
          }
        }
        loadAllProducts();
      })
      .catch((e) => {
        console.error("Failed to load settings:", e);
      })
      .finally(() => setLoading(false));
  }, []);

  // 대표 연락처 추가 (단순 전화번호 입력란 1줄 추가)
  const handleAddExtraPhone = () => {
    setExtraPhones((prev) => [
      ...prev,
      {
        id: "phone-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        phone: "",
      },
    ]);
  };

  // 대표 연락처 번호 수정
  const handleUpdateExtraPhone = (id: string, phoneValue: string) => {
    setExtraPhones((prev) =>
      prev.map((item) => (item.id === id ? { ...item, phone: phoneValue } : item))
    );
  };

  // 대표 연락처 삭제
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

  // 신규 품목 등록
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      alert("품목명을 입력해주세요.");
      return;
    }
    const code = newProdCode.trim() || `PRD-${Date.now().toString().slice(-4)}`;
    setIsAddingProduct(true);
    try {
      await createProductService({
        code,
        name: newProdName.trim(),
        category: newProdCategory.trim(),
        weight_kg: Number(newProdWeight) || 0,
        price: Number(newProdPrice) || 0,
        unit: newProdUnit.trim() || "박스",
      });
      alert(`품목 '${newProdName.trim()}'이(가) 등록되었습니다.`);
      setNewProdCode("");
      setNewProdName("");
      setNewProdCategory("절임배추류");
      setNewProdWeight(20);
      setNewProdPrice(50000);
      setNewProdUnit("박스");
      setShowAddProductModal(false);
      await loadAllProducts();
      onSettingsUpdated();
    } catch (err: any) {
      alert("품목 등록 실패: " + err.message);
    } finally {
      setIsAddingProduct(false);
    }
  };

  // 품목 활성/비활성 토글
  const handleToggleProductActive = async (p: ProductItem) => {
    try {
      const nextActive = p.active ? 0 : 1;
      await updateProductService({
        id: p.id,
        active: nextActive,
      });
      await loadAllProducts();
      onSettingsUpdated();
    } catch (err: any) {
      alert("품목 상태 변경 실패: " + err.message);
    }
  };

  // 품목 단가 수정
  const handleProductPriceChange = async (p: ProductItem, newPrice: number) => {
    try {
      await updateProductService({
        id: p.id,
        price: newPrice,
      });
      if (p.id === product20Id) setPrice20kg(newPrice);
      if (p.id === product10Id) setPrice10kg(newPrice);
      await loadAllProducts();
      onSettingsUpdated();
    } catch (err: any) {
      alert("단가 변경 실패: " + err.message);
    }
  };

  // 품목 삭제
  const handleDeleteProduct = async (p: ProductItem) => {
    if (p.id === product20Id) {
      alert("기본 절임배추 20kg 품목은 삭제할 수 없습니다.");
      return;
    }
    if (!confirm(`'${p.name}' 품목을 삭제하시겠습니까?\n(과거 주문 이력이 있는 경우 판매중지로 안전하게 변경됩니다)`)) {
      return;
    }
    try {
      const res = await deleteProductService(p.id);
      if (res.deactivated) {
        alert("이 품목은 과거 주문 이력이 있어 판매중지(비활성화) 처리되었습니다.");
      } else {
        alert("품목이 삭제되었습니다.");
      }
      await loadAllProducts();
      onSettingsUpdated();
    } catch (err: any) {
      alert("품목 삭제 실패: " + err.message);
    }
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
      // 빈 번호 필터링
      const validExtraPhones = extraPhones.filter(
        (p) => p.phone && p.phone.trim() !== ""
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
          default_product_id: defaultProductId ? String(defaultProductId) : "",
        },
        productsList.map((p) => ({ id: p.id, price: Number(p.price) || 0 }))
      );

      alert("농가 정보, 대표 품목 설정 및 발송 문구가 성공적으로 저장되었습니다.");
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
    shopName: shopName || "장모님 절임배추",
    shopPhone: shopPhone || "010-7180-2496",
    extraPhones: extraPhones.filter((p) => p.phone.trim() !== ""),
    bankName: bankName || "농협",
    bankAccount: bankAccount || "351-0000-0000-00",
    ownerName: ownerName || "백양임",
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

  const totalPhoneCount = 1 + extraPhones.length;

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
              농가 상호, 실제 대표 연락처(단순 개수 추가) 및 카톡·문자 발송 문구를 설정합니다.
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
          {/* 1. 상호명 및 실제 대표 연락처 관리 (단순 개수 확장) */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 md:p-6 space-y-5">
            <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Phone className="w-6 h-6 text-emerald-700" />
                  <span>농가 상호 및 대표 연락처</span>
                </h2>
                <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
                  대표 연락처를 필요하신 만큼 자유롭게 추가 등록할 수 있습니다.
                </p>
              </div>
              <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full whitespace-nowrap">
                총 {totalPhoneCount}개 연락처 등록됨
              </span>
            </div>

            {/* 농가 상호명 */}
            <div>
              <label className="block text-base font-bold text-slate-800 mb-1">
                농가 상호명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="예: 장모님 절임배추"
                className="w-full text-lg font-bold border-2 border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                required
              />
            </div>

            {/* 대표 연락처 목록 (단순 개수 확장) */}
            <div className="space-y-3 pt-2">
              <label className="block text-base font-bold text-emerald-950">
                대표 연락처 (전화번호) <span className="text-red-500">*</span>
              </label>

              {/* 1번 메인 대표 연락처 */}
              <div className="flex items-center gap-2 bg-white p-3 rounded-xl border-2 border-emerald-500 shadow-2xs">
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md shrink-0 whitespace-nowrap">
                  대표 연락처 1 (기본)
                </span>
                <input
                  type="text"
                  value={shopPhone}
                  onChange={(e) => setShopPhone(e.target.value)}
                  placeholder="예: 010-7180-2496"
                  className="flex-1 text-base md:text-lg font-bold border-0 bg-transparent px-2 py-1 text-emerald-950 focus:outline-hidden"
                  required
                />
              </div>

              {/* 추가된 대표 연락처 목록 (단순 2, 3, 4...) */}
              {extraPhones.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 bg-white p-3 rounded-xl border-2 border-slate-300 shadow-2xs animate-in fade-in duration-100"
                >
                  <span className="text-xs font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md shrink-0 whitespace-nowrap">
                    대표 연락처 {idx + 2}
                  </span>
                  <input
                    type="text"
                    value={item.phone}
                    onChange={(e) =>
                      handleUpdateExtraPhone(item.id, e.target.value)
                    }
                    placeholder={`예: 010-0000-0000`}
                    className="flex-1 text-base md:text-lg font-bold border-0 bg-transparent px-2 py-1 text-slate-900 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExtraPhone(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="연락처 삭제"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}

              {/* 대표 연락처 추가 버튼 */}
              <button
                type="button"
                onClick={handleAddExtraPhone}
                className="w-full py-3 bg-white hover:bg-emerald-50 text-emerald-800 hover:text-emerald-900 border-2 border-dashed border-emerald-400 hover:border-emerald-600 rounded-xl font-bold text-sm md:text-base flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>+ 대표 연락처 추가하기</span>
              </button>

              <p className="text-xs text-slate-500 font-medium px-1">
                ※ 대표 연락처를 추가하시면 문자·카톡의 문의전화 및 주문 카드에 함께 등록됩니다. (예: {shopPhone || "010-7180-2496"}{extraPhones[0]?.phone ? `, ${extraPhones[0].phone}` : ""})
              </p>
            </div>
          </div>

          {/* 2. 카톡 / 문자 발송 문구 설정 */}
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
              <p className="text-[11px] text-slate-500 font-medium">
                [안내] <strong>{`{대표전화}`}</strong>를 넣으면 등록된 대표 연락처들이 자동으로 연결되어 표시됩니다.
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
                    ※ 상호명, 대표 연락처 목록, 계좌정보를 위에서 수정하면 실시간 반영됩니다.
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
                  placeholder="예: 백양임"
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

          {/* 4. 품목(상품) 및 단가 관리 */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Tag className="w-6 h-6 text-emerald-700" />
                  <span>품목(상품) 및 단가 관리</span>
                </h2>
                <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
                  절임배추 외에도 김치 양념, 고춧가루 등 다양한 판매 품목을 코드로 체계적으로 관리할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(true)}
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-sm font-bold shadow-xs cursor-pointer transition-all active:scale-95 whitespace-nowrap shrink-0 ml-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ 새 품목 추가</span>
              </button>
            </div>

            {/* 주문서 기본 상품 지정 및 단가 설정 */}
            <div className="bg-emerald-50/90 p-4 md:p-5 rounded-2xl border-2 border-emerald-400 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="block text-base md:text-lg font-black text-emerald-950">
                  주문서 작성 시 기본 선택 상품 지정 <span className="text-red-600">*</span>
                </label>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                  신규 주문 등록 화면에 자동 기본 선택
                </span>
              </div>

              {/* 기본 상품 선택 드롭다운 */}
              <div className="space-y-1">
                <select
                  value={defaultProductId || ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setDefaultProductId(id);
                    const prod = productsList.find((p) => p.id === id);
                    if (prod && Number(prod.weight_kg) === 20) setPrice20kg(prod.price);
                    if (prod && Number(prod.weight_kg) === 10) setPrice10kg(prod.price);
                  }}
                  className="w-full text-base font-bold border-2 border-emerald-500 rounded-xl px-3.5 py-2.5 bg-white text-emerald-950 focus:border-emerald-700 focus:outline-hidden"
                >
                  {productsList.filter((p) => p.active).map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.category || "일반"}] {p.name} ({formatPrice(p.price)}원 / {p.weight_kg ? `${p.weight_kg}kg ` : ""}{p.unit || "박스"})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-emerald-800 font-medium">
                  {(() => {
                    const cur = productsList.find((p) => p.id === defaultProductId);
                    return cur
                      ? `현재 기본 상품: [${cur.name}] — 판매 단가: ${formatPrice(cur.price)}원 / 1${cur.unit || "박스"}`
                      : "기본 상품을 선택해주세요.";
                  })()}
                </p>
              </div>
            </div>

            {/* 전체 등록된 품목 목록 테이블 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-bold text-slate-700 px-1">
                <span>등록된 판매 품목 목록 ({productsList.length}개)</span>
                <span className="text-xs text-slate-400 font-normal">단가를 수정한 후 아래 [전체 설정 저장하기]를 눌러주세요.</span>
              </div>

              <div className="overflow-x-auto border-2 border-slate-300 rounded-xl bg-white shadow-xs">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-black">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap">품목 코드</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">분류</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">품목명</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">규격/단위</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">판매 단가(원)</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">판매 상태</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">기본상품</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {productsList.map((p) => {
                      const isDefault = p.id === defaultProductId;
                      const isMain20kg = p.id === product20Id;
                      return (
                        <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${p.active ? "" : "bg-slate-50/60 opacity-60"}`}>
                          <td className="py-2.5 px-3 font-mono font-black text-indigo-700 whitespace-nowrap">
                            <span className="bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                              #{p.code}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">
                              {p.category || "일반"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            <span>{p.name}</span>
                            {isDefault && (
                              <span className="ml-1.5 text-[11px] bg-emerald-800 text-white px-2 py-0.5 rounded font-black whitespace-nowrap">
                                [기본 상품]
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-bold whitespace-nowrap">
                            {p.weight_kg ? `${p.weight_kg}kg / ` : ""}{p.unit || "개"}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={p.price}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setProductsList((prev) =>
                                    prev.map((item) => (item.id === p.id ? { ...item, price: val } : item))
                                  );
                                  if (isMain20kg) setPrice20kg(val);
                                  if (p.id === product10Id) setPrice10kg(val);
                                }}
                                step="1000"
                                className="w-28 font-bold border border-slate-300 rounded-lg px-2 py-1 text-right focus:border-emerald-600 focus:outline-hidden"
                              />
                              <span className="text-xs text-slate-500 font-bold">원</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleProductActive(p)}
                              className={`px-2.5 py-1 rounded-md text-xs font-black cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                                p.active
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                              }`}
                            >
                              {p.active ? "판매중" : "판매중지"}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {isDefault ? (
                              <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">
                                현재 기본
                              </span>
                            ) : p.active ? (
                              <button
                                type="button"
                                onClick={() => setDefaultProductId(p.id)}
                                className="text-xs font-bold text-slate-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 border border-slate-300 px-2 py-1 rounded cursor-pointer whitespace-nowrap"
                                title="이 상품을 주문서 기본 선택 상품으로 지정"
                              >
                                기본 지정
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 whitespace-nowrap">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {!isMain20kg && !isDefault && (
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p)}
                                className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                                title="품목 삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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

        {/* 신규 품목 추가 모달 */}
        {showAddProductModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-4 border-emerald-600 flex flex-col max-h-[90vh]">
              <div className="bg-emerald-700 text-white p-4 md:p-5 rounded-t-[20px] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-6 h-6" />
                  <h3 className="text-xl md:text-2xl font-black">신규 판매 품목 등록</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="text-white hover:bg-emerald-800 p-1.5 rounded-full cursor-pointer transition-colors"
                >
                  <Trash2 className="hidden" />
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">
                    품목 코드 (영문/숫자) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProdCode}
                    onChange={(e) => setNewProdCode(e.target.value.toUpperCase())}
                    placeholder="예: CAB-20, SAU-05, PEP-01"
                    className="w-full font-mono text-base font-bold border-2 border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-emerald-600 focus:outline-hidden"
                    required
                  />
                  <span className="text-[11px] text-slate-400">품목을 식별하는 고유 코드입니다.</span>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">
                    품목명 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="예: 김치 양념 5kg, 고춧가루 1kg"
                    className="w-full text-base font-bold border-2 border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-emerald-600 focus:outline-hidden"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">
                      분류(카테고리)
                    </label>
                    <select
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full text-base font-bold border-2 border-slate-300 rounded-xl px-3 py-2.5 focus:border-emerald-600 focus:outline-hidden bg-white"
                    >
                      <option value="절임배추류">절임배추류</option>
                      <option value="김치양념류">김치양념류</option>
                      <option value="고춧가루류">고춧가루류</option>
                      <option value="김치완제품">김치완제품</option>
                      <option value="일반농산물">일반농산물</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">
                      규격 단위
                    </label>
                    <input
                      type="text"
                      value={newProdUnit}
                      onChange={(e) => setNewProdUnit(e.target.value)}
                      placeholder="예: 박스, 통, 봉, 포"
                      className="w-full text-base font-bold border-2 border-slate-300 rounded-xl px-3 py-2.5 focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">
                      무게 (kg)
                    </label>
                    <input
                      type="number"
                      value={newProdWeight}
                      onChange={(e) => setNewProdWeight(Number(e.target.value))}
                      step="0.5"
                      className="w-full text-base font-bold border-2 border-slate-300 rounded-xl px-3 py-2.5 focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">
                      판매 단가 (원) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(Number(e.target.value))}
                      step="1000"
                      className="w-full text-base font-bold border-2 border-slate-300 rounded-xl px-3 py-2.5 focus:border-emerald-600 focus:outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingProduct}
                    className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-5 h-5" />
                    <span>{isAddingProduct ? "등록 중..." : "품목 등록하기"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
