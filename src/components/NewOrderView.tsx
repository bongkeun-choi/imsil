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
  MapPin,
  Package,
  CalendarCheck,
  Info,
  Users,
  Trash2,
  Split,
} from "lucide-react";
import { format, addDays } from "date-fns";
import {
  fetchSettingsService,
  fetchCustomersService,
  fetchCustomerAddressesService,
  addCustomerAddressService,
  createOrderService,
  createMultiDestinationOrderService,
  MultiDestinationItem,
  CustomerAddress,
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
  preFillCustomer?: any;
  preFillAddress?: CustomerAddress;
}

export function NewOrderView({
  settings,
  onOrderSaved,
  onRequestConfig,
  initialShippingDate,
  preFillCustomer,
  preFillAddress,
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

  // 다중 배송지 및 주문자/수령인 분리 상태 관리
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [saveAsNewAddress, setSaveAsNewAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("");
  // 받는 분이 주문자와 다를 경우를 위한 별도 수령인 정보
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientPhone2, setRecipientPhone2] = useState("");
  const [differentRecipient, setDifferentRecipient] = useState(false);

  // 한 사람이 여러 사람에게 보낼 때: 1인 다처 다중 배송 모드
  const [isMultiDest, setIsMultiDest] = useState(false);
  const [destinations, setDestinations] = useState<MultiDestinationItem[]>([
    {
      alias: "배송지 1",
      recipient_name: "",
      recipient_phone: "",
      recipient_phone2: "",
      address: "",
      address_detail: "",
      shipping_date: initialShippingDate || format(addDays(new Date(), 2), "yyyy-MM-dd"),
      quantity: 1,
      memo: "",
      save_as_address: true,
    },
  ]);

  // 배송지 추가
  const handleAddDestination = () => {
    setDestinations((prev) => [
      ...prev,
      {
        alias: `배송지 ${prev.length + 1}`,
        recipient_name: "",
        recipient_phone: "",
        recipient_phone2: "",
        address: "",
        address_detail: "",
        shipping_date: shippingDate,
        quantity: 1,
        memo: "",
        save_as_address: true,
      },
    ]);
  };

  // 배송지 삭제
  const handleRemoveDestination = (index: number) => {
    if (destinations.length <= 1) {
      alert("배송지는 최소 1곳 이상이어야 합니다.");
      return;
    }
    setDestinations((prev) => prev.filter((_, i) => i !== index));
  };

  // 배송지 값 수정
  const handleUpdateDestination = (index: number, field: keyof MultiDestinationItem, value: any) => {
    setDestinations((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  // 등록된 주소록에서 특정 배송지 카드에 적용
  const handleApplyAddressToDestination = (index: number, addr: CustomerAddress) => {
    setDestinations((prev) =>
      prev.map((d, i) =>
        i === index
          ? {
              ...d,
              alias: addr.alias || d.alias,
              recipient_name: addr.recipient_name,
              recipient_phone: addr.recipient_phone,
              recipient_phone2: addr.recipient_phone2 || "",
              address: addr.address,
              address_detail: addr.address_detail || "",
              memo: addr.delivery_memo || d.memo,
              save_as_address: false,
            }
          : d
      )
    );
  };

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

  const applyAddress = (addr: CustomerAddress) => {
    setSelectedAddressId(addr.id);
    // 주문 고객은 그대로 유지하고 받는 사람/배송지만 변경
    setRecipientName(addr.recipient_name || "");
    setRecipientPhone(addr.recipient_phone || "");
    setRecipientPhone2(addr.recipient_phone2 || "");
    setAddress(addr.address || "");
    setAddressDetail(addr.address_detail || "");
    setSaveAsNewAddress(false);
    // 수령인이 주문 고객과 다르면 differentRecipient를 true로 설정
    if (addr.recipient_name && addr.recipient_name !== (selectedCustomer?.name || name)) {
      setDifferentRecipient(true);
    } else {
      setDifferentRecipient(false);
    }
  };

  const selectExistingCustomer = async (cust: any) => {
    setSelectedCustomer(cust);
    setName(cust.name || "");
    setPhone(cust.phone || "");
    setRecipientName(cust.name || "");
    setRecipientPhone(cust.phone || "");
    setRecipientPhone2(cust.phone2 || "");
    setAddress(cust.address || "");
    setAddressDetail(cust.address_detail || "");
    setDifferentRecipient(false);
    setCustomerSuggestions([]);
    setSaveAsNewAddress(false);
    setNewAddressLabel("");

    // 고객의 등록된 다중 배송지 목록 조회
    try {
      const addrs = await fetchCustomerAddressesService(cust.id);
      setCustomerAddresses(addrs || []);
      if (addrs && addrs.length > 0) {
        const def = addrs.find((a) => a.is_default === 1) || addrs[0];
        applyAddress(def);
      } else {
        setSelectedAddressId(null);
      }
    } catch {
      setCustomerAddresses([]);
      setSelectedAddressId(null);
    }
  };

  // 외부(고객 관리 화면 등)에서 전달된 고객 및 배송지 정보 자동 반영
  useEffect(() => {
    if (preFillCustomer) {
      selectExistingCustomer(preFillCustomer).then(() => {
        if (preFillAddress) {
          applyAddress(preFillAddress);
        }
      });
    }
  }, [preFillCustomer, preFillAddress]);

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

  // 단가 및 총액 계산 (단일 배송 vs 다중 배송)
  const product20 = products.find((p) => Number(p.weight_kg) === 20) || {
    id: 2,
    name: "절임배추 20kg",
    price: 68000,
    weight_kg: 20,
  };

  const totalBoxes = isMultiDest
    ? destinations.reduce((sum, d) => sum + Number(d.quantity || 0), 0)
    : qty20kg;

  const totalAmount = totalBoxes * Number(product20.price);

  // --- 최종 주문 등록 제출 ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert(isEvent ? "납품처 / 수령처 이름을 입력해 주세요." : "주문 고객 이름을 입력해 주세요.");
      return;
    }
    if (!isEvent && !phone.trim()) {
      alert("주문 고객 전화번호를 입력해 주세요.");
      return;
    }

    // 다중 배송지 모드 제출 처리
    if (isMultiDest) {
      if (destinations.length === 0) {
        alert("배송지를 1곳 이상 추가해 주세요.");
        return;
      }
      for (let i = 0; i < destinations.length; i++) {
        const d = destinations[i];
        if (!d.recipient_name.trim()) {
          alert(`[배송지 ${i + 1}] 받는 분 성함을 입력해 주세요.`);
          return;
        }
        if (!d.address.trim()) {
          alert(`[배송지 ${i + 1}] 배송 주소를 입력해 주세요.`);
          return;
        }
        if (d.quantity < 1) {
          alert(`[배송지 ${i + 1}] 수량을 1박스 이상 입력해 주세요.`);
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const multiRes = await createMultiDestinationOrderService({
          customer_id: selectedCustomer?.id ? Number(selectedCustomer.id) : undefined,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          payment_status: paymentStatus,
          product: {
            id: product20.id,
            name: product20.name,
            price: product20.price,
            weight_kg: product20.weight_kg,
          },
          destinations,
          order_type: isEvent ? "EVENT" : "NORMAL",
          event_name: isEvent ? (eventName.trim() || "임실 김치 축제") : null,
        });

        alert(`총 ${multiRes.totalCount}곳의 배송지로 주문이 일괄 등록되었습니다! (총 ${multiRes.totalBoxes}박스)`);

        const firstOrder = multiRes.orders[0];
        const shareData: OrderCardData = {
          orderNo: `${firstOrder?.orderNo || "MULTI"} 외 ${multiRes.totalCount - 1}건`,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          shippingDate: destinations[0]?.shipping_date || shippingDate,
          shippingAddress: `${destinations[0]?.recipient_name} 등 총 ${multiRes.totalCount}곳 배송`,
          shippingAddressDetail: "",
          itemsSummary: `절임배추 20kg 총 ${multiRes.totalBoxes}박스 (${multiRes.totalCount}곳 배송)`,
          totalAmount: multiRes.totalAmount,
          paymentStatus,
          memo: `[다중 배송] ${destinations.map(d => `${d.recipient_name}(${d.quantity}박스)`).join(", ")}`,
          shopName: settings.shop_name || "임실참배추농원",
          shopPhone: settings.shop_phone || (settings as any).phone || "010-0000-0000",
          extraPhones: parseExtraPhones(settings.extra_phones),
          shareMessageTemplate: settings.share_message_template,
          bankName: settings.bank_name || "농협",
          bankAccount: settings.bank_account || "351-0000-0000-00",
          ownerName: settings.owner_name || "대표자",
        };
        setCreatedOrderShareData(shareData);
        setShowPostOrderPrompt(true);
        return;
      } catch (err: any) {
        alert("다중 배송 주문 등록 실패: " + err.message);
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    // 단일 배송 모드 제출 처리
    if (!isEvent && !address.trim()) {
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

    const finalAddress = address.trim() || (isEvent ? "행사 현장 납품 (택배 없음)" : "");

    const effectiveRecipientName = (differentRecipient && recipientName.trim()) ? recipientName.trim() : name.trim();
    const effectiveRecipientPhone = (differentRecipient && recipientPhone.trim()) ? recipientPhone.trim() : phone.trim();

    setIsSubmitting(true);
    try {
      let createdOrderNo = "";
      if (analysisResult?.import_id) {
        // 스마트 가져오기로 생성된 경우 원본 매핑 기록과 함께 확정
        const confRes = await confirmImportedOrder({
          import_id: analysisResult.import_id,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          shipping_address: finalAddress,
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
          customer_id: selectedCustomer?.id ? Number(selectedCustomer.id) : undefined,
          name: name.trim(),
          phone: phone.trim(),
          recipient_name: effectiveRecipientName,
          recipient_phone: effectiveRecipientPhone,
          address: finalAddress,
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

      // 기존 고객에게 새 배송지 추가 저장이 체크되어 있을 경우 주소록에 등록
      if (selectedCustomer?.id && saveAsNewAddress && address.trim()) {
        try {
          await addCustomerAddressService({
            customer_id: Number(selectedCustomer.id),
            alias: newAddressLabel.trim() || "추가 배송지",
            recipient_name: effectiveRecipientName,
            recipient_phone: effectiveRecipientPhone,
            recipient_phone2: recipientPhone2.trim() || undefined,
            address: address.trim(),
            address_detail: addressDetail.trim() || undefined,
            delivery_memo: memo.trim() || undefined,
          });
        } catch (err) {
          console.error("새 배송지 자동 등록 실패:", err);
        }
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
    <div className="max-w-4xl mx-auto pb-16 space-y-3.5">
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. 상단 스마트 문자·사진 자동 입력 카드 (통합 프레임) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border-2 border-emerald-500 shadow-sm p-3 md:p-4 space-y-2.5">
        <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 leading-tight">
                문자·사진으로 3초 자동 입력
              </h2>
              <p className="text-xs text-slate-600">
                받으신 문자를 붙여넣거나 사진을 올리면, 아래 주문서에 자동으로 입력됩니다.
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const sample1 = "전주시 완산구 고사동 303 - 3으로 배추 10키로 2박스 보내주세요 얼마인가요? 010-6615-776 최봉근입니";
                setSmsText(sample1);
                handleAnalyzeSms(sample1);
              }}
              className="text-xs px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md font-bold cursor-pointer border border-emerald-200 whitespace-nowrap"
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
              className="text-xs px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-md font-bold cursor-pointer border border-amber-200 whitespace-nowrap"
            >
              예시 2 (작년처럼)
            </button>
          </div>
        </div>

        {/* 사진 업로드 버튼 2종 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
          >
            <Camera className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>카메라 촬영</span>
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border-2 border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
          >
            <ImageIcon className="w-4 h-4 text-blue-700 shrink-0" />
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
        <div className="space-y-1.5">
          <textarea
            rows={2}
            value={smsText}
            onChange={(e) => setSmsText(e.target.value)}
            placeholder="문자 내용을 여기에 길게 눌러 [붙여넣기] 하세요...&#10;예: 전주시 완산구 고사동 303-3 배추 10키로 2박스 010-6615-776 최봉근"
            className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-xl text-sm md:text-base text-slate-900 focus:border-emerald-600 focus:outline-hidden bg-slate-50"
          />

          <button
            type="button"
            onClick={() => handleAnalyzeSms()}
            disabled={isAnalyzing}
            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-base font-black flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>문자 분석 중 ({analysisProgress?.message || "잠시만 기다려주세요..."})</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>문자 분석하여 아래 양식에 자동 채우기</span>
              </>
            )}
          </button>
        </div>

        {/* 분석 완료 시 알림 & 안내 배너 */}
        {autoFilledNotice && analysisResult && (
          <div className="space-y-1.5 pt-1">
            {/* 1. 자동 채움 완료 성공 알림 */}
            <div className="p-2 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-emerald-950 flex items-center gap-1.5 text-xs md:text-sm font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>문자 내용을 분석하여 아래 주문서에 자동 입력했습니다. 확인 후 등록하세요!</span>
            </div>

            {/* 2. 중복 검사 결과 알림 */}
            {analysisResult.duplicate_check.decision === "DUPLICATE" ? (
              <div className="p-2 rounded-xl border-2 border-red-500 bg-red-50 text-red-950 flex items-start gap-2 text-xs md:text-sm">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black text-red-700">중복 주문 주의!</span>
                  <p className="mt-0.5">{analysisResult.duplicate_check.reason}</p>
                </div>
              </div>
            ) : analysisResult.duplicate_check.decision === "POSSIBLE_DUPLICATE" ? (
              <div className="p-2 rounded-xl border-2 border-amber-500 bg-amber-50 text-amber-950 flex items-center gap-2 text-xs md:text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>확인 필요: {analysisResult.duplicate_check.reason}</span>
              </div>
            ) : null}

            {/* 3. 기존 단골 고객 발견 알림 & 과거 배송지 적용 버튼 */}
            {analysisResult.customer_match && (
              <div className="p-2 rounded-xl border-2 border-blue-400 bg-blue-50 text-blue-950 flex items-center justify-between gap-2 text-xs md:text-sm">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    기존 단골 고객: <strong>{analysisResult.customer_match.name}</strong> ({analysisResult.customer_match.phone})
                  </span>
                </div>
                {analysisResult.customer_match.last_order && (
                  <button
                    type="button"
                    onClick={handleApplyPastOrderAddress}
                    className="px-2 py-0.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                  >
                    <History className="w-3 h-3" />
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
      <div ref={formTopRef} className="bg-white rounded-2xl border-2 border-slate-300 p-3 md:p-4 shadow-sm">
        <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900">
              주문 등록
            </h1>
            <p className="text-slate-600 text-xs md:text-sm mt-0.5">
              고객 정보와 수량을 확인하시고 아래 [주문 등록 완료] 버튼을 눌러주세요.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 주문 구분: 일반 고객 택배 주문 vs 행사·축제 납품 */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-300 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <span>주문 구분</span>
                <span className="text-xs font-normal text-slate-500">
                  (행사·축제 물량은 스케줄에서 별도로 분리 집계됩니다)
                </span>
              </label>
              {isEvent && (
                <span className="text-xs font-bold text-slate-900 bg-slate-200 border border-slate-400 px-2 py-0.5 rounded-md whitespace-nowrap">
                  [행사 납품 모드]
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsEvent(false)}
                className={`py-2 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all border whitespace-nowrap ${
                  !isEvent
                    ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <Package className="w-4 h-4 shrink-0" />
                <span>일반 택배 주문</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEvent(true)}
                className={`py-2 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all border whitespace-nowrap ${
                  isEvent
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <CalendarCheck className="w-4 h-4 shrink-0" />
                <span>행사·축제 납품</span>
              </button>
            </div>

            {isEvent && (
              <div className="bg-white border border-slate-300 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-1">
                    <span>행사 / 축제 명칭 <span className="text-red-600">*</span></span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEventName("임실 김치 축제")}
                    className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 rounded-md cursor-pointer transition-colors whitespace-nowrap"
                  >
                    + 임실 김치 축제 자동입력
                  </button>
                </div>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="예: 임실 김치 축제"
                  className="w-full text-sm font-bold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  required={isEvent}
                />
                <p className="text-xs text-slate-600 leading-relaxed">
                  [안내] 이 주문은 달력 스케줄러, 출고 현황, 발송 명단에서 <strong>[임실 김치 축제]</strong> 태그로 일반 택배와 완전히 별도 집계 및 구분 표시됩니다.
                </p>
              </div>
            )}
          </div>

          {/* 고객명 & 연락처 & 주소 영역 (일반 택배 vs 행사 납품 분기) */}
          {isEvent ? (
            <div className="space-y-3">
              {/* 행사 납품처 이름 입력 */}
              <div>
                <label className="block text-base font-bold text-slate-900 mb-1 flex items-center justify-between">
                  <span>납품처 / 수령처 (행사 담당부서) <span className="text-red-600">*</span></span>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md whitespace-nowrap">
                    행사 납품처 필수
                  </span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 축제 본부석, 김치 체험관, 1호 부스 등"
                  className="w-full text-sm font-bold border border-slate-300 rounded-xl px-3 py-2 focus:border-emerald-600 focus:outline-hidden bg-white shadow-xs"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 일반 고객명 & 연락처 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-base font-bold text-slate-900">
                      전화번호 <span className="text-red-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handlePickContactForOrder}
                      className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg border border-emerald-300 cursor-pointer transition-all whitespace-nowrap shrink-0"
                      title="스마트폰 주소록에서 연락처 선택"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                      <span>연락처 선택</span>
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="예: 010-1234-5678"
                    className="w-full text-sm font-bold border border-slate-300 rounded-xl px-3 py-2 focus:border-emerald-600 focus:outline-hidden bg-white"
                    required
                  />

                  {/* 기존 고객 자동완성 드롭다운 */}
                  {customerSuggestions.length > 0 && (
                    <div className="mt-1.5 bg-emerald-50 border border-emerald-300 rounded-xl p-2 space-y-1">
                      <div className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>기존 고객 선택 시 배송지 자동 로드:</span>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {customerSuggestions.map((cust) => (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => selectExistingCustomer(cust)}
                            className="w-full text-left bg-white hover:bg-emerald-100/70 p-2 rounded-lg border border-emerald-200 cursor-pointer flex justify-between items-center transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {cust.customer_code && (
                                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 px-1.5 py-0.2 rounded whitespace-nowrap shrink-0">
                                    #{cust.customer_code}
                                  </span>
                                )}
                                <span className="text-sm font-bold text-slate-900 whitespace-nowrap">
                                  {cust.name}
                                </span>
                                <span className="text-xs text-slate-600 whitespace-nowrap">{cust.phone}</span>
                                {cust.address_count && cust.address_count > 1 && (
                                  <span className="text-xs text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded whitespace-nowrap shrink-0">
                                    배송지 {cust.address_count}곳
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 truncate mt-0.5">
                                {cust.address} {cust.address_detail}
                              </div>
                            </div>
                            <span className="bg-emerald-700 text-white text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap shrink-0">
                              선택
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-900 mb-1">
                    주문 고객명 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!differentRecipient) setRecipientName(e.target.value);
                    }}
                    placeholder="예: 홍길동 (주문하시는 분)"
                    className="w-full text-sm font-bold border border-slate-300 rounded-xl px-3 py-2 focus:border-emerald-600 focus:outline-hidden bg-white"
                    required
                  />
                </div>
              </div>

              {/* 배송지 모드 선택: 1곳 배송 vs 여러 사람에게 보내기 (다중 배송) */}
              <div className="bg-emerald-50/60 border border-emerald-300 rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Split className="w-4 h-4 text-emerald-700" />
                    <span>배송 방식 선택</span>
                  </label>
                  <span className="text-xs text-slate-500">
                    한 분이 여러 가족/지인에게 보낼 땐 [여러 곳으로 발송]을 선택하세요
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMultiDest(false)}
                    className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all border whitespace-nowrap ${
                      !isMultiDest
                        ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <Package className="w-4 h-4 shrink-0" />
                    <span>한 곳으로 배송 (단일 배송)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMultiDest(true);
                      if (destinations.length === 1 && !destinations[0].address) {
                        setDestinations([
                          {
                            alias: "서울 딸네",
                            recipient_name: recipientName || "",
                            recipient_phone: recipientPhone || "",
                            recipient_phone2: "",
                            address: address || "",
                            address_detail: addressDetail || "",
                            shipping_date: shippingDate,
                            quantity: 1,
                            memo: "",
                            save_as_address: true,
                          },
                        ]);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all border whitespace-nowrap ${
                      isMultiDest
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>여러 사람에게 나누어 보내기 ({destinations.length}곳)</span>
                  </button>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────── */}
              {/* [모드 A] 여러 곳으로 나누어 보내기 (다중 배송지 모드) */}
              {/* ─────────────────────────────────────────────────── */}
              {isMultiDest ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-700" />
                      <span>배송지 및 수령인 목록 ({destinations.length}곳 / 총 {totalBoxes}박스)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddDestination}
                      className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ 배송지 추가하기</span>
                    </button>
                  </div>

                  {destinations.map((dest, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border-2 border-slate-300 rounded-xl p-3.5 space-y-3 relative animate-in fade-in duration-100"
                    >
                      {/* 배송지 카드 헤더 */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-800 text-white text-xs font-bold px-2 py-0.5 rounded">
                            배송지 {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={dest.alias || ""}
                            onChange={(e) => handleUpdateDestination(idx, "alias", e.target.value)}
                            placeholder="별칭 (예: 서울 딸네, 부산 아들네, 시댁)"
                            className="text-xs font-bold border border-slate-300 rounded px-2 py-0.5 bg-white text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                          />
                        </div>

                        {destinations.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDestination(idx)}
                            className="inline-flex items-center gap-0.5 text-xs text-slate-400 hover:text-red-600 cursor-pointer p-1"
                            title="이 배송지 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>삭제</span>
                          </button>
                        )}
                      </div>

                      {/* 고객 등록 주소록에서 빠른 선택 */}
                      {selectedCustomer && customerAddresses.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
                          <span className="font-bold text-slate-500 whitespace-nowrap">주소록에서 선택:</span>
                          {customerAddresses.map((addr) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => handleApplyAddressToDestination(idx, addr)}
                              className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-emerald-50 text-slate-700 text-xs font-bold whitespace-nowrap cursor-pointer"
                            >
                              [{addr.alias || "배송지"}] {addr.recipient_name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 받는 분 성함 & 연락처 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            받는 분 성함 <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={dest.recipient_name}
                            onChange={(e) => handleUpdateDestination(idx, "recipient_name", e.target.value)}
                            placeholder="예: 김딸, 박아들"
                            className="w-full text-sm font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            받는 분 연락처 1
                          </label>
                          <input
                            type="tel"
                            value={dest.recipient_phone}
                            onChange={(e) => handleUpdateDestination(idx, "recipient_phone", formatPhone(e.target.value))}
                            placeholder="010-0000-0000"
                            className="w-full text-sm font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            추가 연락처 2 (선택)
                          </label>
                          <input
                            type="tel"
                            value={dest.recipient_phone2 || ""}
                            onChange={(e) => handleUpdateDestination(idx, "recipient_phone2", formatPhone(e.target.value))}
                            placeholder="집/추가번호"
                            className="w-full text-sm font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* 배송 주소 & 상세 주소 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-800">
                          배송 주소 <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={dest.address}
                          onChange={(e) => handleUpdateDestination(idx, "address", e.target.value)}
                          placeholder="도로명 또는 지번 주소"
                          className="w-full text-sm font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                          required
                        />
                        <input
                          type="text"
                          value={dest.address_detail || ""}
                          onChange={(e) => handleUpdateDestination(idx, "address_detail", e.target.value)}
                          placeholder="동/호수 등 상세 주소"
                          className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>

                      {/* 이 배송지로 보낼 수량(박스) & 도착 희망일 & 요청사항 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            발송 수량 (20kg 박스) <span className="text-red-600">*</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateDestination(idx, "quantity", Math.max(1, (dest.quantity || 1) - 1))}
                              className="w-8 h-8 rounded border border-slate-300 bg-white font-bold hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-10 text-center font-black text-sm text-slate-900">
                              {dest.quantity}박스
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateDestination(idx, "quantity", (dest.quantity || 1) + 1)}
                              className="w-8 h-8 rounded border border-emerald-400 bg-emerald-700 text-white font-bold hover:bg-emerald-800 flex items-center justify-center cursor-pointer"
                            >
                              +
                            </button>
                            <span className="text-xs text-emerald-800 font-bold ml-1">
                              {formatPrice(dest.quantity * Number(product20.price))}원
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            도착 희망일
                          </label>
                          <input
                            type="date"
                            value={dest.shipping_date}
                            onChange={(e) => handleUpdateDestination(idx, "shipping_date", e.target.value)}
                            className="w-full text-xs font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            배송 요청사항
                          </label>
                          <input
                            type="text"
                            value={dest.memo || ""}
                            onChange={(e) => handleUpdateDestination(idx, "memo", e.target.value)}
                            placeholder="예: 문 앞 보관"
                            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:border-emerald-600 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* 고객 주소록 자동 추가 체크 */}
                      {selectedCustomer && (
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer pt-0.5">
                          <input
                            type="checkbox"
                            checked={dest.save_as_address !== false}
                            onChange={(e) => handleUpdateDestination(idx, "save_as_address", e.target.checked)}
                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                          />
                          <span>이 배송지를 고객 주소록에 자동 등록</span>
                        </label>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddDestination}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border-2 border-dashed border-slate-300 text-slate-800 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ 배송지 추가하기 (현재 {destinations.length}곳)</span>
                  </button>
                </div>
              ) : (
                /* ─────────────────────────────────────────────────── */
                /* [모드 B] 한 곳으로 배송 (기본 단일 배송 모드) */
                /* ─────────────────────────────────────────────────── */
                <div className="space-y-3">
                  {/* 주문 고객과 받는 분이 다른 경우 (예: 자녀, 친척에게 보내는 경우) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={differentRecipient}
                        onChange={(e) => {
                          setDifferentRecipient(e.target.checked);
                          if (!e.target.checked) {
                            setRecipientName(name);
                            setRecipientPhone(phone);
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                      <span>받는 분(수령인)이 주문 고객과 다릅니다 (가족·선물 발송)</span>
                    </label>

                    {differentRecipient && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200 animate-in fade-in duration-100">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            받는 분 성함 <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            placeholder="예: 김딸, 박아들"
                            className="w-full text-sm font-bold border border-slate-300 rounded-lg px-3 py-1.5 focus:border-emerald-600 focus:outline-hidden bg-white"
                            required={differentRecipient}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            받는 분 연락처 <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="tel"
                            value={recipientPhone}
                            onChange={(e) => setRecipientPhone(formatPhone(e.target.value))}
                            placeholder="예: 010-9876-5432"
                            className="w-full text-sm font-bold border border-slate-300 rounded-lg px-3 py-1.5 focus:border-emerald-600 focus:outline-hidden bg-white"
                            required={differentRecipient}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 다중 배송지 선택 인터페이스 (기존 고객 선택 시) */}
                  {selectedCustomer && customerAddresses.length > 0 && (
                    <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{selectedCustomer.name} 님의 등록 배송지 ({customerAddresses.length}곳)</span>
                        </span>
                        <span className="text-xs text-slate-500">배송지를 누르면 바로 변경됩니다</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 overflow-x-auto">
                        {customerAddresses.map((addr) => {
                          const isSelected = selectedAddressId === addr.id;
                          return (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => applyAddress(addr)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                                isSelected
                                  ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                                  : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              <span className={isSelected ? "text-emerald-100" : "text-emerald-700"}>
                                [{addr.alias || "배송지"}]
                              </span>
                              <span>{addr.recipient_name} ({addr.recipient_phone})</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAddressId(null);
                            setAddress("");
                            setAddressDetail("");
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border border-dashed cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                            selectedAddressId === null
                              ? "bg-slate-200 text-slate-900 border-slate-400"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          + 새 배송지로 직접 입력
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 배송지 주소 입력 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-base font-bold text-slate-900">
                        배송 주소 <span className="text-red-600">*</span>
                      </label>
                      {selectedCustomer && selectedAddressId === null && (
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={saveAsNewAddress}
                            onChange={(e) => setSaveAsNewAddress(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                          />
                          <span>이 배송지를 고객 주소록에 추가</span>
                        </label>
                      )}
                    </div>

                    {selectedCustomer && selectedAddressId === null && saveAsNewAddress && (
                      <div className="mb-1.5">
                        <input
                          type="text"
                          value={newAddressLabel}
                          onChange={(e) => setNewAddressLabel(e.target.value)}
                          placeholder="배송지 명칭 입력 (예: 서울 딸네, 부산 아들네, 회사)"
                          className="w-full text-xs border border-emerald-300 rounded-lg px-2.5 py-1.5 bg-emerald-50 text-emerald-950 focus:border-emerald-600 focus:outline-hidden"
                        />
                      </div>
                    )}

                    <input
                      type="text"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (selectedAddressId) setSelectedAddressId(null);
                      }}
                      placeholder="시·군·구·도로명 또는 지번 주소"
                      className="w-full text-sm font-bold border border-slate-300 rounded-xl px-3 py-2 mb-1.5 focus:border-emerald-600 focus:outline-hidden bg-white"
                      required={!isMultiDest}
                    />
                    <input
                      type="text"
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                      placeholder="동/호수, 마을이름 등 상세 주소 (선택)"
                      className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:border-emerald-600 focus:outline-hidden bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 상품 단위 및 수량 선택 (단일 배송 시 개별 수량/배송일, 다중 배송 시 합계 안내) */}
          {isMultiDest ? (
            <div className="bg-slate-900 text-white rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div>
                <div className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>다중 배송 총합 ({destinations.length}곳 분할 발송)</span>
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  절임배추 20kg 총 {totalBoxes}박스 ({totalBoxes * 20}kg)
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-300">총 합계 금액</div>
                <div className="text-base font-black text-white">
                  {formatPrice(totalAmount)}원
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 상품 단위 및 수량 선택 (절임배추 20kg 단일 규격) */}
              <div className="border-t border-b border-slate-200 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">
                    주문 상품 및 수량
                  </h3>
                  <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                    판매 품목: 절임배추 20kg
                  </span>
                </div>

                {/* 20kg 메인 카드 */}
                <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-base font-bold text-emerald-950 flex items-center gap-1.5">
                        <span>{product20.name}</span>
                        <span className="text-xs font-semibold bg-emerald-700 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                          기본 1박스
                        </span>
                      </div>
                      <div className="text-sm font-bold text-emerald-800 mt-0.5">
                        단가: <span className="stat-number">{formatPrice(product20.price)}</span>원 / 1박스
                      </div>
                    </div>

                    {/* 수량 조절 버튼 */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQty20kg((prev) => Math.max(1, prev - 1))}
                        className="w-9 h-9 bg-white border border-emerald-400 rounded-lg text-lg font-bold flex items-center justify-center hover:bg-emerald-100 active:scale-95 cursor-pointer shadow-2xs shrink-0"
                      >
                        <Minus className="w-4 h-4 text-emerald-900" />
                      </button>
                      <span className="text-xl font-bold w-10 text-center stat-number text-emerald-950">
                        {qty20kg}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty20kg((prev) => prev + 1)}
                        className="w-9 h-9 bg-emerald-700 text-white rounded-lg text-lg font-bold flex items-center justify-center hover:bg-emerald-800 active:scale-95 cursor-pointer shadow-xs shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 빠른 박스 수량 선택 버튼 모음 */}
                  <div className="pt-2 border-t border-emerald-200 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-900 mr-0.5 whitespace-nowrap">빠른 선택:</span>
                    {[1, 2, 3, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setQty20kg(num)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all whitespace-nowrap shrink-0 ${
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
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 space-y-1.5">
                <div>
                  <label className="text-base font-bold text-slate-900 flex items-center gap-1">
                    <span>택배 도착 희망일 (배추 받는 날)</span>
                    <span className="text-red-600">*</span>
                  </label>
                </div>
                <p className="text-xs text-slate-600">
                  고객이 김치 담그기 전날 수령할 날짜를 선택합니다.
                </p>
                <input
                  type="date"
                  value={shippingDate}
                  onChange={(e) => setShippingDate(e.target.value)}
                  className="w-full text-base font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden bg-white"
                  required
                />
              </div>
            </>
          )}

          {/* 입금 상태 선택 */}
          <div>
            <label className="block text-base font-bold text-slate-900 mb-1">
              입금 여부
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentStatus("UNPAID")}
                className={`py-2 rounded-xl border cursor-pointer transition-all text-sm font-bold whitespace-nowrap ${
                  paymentStatus === "UNPAID"
                    ? "bg-rose-50 border-rose-300 text-rose-900 shadow-xs"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              >
                미입금 (입금 대기)
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus("PAID")}
                className={`py-2 rounded-xl border cursor-pointer transition-all text-sm font-bold whitespace-nowrap ${
                  paymentStatus === "PAID"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              >
                입금 완료 (확인됨)
              </button>
            </div>
          </div>

          {/* 배송 및 원본 메모 */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">
              배송 메모 및 원본 내용 (선택)
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 문 앞에 놓아주세요 / 오후 배송 요망"
              className="w-full text-sm md:text-base border-2 border-slate-200 rounded-xl px-3 py-1.5 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {/* 총 금액 요약 */}
          <div className="bg-slate-900 text-white rounded-xl p-3">
            <div className="flex justify-between items-center text-base font-bold mb-1">
              <span>총 주문 금액:</span>
              <span className="text-xl font-bold text-white stat-number">
                {formatPrice(totalAmount)}원
              </span>
            </div>
            <div className="text-xs text-slate-300 border-t border-slate-800 pt-1.5 mt-1.5">
              입금 안내 계좌: {settings.bank_name || "농협"} {settings.bank_account || "351-0000-0000-00"} ({settings.owner_name || "대표자"})
            </div>
          </div>

          {/* 최종 주문 등록 완료 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-base font-bold rounded-xl shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{isSubmitting ? "주문 등록 중..." : "확인 완료 및 주문 등록"}</span>
          </button>
        </form>
      </div>

      {/* 1. 주문 등록 완료 후 문자/카톡 발송 확인 팝업 */}
      {showPostOrderPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 text-center space-y-3 shadow-2xl border-2 border-emerald-600 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">
                주문 등록이 완료되었습니다!
              </h3>
              <p className="text-sm text-slate-700 mt-1 font-medium leading-relaxed">
                고객님(<strong>{createdOrderShareData?.customerName}</strong>)에게 주문 확인서와 입금 계좌를 <strong>문자나 카카오톡으로 발송</strong>하시겠습니까?
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowPostOrderPrompt(false);
                  setShowShareModal(true);
                }}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-all whitespace-nowrap"
              >
                <Share2 className="w-4 h-4" />
                <span>예, 문자·카톡 발송하기</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPostOrderPrompt(false);
                  onOrderSaved();
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
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
