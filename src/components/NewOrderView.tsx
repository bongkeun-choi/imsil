"use client";

import React, { useState, useEffect, useRef } from "react";
import { formatPrice, formatPhone } from "@/lib/utils";
import {
  Plus,
  Minus,
  UserCheck,
  Camera,
  Image as ImageIcon,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  History,
  FileText,
  RefreshCw,
  Smartphone,
  Share2,
} from "lucide-react";
import { format, addDays } from "date-fns";
import {
  fetchSettingsService,
  fetchCustomersService,
  createOrderService,
} from "@/lib/services";
import { recognizeTextFromImage, OcrProgress } from "@/lib/ocrClient";
import {
  analyzeOrderImport,
  confirmImportedOrder,
  AnalyzedImportResult,
} from "@/lib/orderImportService";
import { isContactPickerSupported, pickContactsFromDevice } from "@/lib/contactHelper";
import { OrderShareModal } from "@/components/OrderShareModal";
import { OrderCardData } from "@/lib/orderCardCanvas";
import { useBackButtonModal } from "@/lib/useBackButtonModal";
import { parseExtraPhones } from "@/lib/orderShareMessage";

interface NewOrderViewProps {
  settings: {
    shop_name?: string;
    shop_phone?: string;
    bank_name?: string;
    bank_account?: string;
    owner_name?: string;
    [key: string]: any;
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
  // 1. 주문서 기본 입력 폼 상태
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [memo, setMemo] = useState("");
  // 기본 택배 도착 희망일은 영업일 고려 2일 뒤
  const [shippingDate, setShippingDate] = useState(() => {
    return initialShippingDate || format(addDays(new Date(), 2), "yyyy-MM-dd");
  });
  const [paymentStatus, setPaymentStatus] = useState<"UNPAID" | "PAID">("UNPAID");
  // 행사·축제 납품 물량 구분 상태
  const [isEvent, setIsEvent] = useState(false);
  const [eventName, setEventName] = useState("임실 김치 축제");
  const [createdOrderShareData, setCreatedOrderShareData] = useState<OrderCardData | null>(null);
  const [showPostOrderPrompt, setShowPostOrderPrompt] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // 모바일 뒤로가기 버튼 시 주문 완료 안내 팝업 닫기
  useBackButtonModal(
    showPostOrderPrompt,
    () => setShowPostOrderPrompt(false),
    "new-order-prompt"
  );

  // 2. 상품 및 수량 상태 (현재 판매 상품: 절임배추 20kg 단일 규격)
  const [products, setProducts] = useState<any[]>([]);
  const [qty20kg, setQty20kg] = useState(1); // 기본 20kg 1박스

  // 3. 기존 고객 자동 검색 결과 (직접 번호 타이핑 시)
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);

  // 4. 스마트 문자/사진 자동 가져오기 상태
  const [smsText, setSmsText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<OcrProgress | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzedImportResult | null>(null);
  const [autoFilledNotice, setAutoFilledNotice] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialShippingDate) {
      setShippingDate(initialShippingDate);
    }
  }, [initialShippingDate]);

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

  // 전화번호 뒷자리 또는 입력 시 기존 고객 자동검색
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

  // 스마트폰 연락처에서 가져오기
  const handlePickContactForOrder = async () => {
    if (!isContactPickerSupported()) {
      alert(
        "현재 브라우저는 스마트폰 주소록 직접 호출을 지원하지 않습니다. [고객 장부] 메뉴에서 연락처 파일(.vcf)을 가져오시거나 직접 등록하실 수 있습니다."
      );
      return;
    }
    try {
      const picked = await pickContactsFromDevice(false);
      if (picked && picked.length > 0) {
        const c = picked[0];
        if (c.phone) setPhone(c.phone);
        if (c.name) setName(c.name);
        if (c.address && !address) setAddress(c.address);
      }
    } catch (e: any) {
      console.error("연락처 선택 실패:", e);
    }
  };

  // --- 스마트 분석 파이프라인 (문자 텍스트 또는 이미지 분석) ---
  const applyAnalysisToForm = (result: AnalyzedImportResult) => {
    const p = result.parsed;
    const cm = result.customer_match;

    if (cm?.name || p.customer_name) {
      setName(cm?.name || p.customer_name || "");
    }
    if (cm?.phone || p.customer_phone) {
      setPhone(cm?.phone || p.customer_phone || "");
    }
    if (p.shipping_address || cm?.address) {
      setAddress(p.shipping_address || cm?.address || "");
    }
    if (cm?.address_detail) {
      setAddressDetail(cm.address_detail);
    }
    if (p.shipping_date) {
      setShippingDate(p.shipping_date);
    }

    // 수량 매핑 (현재 판매 규격인 20kg로 우선 매핑)
    let totalBoxes = 0;
    for (const item of p.items) {
      totalBoxes += item.quantity;
    }
    if (totalBoxes === 0) totalBoxes = 1;
    setQty20kg(totalBoxes);

    if (p.raw_text) {
      setMemo(p.raw_text);
    }

    if (p.has_payment_mention) {
      setPaymentStatus("PAID");
    }

    setAnalysisResult(result);
    setAutoFilledNotice(true);

    // 주문서 영역으로 부드럽게 스크롤
    setTimeout(() => {
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const handleAnalyzeSms = async (rawTextToAnalyze?: string) => {
    const textToRun = rawTextToAnalyze !== undefined ? rawTextToAnalyze : smsText;
    if (!textToRun.trim()) {
      alert("분석할 문자 내용을 입력하거나 붙여넣어 주세요.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress({
      status: "parsing",
      progress: 40,
      message: "문자 내용 주문 정보 추출 및 정규화 중...",
    });

    try {
      await new Promise((r) => setTimeout(r, 300));
      const res = await analyzeOrderImport("TEXT_PASTE", textToRun);
      applyAnalysisToForm(res);
    } catch (err: any) {
      alert("문자 분석 중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const handleImageFile = async (file: File, sourceType: "CAMERA" | "IMAGE_UPLOAD") => {
    setIsAnalyzing(true);
    setAnalysisProgress({
      status: "preprocessing",
      progress: 20,
      message: "이미지 대비 및 해상도 최적화 중...",
    });

    try {
      const ocrRes = await recognizeTextFromImage(file, (p) => {
        setAnalysisProgress(p);
      });

      if (!ocrRes.text.trim()) {
        throw new Error("이미지에서 텍스트를 찾을 수 없습니다. 선명한 캡처를 선택하거나 문자를 복사해 붙여넣어 주세요.");
      }

      setSmsText(ocrRes.text);
      const res = await analyzeOrderImport(sourceType, ocrRes.text);
      applyAnalysisToForm(res);
    } catch (err: any) {
      alert(err.message || "이미지 분석에 실패했습니다.");
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  // 과거 주문 배송지 바로 적용
  const handleApplyPastOrderAddress = () => {
    if (analysisResult?.customer_match?.last_order?.shipping_address) {
      setAddress(analysisResult.customer_match.last_order.shipping_address);
      alert("과거 배송지가 적용되었습니다.");
    }
  };

  // 단가 계산 (현재 20kg 단일 규격 중심)
  const product20 = products.find((p) => Number(p.weight_kg) === 20) || {
    id: 2,
    name: "절임배추 20kg",
    price: 68000,
    weight_kg: 20,
  };

  const totalAmount = qty20kg * Number(product20.price);

  // --- 최종 주문 등록 제출 ---
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
    if (qty20kg < 1) {
      alert("절임배추 20kg 수량을 1박스 이상 선택해 주세요.");
      return;
    }

    const items = [
      {
        product_id: product20.id,
        product_name: product20.name,
        quantity: qty20kg,
        unit_price: product20.price,
        weight_kg: 20,
      },
    ];

    setIsSubmitting(true);
    try {
      let createdOrderNo = "";
      if (analysisResult?.import_id) {
        // 스마트 가져오기로 생성된 경우 원본 매핑 기록과 함께 확정
        const confRes = await confirmImportedOrder({
          import_id: analysisResult.import_id,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          shipping_address: address.trim(),
          shipping_address_detail: addressDetail.trim(),
          shipping_date: shippingDate,
          order_type: isEvent ? "EVENT" : "NORMAL",
          event_name: isEvent ? (eventName.trim() || "임실 김치 축제") : null,
          items,
          memo: memo.trim(),
          is_paid: paymentStatus === "PAID",
        });
        createdOrderNo = confRes.order_no;
      } else {
        // 직접 수기 입력된 경우
        const ordRes = await createOrderService({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          address_detail: addressDetail.trim(),
          shipping_date: shippingDate,
          order_type: isEvent ? "EVENT" : "NORMAL",
          event_name: isEvent ? (eventName.trim() || "임실 김치 축제") : null,
          items,
          payment_status: paymentStatus,
          memo: memo.trim(),
        });
        createdOrderNo = ordRes.orderNo;
      }

      const itemsSummary = items
        .map((it) => `${it.product_name} ${it.quantity}개`)
        .join(", ");

      const shareData: OrderCardData = {
        orderNo: createdOrderNo,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        shippingDate: shippingDate,
        shippingAddress: address.trim(),
        shippingAddressDetail: addressDetail.trim(),
        itemsSummary,
        totalAmount,
        paymentStatus,
        memo: memo.trim(),
        shopName: settings.shop_name || "임실참배추농원",
        shopPhone: settings.shop_phone || (settings as any).phone || "010-0000-0000",
        extraPhones: parseExtraPhones(settings.extra_phones),
        shareMessageTemplate: settings.share_message_template,
        bankName: settings.bank_name || "농협",
        bankAccount: settings.bank_account || "",
        ownerName: settings.owner_name || "",
      };

      setCreatedOrderShareData(shareData);
      setShowPostOrderPrompt(true);
    } catch (e: any) {
      alert("주문 처리 중 오류가 발생했습니다: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. 상단 스마트 문자·사진 자동 입력 카드 (통합 프레임) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border-2 border-emerald-500 shadow-sm p-5 md:p-7 space-y-4">
        <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900">
                문자·사진으로 3초 자동 입력
              </h2>
              <p className="text-xs md:text-sm text-slate-600">
                받으신 문자를 붙여넣거나 사진을 올리면, 아래 주문서에 자동으로 입력됩니다.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const sample1 = "전주시 완산구 고사동 303 - 3으로 배추 10키로 2박스 보내주세요 얼마인가요? 010-6615-776 최봉근입니";
                setSmsText(sample1);
                handleAnalyzeSms(sample1);
              }}
              className="text-xs px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md font-bold cursor-pointer border border-emerald-200"
            >
              예시 1 테스트
            </button>
            <button
              type="button"
              onClick={() => {
                const sample2 = "사장님 작년처럼 20kg 2박스 부탁드려요 홍길동 010-1234-5678 주소는 그대로입니다";
                setSmsText(sample2);
                handleAnalyzeSms(sample2);
              }}
              className="text-xs px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-md font-bold cursor-pointer border border-amber-200"
            >
              예시 2 (작년처럼)
            </button>
          </div>
        </div>

        {/* 사진 업로드 버튼 2종 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-sm md:text-base cursor-pointer transition-colors"
          >
            <Camera className="w-5 h-5 text-emerald-700" />
            <span>카메라 촬영</span>
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-sm md:text-base cursor-pointer transition-colors"
          >
            <ImageIcon className="w-5 h-5 text-blue-700" />
            <span>문자 캡처 사진</span>
          </button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file, "CAMERA");
            }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file, "IMAGE_UPLOAD");
            }}
          />
        </div>

        {/* 문자 텍스트 붙여넣기 박스 */}
        <div className="space-y-2">
          <textarea
            rows={3}
            value={smsText}
            onChange={(e) => setSmsText(e.target.value)}
            placeholder="문자 내용을 여기에 길게 눌러 [붙여넣기] 하세요...&#10;예: 전주시 완산구 고사동 303-3 배추 10키로 2박스 010-6615-776 최봉근"
            className="w-full p-3.5 border-2 border-slate-300 rounded-xl text-base text-slate-900 focus:border-emerald-600 focus:outline-hidden bg-slate-50"
          />

          <button
            type="button"
            onClick={() => handleAnalyzeSms()}
            disabled={isAnalyzing}
            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-lg font-black flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>문자 분석 중 ({analysisProgress?.message || "잠시만 기다려주세요..."})</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-emerald-300" />
                <span>문자 분석하여 아래 양식에 자동 채우기</span>
              </>
            )}
          </button>
        </div>

        {/* 분석 완료 시 알림 & 안내 배너 */}
        {autoFilledNotice && analysisResult && (
          <div className="space-y-2.5 pt-2">
            {/* 1. 자동 채움 완료 성공 알림 */}
            <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-emerald-950 flex items-center gap-2 text-sm md:text-base font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>문자 내용을 분석하여 아래 주문서에 자동 입력했습니다. 확인 후 등록하세요!</span>
            </div>

            {/* 2. 중복 검사 결과 알림 */}
            {analysisResult.duplicate_check.decision === "DUPLICATE" ? (
              <div className="p-3.5 rounded-xl border-2 border-red-500 bg-red-50 text-red-950 flex items-start gap-2.5 text-sm">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black text-red-700">중복 주문 주의!</span>
                  <p className="mt-0.5">{analysisResult.duplicate_check.reason}</p>
                </div>
              </div>
            ) : analysisResult.duplicate_check.decision === "POSSIBLE_DUPLICATE" ? (
              <div className="p-3 rounded-xl border-2 border-amber-500 bg-amber-50 text-amber-950 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>확인 필요: {analysisResult.duplicate_check.reason}</span>
              </div>
            ) : null}

            {/* 3. 기존 단골 고객 발견 알림 & 과거 배송지 적용 버튼 */}
            {analysisResult.customer_match && (
              <div className="p-3.5 rounded-xl border-2 border-blue-400 bg-blue-50 text-blue-950 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-700 shrink-0" />
                  <span>
                    기존 단골 고객: <strong>{analysisResult.customer_match.name}</strong> ({analysisResult.customer_match.phone})
                  </span>
                </div>
                {analysisResult.customer_match.last_order && (
                  <button
                    type="button"
                    onClick={handleApplyPastOrderAddress}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>과거 배송지 적용</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. 메인 주문 등록 입력 폼 (수기 입력 또는 자동 채움 검토) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div ref={formTopRef} className="bg-white rounded-2xl border-2 border-slate-300 p-6 md:p-8 shadow-sm">
        <div className="border-b border-slate-200 pb-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              주문 등록
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              고객 정보와 수량을 확인하시고 아래 [주문 등록 완료] 버튼을 눌러주세요.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 주문 구분: 일반 고객 택배 주문 vs 행사·축제 납품 */}
          <div className="bg-slate-100 p-4 rounded-2xl border-2 border-slate-300 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>주문 구분</span>
                <span className="text-xs font-bold text-slate-500">
                  (행사·축제 물량은 스케줄에서 별도로 분리 집계됩니다)
                </span>
              </label>
              {isEvent && (
                <span className="text-xs font-black text-purple-800 bg-purple-100 border border-purple-300 px-2.5 py-0.5 rounded-full whitespace-nowrap animate-pulse">
                  🎪 행사 납품 모드
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsEvent(false)}
                className={`py-3 px-3 rounded-xl font-black text-sm md:text-base flex items-center justify-center gap-2 cursor-pointer transition-all border-2 ${
                  !isEvent
                    ? "bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-300"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>📦 일반 고객 택배</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEvent(true)}
                className={`py-3 px-3 rounded-xl font-black text-sm md:text-base flex items-center justify-center gap-2 cursor-pointer transition-all border-2 ${
                  isEvent
                    ? "bg-purple-700 text-white border-purple-800 shadow-md ring-2 ring-purple-300"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>🎪 행사·축제 납품</span>
              </button>
            </div>

            {isEvent && (
              <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-black text-purple-950 flex items-center gap-1.5">
                    <span>행사 / 축제 이름 <span className="text-red-600">*</span></span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEventName("임실 김치 축제")}
                    className="text-xs font-black bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-1 rounded-md cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                  >
                    + 임실 김치 축제 자동입력
                  </button>
                </div>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="예: 임실 김치 축제"
                  className="w-full text-base font-black border-2 border-purple-400 rounded-lg px-3 py-2 bg-white text-purple-950 focus:border-purple-600 focus:outline-hidden shadow-inner"
                  required={isEvent}
                />
                <p className="text-xs text-purple-800 font-medium">
                  💡 이 주문은 달력 스케줄러, 출고 현황, 발송 명단에서 보라색 <strong>[임실 김치 축제]</strong> 뱃지로 일반 택배와 완전히 별도 집계 및 구분 표시됩니다.
                </p>
              </div>
            )}
          </div>

          {/* 고객명 & 연락처 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-lg font-bold text-slate-900">
                  전화번호 <span className="text-red-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={handlePickContactForOrder}
                  className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-300 cursor-pointer active:scale-95 transition-all"
                  title="스마트폰 주소록에서 연락처 선택"
                >
                  <Smartphone className="w-4 h-4 text-emerald-700" />
                  <span>핸드폰 연락처 선택</span>
                </button>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="예: 010-1234-5678"
                className="w-full text-xl font-bold border-2 border-slate-300 rounded-xl px-4 py-3.5 focus:border-emerald-600 focus:outline-hidden bg-slate-50"
                required
              />

              {/* 기존 고객 자동완성 드롭다운 */}
              {customerSuggestions.length > 0 && (
                <div className="mt-2 bg-emerald-50 border-2 border-emerald-400 rounded-xl p-3 space-y-2">
                  <div className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    <span>기존 고객 터치 시 자동 입력:</span>
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
                          <span className="text-lg font-bold text-slate-900 mr-2">
                            {cust.name}
                          </span>
                          <span className="text-sm text-slate-600">{cust.phone}</span>
                          <div className="text-xs text-slate-500 truncate">
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

            <div>
              <label className="block text-lg font-bold text-slate-900 mb-1.5">
                고객 이름 (받는 분) <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full text-xl font-bold border-2 border-slate-300 rounded-xl px-4 py-3.5 focus:border-emerald-600 focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* 배송지 주소 */}
          <div>
            <label className="block text-lg font-bold text-slate-900 mb-1.5">
              배송 주소 <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="시·군·구·도로명 또는 지번 주소"
              className="w-full text-lg font-bold border-2 border-slate-300 rounded-xl px-4 py-3.5 mb-2 focus:border-emerald-600 focus:outline-hidden"
              required
            />
            <input
              type="text"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              placeholder="동/호수, 마을이름 등 상세 주소 (선택)"
              className="w-full text-base border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {/* 상품 단위 및 수량 선택 (절임배추 20kg 단일 규격) */}
          <div className="border-t border-b border-slate-200 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">
                주문 상품 및 수량
              </h3>
              <span className="text-xs md:text-sm font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                현재 판매 품목: 절임배추 20kg
              </span>
            </div>

            {/* 20kg 메인 카드 */}
            <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-black text-emerald-950 flex items-center gap-2">
                    <span>{product20.name}</span>
                    <span className="text-sm font-bold bg-emerald-700 text-white px-2 py-0.5 rounded-md">
                      기본 1박스
                    </span>
                  </div>
                  <div className="text-base font-bold text-emerald-800 mt-1">
                    단가: <span className="stat-number">{formatPrice(product20.price)}</span>원 / 1박스
                  </div>
                </div>

                {/* 대형 수량 조절 버튼 */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQty20kg((prev) => Math.max(1, prev - 1))}
                    className="w-14 h-14 bg-white border-2 border-emerald-400 rounded-2xl text-2xl font-black flex items-center justify-center hover:bg-emerald-100 active:scale-95 cursor-pointer shadow-xs"
                  >
                    <Minus className="w-7 h-7 text-emerald-900" />
                  </button>
                  <span className="text-4xl font-black w-14 text-center stat-number text-emerald-950">
                    {qty20kg}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty20kg((prev) => prev + 1)}
                    className="w-14 h-14 bg-emerald-700 text-white rounded-2xl text-2xl font-black flex items-center justify-center hover:bg-emerald-800 active:scale-95 cursor-pointer shadow-md"
                  >
                    <Plus className="w-7 h-7" />
                  </button>
                </div>
              </div>

              {/* 빠른 박스 수량 선택 버튼 모음 */}
              <div className="pt-2 border-t border-emerald-200/80 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-emerald-900 mr-1">빠른 선택:</span>
                {[1, 2, 3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQty20kg(num)}
                    className={`px-3.5 py-1.5 rounded-xl font-extrabold text-sm border cursor-pointer transition-all ${
                      qty20kg === num
                        ? "bg-emerald-800 text-white border-emerald-800 shadow-xs"
                        : "bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                    }`}
                  >
                    {num}박스 ({num * 20}kg)
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 택배 도착 희망일 (배추 받는 날) 선택 */}
          <div className="bg-emerald-50/60 border-2 border-emerald-400 rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label className="text-xl font-black text-slate-900 flex items-center gap-1.5">
                <span>택배 도착 희망일 (배추 받는 날)</span>
                <span className="text-red-600">*</span>
              </label>
              <span className="text-xs md:text-sm font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md">
                김장 전날 수령 기준
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              고객이 김치 담그기 전날 수령할 날짜를 선택합니다.
            </p>
            <input
              type="date"
              value={shippingDate}
              onChange={(e) => setShippingDate(e.target.value)}
              className="w-full text-2xl font-black border-2 border-emerald-500 rounded-xl px-4 py-3.5 focus:border-emerald-700 focus:outline-hidden bg-white"
              required
            />
          </div>

          {/* 입금 상태 선택 */}
          <div>
            <label className="block text-lg font-bold text-slate-900 mb-1.5">
              입금 여부
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentStatus("UNPAID")}
                className={`py-3.5 rounded-xl border-2 cursor-pointer transition-all text-lg ${
                  paymentStatus === "UNPAID"
                    ? "bg-red-50 border-red-500 text-red-900 font-black shadow-xs"
                    : "bg-white border-slate-300 text-slate-700 font-bold"
                }`}
              >
                미입금 (입금 대기)
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus("PAID")}
                className={`py-3.5 rounded-xl border-2 cursor-pointer transition-all text-lg ${
                  paymentStatus === "PAID"
                    ? "bg-blue-50 border-blue-600 text-blue-900 font-black shadow-xs"
                    : "bg-white border-slate-300 text-slate-700 font-bold"
                }`}
              >
                입금 완료 (확인됨)
              </button>
            </div>
          </div>

          {/* 배송 및 원본 메모 */}
          <div>
            <label className="block text-base font-bold text-slate-800 mb-1.5">
              배송 메모 및 원본 내용 (선택)
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 문 앞에 놓아주세요 / 오후 배송 요망"
              className="w-full text-base border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {/* 총 금액 요약 */}
          <div className="bg-slate-900 text-white rounded-2xl p-6">
            <div className="flex justify-between items-center text-xl font-bold mb-2">
              <span>총 주문 금액:</span>
              <span className="text-3xl md:text-4xl font-black text-amber-400 stat-number">
                {formatPrice(totalAmount)}원
              </span>
            </div>
            <div className="text-xs md:text-sm text-slate-300 border-t border-slate-800 pt-3 mt-3">
              입금 안내 계좌: {settings.bank_name || "농협"} {settings.bank_account || "351-0000-0000-00"} ({settings.owner_name || "대표자"})
            </div>
          </div>

          {/* 최종 주문 등록 완료 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4.5 bg-emerald-700 hover:bg-emerald-800 text-white text-2xl font-black rounded-xl shadow-md cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-7 h-7" />
            <span>{isSubmitting ? "주문 등록 중..." : "확인 완료 및 주문 등록"}</span>
          </button>
        </form>
      </div>

      {/* 1. 주문 등록 완료 후 문자/카톡 발송 확인 팝업 */}
      {showPostOrderPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl border-4 border-emerald-600 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-900">
                주문 등록이 완료되었습니다!
              </h3>
              <p className="text-base text-slate-600 mt-2 font-semibold leading-relaxed">
                고객님(<strong>{createdOrderShareData?.customerName}</strong>)에게 주문 확인서와 입금 계좌를 <strong>문자나 카카오톡으로 발송</strong>하시겠습니까?
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPostOrderPrompt(false);
                  setShowShareModal(true);
                }}
                className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-lg font-black flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition-all"
              >
                <Share2 className="w-5 h-5" />
                <span>예, 문자·카톡 발송하기</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPostOrderPrompt(false);
                  onOrderSaved();
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-base font-bold cursor-pointer transition-colors"
              >
                나중에 보내기 (완료)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 문자 / 카카오톡 전송 모달 */}
      {showShareModal && createdOrderShareData && (
        <OrderShareModal
          orderData={createdOrderShareData}
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            onOrderSaved();
          }}
          isNewOrder={true}
        />
      )}
    </div>
  );
}
