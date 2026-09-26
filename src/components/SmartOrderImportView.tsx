"use client";

import React, { useState, useRef } from "react";
import {
  Camera,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  Sparkles,
  UserCheck,
  UserPlus,
  History,
  Info,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { recognizeTextFromImage, OcrProgress } from "@/lib/ocrClient";
import {
  analyzeOrderImport,
  confirmImportedOrder,
  AnalyzedImportResult,
} from "@/lib/orderImportService";

interface SmartOrderImportViewProps {
  onOrderCreated: () => void;
  onNavigateTab: (tab: string) => void;
}

export function SmartOrderImportView({
  onOrderCreated,
  onNavigateTab,
}: SmartOrderImportViewProps) {
  // 모드: 'input' | 'analyzing' | 'review' | 'success'
  const [step, setStep] = useState<"input" | "analyzing" | "review" | "success">("input");
  const [textInput, setTextInput] = useState("");
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  // 분석 진행 상태
  const [progressState, setProgressState] = useState<OcrProgress>({
    status: "idle",
    progress: 0,
    message: "",
  });

  // 분석 결과 데이터
  const [analysisResult, setAnalysisResult] = useState<AnalyzedImportResult | null>(null);

  // 사용자 편집 폼 상태
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formAddressDetail, setFormAddressDetail] = useState("");
  const [formShippingDate, setFormShippingDate] = useState("");
  const [qty10, setQty10] = useState(0);
  const [qty20, setQty20] = useState(1);
  const [formMemo, setFormMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrderNo, setCreatedOrderNo] = useState("");

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // 모바일 뒤로가기 시 검토(review) 화면에서 입력(input) 화면으로 자연스럽게 복귀
  React.useEffect(() => {
    if (step === "review") {
      window.history.pushState({ tab: "smart-import", subStep: "review" }, "", "#smart-import-review");
    }

    const handleSubPop = (e: PopStateEvent) => {
      if (e.state?.subStep !== "review" && (step === "review" || step === "analyzing")) {
        setStep("input");
      }
    };

    window.addEventListener("popstate", handleSubPop);
    return () => window.removeEventListener("popstate", handleSubPop);
  }, [step]);

  // 1. 텍스트 직접 분석 실행
  const handleAnalyzeText = async (textToAnalyze?: string) => {
    const raw = textToAnalyze !== undefined ? textToAnalyze : textInput;
    if (!raw.trim()) {
      alert("분석할 문자 내용을 입력하거나 붙여넣어 주세요.");
      return;
    }

    setStep("analyzing");
    setProgressState({
      status: "parsing",
      progress: 30,
      message: "문자 텍스트 주문 정보 추출 중...",
    });

    try {
      await new Promise((r) => setTimeout(r, 400));
      setProgressState({
        status: "matching",
        progress: 70,
        message: "고객 장부 매칭 및 중복 검사 중...",
      });

      const result = await analyzeOrderImport("TEXT_PASTE", raw);
      populateFormFromAnalysis(result);
      setAnalysisResult(result);
      setStep("review");
    } catch (err: any) {
      alert("주문 분석 중 오류가 발생했습니다: " + err.message);
      setStep("input");
    }
  };

  // 2. 이미지 파일 처리 (카메라 또는 갤러리)
  const handleImageFile = async (file: File, sourceType: "CAMERA" | "IMAGE_UPLOAD") => {
    const previewUrl = URL.createObjectURL(file);
    setSelectedImagePreview(previewUrl);
    setStep("analyzing");

    try {
      // OCR 실행
      const ocrResult = await recognizeTextFromImage(file, (p) => {
        setProgressState(p);
      });

      if (!ocrResult.text.trim()) {
        throw new Error("이미지에서 문자를 찾을 수 없습니다. 선명한 캡처를 선택하거나 문자를 복사해 붙여넣어 주세요.");
      }

      setProgressState({
        status: "matching",
        progress: 85,
        message: "주문 정보 파싱 및 고객/중복 검사 중...",
      });

      const result = await analyzeOrderImport(sourceType, ocrResult.text, previewUrl);
      populateFormFromAnalysis(result);
      setAnalysisResult(result);
      setStep("review");
    } catch (err: any) {
      alert(err.message || "이미지 분석에 실패했습니다.");
      setStep("input");
    }
  };

  // 3. 분석 결과를 편집 폼으로 초기화
  const populateFormFromAnalysis = (res: AnalyzedImportResult) => {
    const p = res.parsed;
    const cm = res.customer_match;

    // 고객명: 매칭된 고객이 있으면 기존 고객명 우선, 없으면 파싱된 이름
    setFormName(cm?.name || p.customer_name || "");
    setFormPhone(cm?.phone || p.customer_phone || "");

    // 주소: 파싱된 주소 우선, 없으면 기존 고객 주소
    setFormAddress(p.shipping_address || cm?.address || "");
    setFormAddressDetail(cm?.address_detail || "");

    // 출고일: 기본 내일 또는 파싱된 일자
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    setFormShippingDate(p.shipping_date || tomorrowStr);

    // 수량 매핑
    let q10 = 0;
    let q20 = 0;
    for (const item of p.items) {
      if (item.weight_kg === 10) q10 += item.quantity;
      if (item.weight_kg === 20) q20 += item.quantity;
    }
    if (q10 === 0 && q20 === 0) q20 = 1;
    setQty10(q10);
    setQty20(q20);

    setFormMemo(p.raw_text);
  };

  // 4. "작년처럼" 또는 과거 주문 내역 적용
  const handleApplyPastOrder = () => {
    if (!analysisResult?.customer_match?.last_order) return;
    const lo = analysisResult.customer_match.last_order;
    if (lo.shipping_address) {
      setFormAddress(lo.shipping_address);
    }
    alert("과거 주문 배송지 및 정보가 입력창에 적용되었습니다.");
  };

  // 5. 최종 주문 등록 제출
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysisResult) return;

    if (!formName.trim()) {
      alert("고객명을 입력해 주세요.");
      return;
    }
    if (!formPhone.trim()) {
      alert("전화번호를 입력해 주세요.");
      return;
    }
    if (!formShippingDate) {
      alert("출고일을 선택해 주세요.");
      return;
    }
    if (qty10 <= 0 && qty20 <= 0) {
      alert("최소 1개 이상의 수량을 입력해 주세요.");
      return;
    }

    const items = [];
    if (qty10 > 0) items.push({ product_name: "절임배추 10kg", weight_kg: 10, quantity: qty10 });
    if (qty20 > 0) items.push({ product_name: "절임배추 20kg", weight_kg: 20, quantity: qty20 });

    setIsSubmitting(true);
    try {
      const created = await confirmImportedOrder({
        import_id: analysisResult.import_id,
        customer_name: formName.trim(),
        customer_phone: formPhone.trim(),
        shipping_address: formAddress.trim(),
        shipping_address_detail: formAddressDetail.trim(),
        shipping_date: formShippingDate,
        items,
        memo: formMemo,
      });

      setCreatedOrderNo(created.order_no);
      setStep("success");
      onOrderCreated();
    } catch (err: any) {
      alert("주문 등록에 실패했습니다: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 테스트용 예시 문자 입력
  const handleLoadSample = (type: 1 | 2 | 3) => {
    if (type === 1) {
      setTextInput("사장님 안녕하세요. 11월 15일 절임배추 10키로 2박스 보내주세요.\n홍길동 010-1234-5678\n전주시 완산구 효자동 123-4번지");
    } else if (type === 2) {
      setTextInput("절임배추 20키로 한박스 11/20일 출고 부탁합니다. 이순신 010-9876-5432 서울시 강남구 테헤란로 152 101호\n입금완료했습니다.");
    } else {
      setTextInput("사장님 작년처럼 20kg 2박스 부탁드려요.\n홍길동 010-1234-5678 주소는 그대로입니다");
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      {/* 1단계: 입력 화면 */}
      {step === "input" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-emerald-700" />
              <h1 className="text-2xl md:text-3xl font-black text-slate-900">
                문자 주문 스마트 가져오기
              </h1>
            </div>
            <p className="text-slate-700 text-base md:text-lg">
              문자 캡처 사진이나 복사한 문자 내용을 넣으면, <strong>고객명·전화번호·수량·출고일</strong>을 자동으로 분석하여 등록을 도와줍니다.
            </p>

            {/* 입력 방법 선택 카드 3종 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {/* 카메라 촬영 */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-4 p-5 rounded-2xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-all text-left cursor-pointer group shadow-xs"
              >
                <div className="w-14 h-14 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-800">
                    카메라로 사진 촬영
                  </h3>
                  <p className="text-sm text-slate-700 mt-0.5">
                    종이 메모나 다른 폰의 문자를 즉시 촬영
                  </p>
                </div>
              </button>

              {/* 앨범/사진 캡처 선택 */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center gap-4 p-5 rounded-2xl border-2 border-blue-600 bg-blue-50 hover:bg-blue-100 transition-all text-left cursor-pointer group shadow-xs"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-800">
                    문자 캡처 사진 선택
                  </h3>
                  <p className="text-sm text-slate-700 mt-0.5">
                    스마트폰 앨범에 저장된 캡처 이미지 선택
                  </p>
                </div>
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
          </div>

          {/* 텍스트 직접 복사/붙여넣기 카드 */}
          <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-700" />
                <h2 className="text-xl font-bold text-slate-900">
                  문자 텍스트 직접 붙여넣기
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSample(1)}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold cursor-pointer"
                >
                  예시 1 (신규)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample(3)}
                  className="text-xs px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md font-semibold cursor-pointer"
                >
                  예시 2 (작년처럼)
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="받으신 문자 내용을 여기에 길게 눌러 [붙여넣기] 하세요...&#10;예: 사장님 11월 15일 10키로 2박스 보내주세요. 홍길동 010-1234-5678 전주시 완산구..."
              className="w-full p-4 border-2 border-slate-300 rounded-xl text-base md:text-lg text-slate-900 focus:border-emerald-600 focus:ring-0 focus:outline-hidden"
            />

            <button
              type="button"
              onClick={() => handleAnalyzeText()}
              className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xl font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-6 h-6" />
              <span>문자 내용 분석하기</span>
            </button>
          </div>
        </div>
      )}

      {/* 2단계: 분석 진행 화면 */}
      {step === "analyzing" && (
        <div className="bg-white rounded-2xl border-2 border-slate-300 p-8 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center animate-spin">
            <RefreshCw className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">
              스마트 분석 파이프라인 가동 중
            </h2>
            <p className="text-slate-600 text-base mt-2">
              {progressState.message || "문자 내용과 고객 정보를 분석하고 있습니다..."}
            </p>
          </div>

          {/* 진행 게이지 */}
          <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden max-w-md mx-auto">
            <div
              className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressState.progress || 50}%` }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs md:text-sm font-semibold text-slate-600 max-w-lg mx-auto pt-2">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">① 이미지 전처리 ✓</div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">② 텍스트 추출 ✓</div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">③ 주문정보 분석 ...</div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">④ 고객·중복 검사 ...</div>
          </div>
        </div>
      )}

      {/* 3단계: 사용자 검토 및 최종 등록 폼 */}
      {step === "review" && analysisResult && (
        <form onSubmit={handleSubmitOrder} className="space-y-6">
          {/* 상단 알림 배너들 */}
          <div className="space-y-3">
            {/* 1. 중복 검사 결과 배너 */}
            {analysisResult.duplicate_check.decision === "DUPLICATE" ? (
              <div className="p-4 rounded-xl border-2 border-red-500 bg-red-50 text-red-950 flex items-start gap-3 shadow-xs">
                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-red-700">중복 주문 주의!</span>
                    <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">
                      중복 점수 {analysisResult.duplicate_check.score}점
                    </span>
                  </div>
                  <p className="text-sm mt-1">{analysisResult.duplicate_check.reason}</p>
                  {analysisResult.duplicate_check.matched_order && (
                    <div className="mt-2 text-xs bg-white/80 p-2 rounded-lg border border-red-200 text-slate-800">
                      <strong>기존 주문:</strong> 주문번호 #{analysisResult.duplicate_check.matched_order.order_no} | 출고일: {analysisResult.duplicate_check.matched_order.shipping_date} | {analysisResult.duplicate_check.matched_order.items_summary}
                    </div>
                  )}
                </div>
              </div>
            ) : analysisResult.duplicate_check.decision === "POSSIBLE_DUPLICATE" ? (
              <div className="p-4 rounded-xl border-2 border-amber-500 bg-amber-50 text-amber-950 flex items-start gap-3 shadow-xs">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-base text-amber-800">주문 확인 필요</span>
                  <p className="text-sm mt-0.5">{analysisResult.duplicate_check.reason}</p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border-2 border-emerald-400 bg-emerald-50 text-emerald-950 flex items-center gap-2 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-sm md:text-base font-bold">
                  기존 동일 주문 없음 (신규 정상 주문)
                </span>
              </div>
            )}

            {/* 2. 고객 매칭 결과 배너 */}
            {analysisResult.customer_match ? (
              <div className="p-4 rounded-xl border-2 border-blue-400 bg-blue-50 text-blue-950 flex items-start justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <UserCheck className="w-6 h-6 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base md:text-lg text-blue-900">
                        기존 등록 고객 발견: {analysisResult.customer_match.name}
                      </span>
                      <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                        단골 고객
                      </span>
                    </div>
                    {analysisResult.customer_match.last_order && (
                      <p className="text-xs md:text-sm text-slate-700 mt-1">
                        최근 주문 ({analysisResult.customer_match.last_order.order_date}): {analysisResult.customer_match.last_order.items_summary}
                      </p>
                    )}
                  </div>
                </div>

                {analysisResult.customer_match.last_order && (
                  <button
                    type="button"
                    onClick={handleApplyPastOrder}
                    className="shrink-0 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>과거 배송지 적용</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border-2 border-slate-300 bg-slate-50 text-slate-800 flex items-center gap-2 shadow-xs">
                <UserPlus className="w-5 h-5 text-slate-600 shrink-0" />
                <span className="text-sm md:text-base font-semibold">
                  신규 고객입니다. (주문 등록 시 고객 장부에 자동 등록됩니다)
                </span>
              </div>
            )}

            {/* 3. "작년처럼" 특별 알림 배너 */}
            {analysisResult.parsed.is_like_last_year && (
              <div className="p-4 rounded-xl border-2 border-emerald-600 bg-emerald-100 text-emerald-950 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-700" />
                  <span className="font-black text-sm md:text-base">
                    고객이 &quot;작년처럼&quot; 주문했습니다. 과거 주문을 참고하여 확인해 주세요.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 주문 정보 입력/수정 메인 카드 */}
          <div className="bg-white rounded-2xl border-2 border-slate-300 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  주문 정보 검토 및 확인
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  AI가 자동 추출한 내용입니다. 필요 시 내용을 수정하신 후 등록하세요.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep("input")}
                className="text-xs md:text-sm font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                다시 가져오기
              </button>
            </div>

            {/* 고객명 & 연락처 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-bold text-slate-900 mb-1.5">
                  고객명 (받는 분) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-3.5 border-2 border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-900 mb-1.5">
                  전화번호 *
                </label>
                <input
                  type="tel"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full p-3.5 border-2 border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 배송지 주소 */}
            <div>
              <label className="block text-base font-bold text-slate-900 mb-1.5">
                배송 주소 *
              </label>
              <input
                type="text"
                required
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="도로명 주소 또는 지번 주소"
                className="w-full p-3.5 border-2 border-slate-300 rounded-xl text-base md:text-lg text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
              <input
                type="text"
                value={formAddressDetail}
                onChange={(e) => setFormAddressDetail(e.target.value)}
                placeholder="동/호수, 상세주소 (선택)"
                className="w-full mt-2 p-3 border-2 border-slate-200 rounded-xl text-sm md:text-base text-slate-800 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            {/* 출고일 선택 */}
            <div>
              <label className="block text-base font-bold text-slate-900 mb-1.5">
                출고 희망일 (택배 발송일) *
              </label>
              <input
                type="date"
                required
                value={formShippingDate}
                onChange={(e) => setFormShippingDate(e.target.value)}
                className="w-full p-3.5 border-2 border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            {/* 절임배추 상품 수량 (+ / - 버튼) */}
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                주문 상품 수량 설정
              </h3>

              {/* 10kg */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-200 rounded-xl">
                <div>
                  <span className="text-lg font-black text-slate-900">절임배추 10kg</span>
                  <span className="text-sm text-slate-600 block mt-0.5">
                    {formatPrice(38000)}원
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQty10(Math.max(0, qty10 - 1))}
                    className="w-12 h-12 bg-white border-2 border-slate-300 rounded-xl flex items-center justify-center font-black text-xl hover:bg-slate-100 cursor-pointer active:scale-95"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="w-12 text-center text-2xl font-black text-slate-900">
                    {qty10}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty10(qty10 + 1)}
                    className="w-12 h-12 bg-white border-2 border-slate-300 rounded-xl flex items-center justify-center font-black text-xl hover:bg-slate-100 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 20kg */}
              <div className="flex items-center justify-between p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
                <div>
                  <span className="text-lg font-black text-emerald-950">절임배추 20kg</span>
                  <span className="text-sm text-emerald-800 block mt-0.5">
                    {formatPrice(68000)}원
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQty20(Math.max(0, qty20 - 1))}
                    className="w-12 h-12 bg-white border-2 border-emerald-300 rounded-xl flex items-center justify-center font-black text-xl hover:bg-emerald-100 cursor-pointer active:scale-95"
                  >
                    <Minus className="w-5 h-5 text-emerald-900" />
                  </button>
                  <span className="w-12 text-center text-2xl font-black text-emerald-950">
                    {qty20}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty20(qty20 + 1)}
                    className="w-12 h-12 bg-white border-2 border-emerald-300 rounded-xl flex items-center justify-center font-black text-xl hover:bg-emerald-100 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-5 h-5 text-emerald-900" />
                  </button>
                </div>
              </div>
            </div>

            {/* 원본 문자 메모 */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                주문 원본 문자 메모 (자동 보관)
              </label>
              <textarea
                rows={3}
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-700 focus:outline-hidden"
              />
            </div>

            {/* 최종 등록 버튼 */}
            <div className="pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-2xl font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <CheckCircle2 className="w-7 h-7" />
                <span>{isSubmitting ? "주문 등록 중..." : "확인 완료 및 주문 등록"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 4단계: 등록 완료 화면 */}
      {step === "success" && (
        <div className="bg-white rounded-2xl border-2 border-emerald-500 p-8 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="text-emerald-700 font-bold text-sm tracking-wide">
              주문 등록 완료
            </span>
            <h2 className="text-3xl font-black text-slate-900 mt-1">
              #{createdOrderNo} 주문이 정상 등록되었습니다!
            </h2>
            <p className="text-slate-600 text-base mt-2">
              출고 달력과 오늘 출고 현황에 즉시 반영되었습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setStep("input");
                setTextInput("");
                setSelectedImagePreview(null);
                setAnalysisResult(null);
              }}
              className="px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-lg cursor-pointer transition-colors"
            >
              다음 문자 주문 가져오기
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("calendar")}
              className="px-6 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-lg cursor-pointer transition-colors"
            >
              출고 달력 확인하기
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("dashboard")}
              className="px-6 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-xl font-bold text-lg cursor-pointer transition-colors"
            >
              오늘 현황 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
