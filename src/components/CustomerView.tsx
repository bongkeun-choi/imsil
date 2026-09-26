"use client";

import React, { useState, useEffect, useRef } from "react";
import { formatPrice } from "@/lib/utils";
import {
  Phone,
  MessageSquare,
  MapPin,
  Smartphone,
  Upload,
  UserPlus,
  CheckSquare,
  Square,
  X,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import {
  fetchCustomersService,
  fetchCustomerDetailService,
  createCustomerService,
  batchCreateCustomersService,
} from "@/lib/services";
import {
  ImportedContact,
  isContactPickerSupported,
  pickContactsFromDevice,
  parseVCard,
  formatKoreanPhone,
} from "@/lib/contactHelper";

interface CustomerViewProps {
  onRequestConfig: () => void;
}

export function CustomerView({ onRequestConfig }: CustomerViewProps) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);

  // 연락처 가져오기 모달 상태
  const [importContactsModal, setImportContactsModal] = useState(false);
  const [contactsToImport, setContactsToImport] = useState<ImportedContact[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // 미지원 브라우저 안내 모달 상태
  const [unsupportedModal, setUnsupportedModal] = useState(false);

  // 직접 고객 등록 모달 상태
  const [manualAddModal, setManualAddModal] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualAddressDetail, setManualAddressDetail] = useState("");
  const [manualMemo, setManualMemo] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // 모바일 뒤로가기 버튼 처리
  useEffect(() => {
    const handlePopState = () => {
      if (importContactsModal || manualAddModal || unsupportedModal) {
        setImportContactsModal(false);
        setManualAddModal(false);
        setUnsupportedModal(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [importContactsModal, manualAddModal, unsupportedModal]);

  const openModalSafely = (type: "import" | "manual" | "unsupported") => {
    window.history.pushState({ modal: `customer-${type}` }, "");
    if (type === "import") setImportContactsModal(true);
    if (type === "manual") setManualAddModal(true);
    if (type === "unsupported") setUnsupportedModal(true);
  };

  const closeModalSafely = () => {
    if (window.location.hash || window.history.state?.modal) {
      window.history.back();
    } else {
      setImportContactsModal(false);
      setManualAddModal(false);
      setUnsupportedModal(false);
    }
  };

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

  // 1. 스마트폰 연락처 연동 호출
  const handlePickPhoneContacts = async () => {
    if (!isContactPickerSupported()) {
      openModalSafely("unsupported");
      return;
    }

    try {
      const contacts = await pickContactsFromDevice(true);
      if (contacts.length > 0) {
        setContactsToImport(contacts);
        openModalSafely("import");
      }
    } catch (error: any) {
      console.error("연락처 불러오기 실패:", error);
      alert("연락처를 불러오는 중 문제가 발생했습니다: " + (error.message || ""));
    }
  };

  // 2. vCard (.vcf) 파일 업로드 처리
  const handleVcfFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = parseVCard(text);
        if (parsed.length === 0) {
          alert("파일에서 연락처 정보를 찾을 수 없습니다. 올바른 .vcf 파일인지 확인해주세요.");
          return;
        }
        setContactsToImport(parsed);
        openModalSafely("import");
      } catch (err) {
        console.error(err);
        alert("연락처 파일을 분석하는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // 초기화
  };

  // 연락처 전체 선택 / 해제 토글
  const toggleSelectAllContacts = () => {
    const allSelected = contactsToImport.every((c) => c.selected);
    setContactsToImport((prev) =>
      prev.map((c) => ({ ...c, selected: !allSelected }))
    );
  };

  // 개별 연락처 선택 토글
  const toggleContact = (id?: string) => {
    setContactsToImport((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  // 선택한 연락처 일괄 저장
  const handleSaveImportedContacts = async () => {
    const selected = contactsToImport.filter((c) => c.selected && c.name && c.phone);
    if (selected.length === 0) {
      alert("저장할 고객을 1명 이상 선택해주세요.");
      return;
    }

    setIsImporting(true);
    try {
      const res = await batchCreateCustomersService(
        selected.map((c) => ({
          name: c.name,
          phone: c.phone,
          address: c.address || "",
          address_detail: "",
          memo: c.memo || "스마트폰 연락처 연동 등록",
        }))
      );

      alert(
        `총 ${selected.length}명의 고객 중 신규 ${res.createdCount}명 등록, 기존 ${res.updatedCount}명 정보가 갱신되었습니다.`
      );
      closeModalSafely();
      await fetchCustomers(query);
    } catch (e: any) {
      console.error(e);
      alert("고객 저장 중 오류가 발생했습니다: " + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  // 직접 고객 단건 등록
  const handleSaveManualCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      alert("고객 이름을 입력해주세요.");
      return;
    }
    if (!manualPhone.trim()) {
      alert("전화번호를 입력해주세요.");
      return;
    }

    setIsImporting(true);
    try {
      await createCustomerService({
        name: manualName.trim(),
        phone: formatKoreanPhone(manualPhone.trim()),
        address: manualAddress.trim(),
        address_detail: manualAddressDetail.trim(),
        memo: manualMemo.trim(),
      });

      alert("고객 정보가 성공적으로 저장되었습니다.");
      setManualName("");
      setManualPhone("");
      setManualAddress("");
      setManualAddressDetail("");
      setManualMemo("");
      closeModalSafely();
      await fetchCustomers(query);
    } catch (e: any) {
      console.error(e);
      alert("고객 등록 중 오류가 발생했습니다: " + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* 숨겨진 vcf 파일 업로드 input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleVcfFileUpload}
        accept=".vcf,text/vcard"
        className="hidden"
      />

      {/* 상단 액션 바: 검색 및 연락처 등록 버튼들 */}
      <div className="bg-white p-5 rounded-2xl border-2 border-slate-300 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="고객 이름 또는 전화번호 뒷자리 검색"
            className="flex-1 text-lg md:text-xl font-bold border-2 border-slate-300 rounded-xl px-4 py-3 focus:border-emerald-600 focus:outline-hidden"
          />
          <button
            type="submit"
            className="btn-large px-6 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer transition-colors"
          >
            검색
          </button>
        </form>

        {/* 연락처 연동 및 추가 버튼 모음 */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={handlePickPhoneContacts}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-base shadow-xs cursor-pointer transition-colors active:scale-95"
          >
            <Smartphone className="w-5 h-5" />
            <span>핸드폰 연락처 가져오기</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-300 px-4 py-2.5 rounded-xl font-bold text-base cursor-pointer transition-colors active:scale-95"
          >
            <Upload className="w-5 h-5 text-slate-600" />
            <span>연락처 파일(.vcf) 불러오기</span>
          </button>

          <button
            type="button"
            onClick={() => openModalSafely("manual")}
            className="inline-flex items-center gap-2 bg-white hover:bg-blue-50 text-blue-700 border-2 border-blue-300 px-4 py-2.5 rounded-xl font-bold text-base cursor-pointer transition-colors ml-auto active:scale-95"
          >
            <UserPlus className="w-5 h-5 text-blue-600" />
            <span>+ 직접 고객 등록</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 등록된 단골 고객 목록 */}
        <div className="md:col-span-2 bg-white rounded-2xl border-2 border-slate-300 p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <h2 className="text-xl md:text-2xl font-black text-slate-900">
              등록된 단골 고객 목록 ({customers.length}명)
            </h2>
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  fetchCustomers("");
                }}
                className="text-sm font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                전체보기
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-lg font-bold text-slate-600">
              불러오는 중...
            </div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <p className="text-lg font-bold text-slate-700">
                {query ? "일치하는 고객 정보가 없습니다." : "아직 등록된 고객이 없습니다."}
              </p>
              <p className="text-sm text-slate-500">
                상단의 <strong>[핸드폰 연락처 가져오기]</strong> 버튼을 누르면 스마트폰의 주소록을 즉시 등록할 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[650px] overflow-y-auto pr-1">
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
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {c.address ? `${c.address} ${c.address_detail || ""}` : "등록된 기본 주소 없음"}
                    </span>
                  </div>

                  {c.memo && (
                    <div className="text-sm text-amber-900 bg-amber-50 rounded-md px-2 py-0.5 mt-1 inline-block border border-amber-200">
                      메모: {c.memo}
                    </div>
                  )}

                  <div className="text-sm font-semibold text-slate-500 mt-1">
                    총 {c.order_count}회 주문
                    {c.last_order_date && ` (최근 주문: ${c.last_order_date})`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 과거 주문 이력 상세 */}
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
                {customerDetail.customer.address && (
                  <div className="text-sm text-slate-600 mt-1">
                    {customerDetail.customer.address} {customerDetail.customer.address_detail || ""}
                  </div>
                )}
                {customerDetail.customer.memo && (
                  <div className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg mt-2 border border-amber-200">
                    메모: {customerDetail.customer.memo}
                  </div>
                )}
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
                        <span
                          className={
                            ord.payment_status === "PAID"
                              ? "text-emerald-700 font-bold"
                              : "text-red-600 font-bold"
                          }
                        >
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

      {/* 모달 1: 가져온 연락처 확인 및 일괄 등록 팝업 */}
      {importContactsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border-4 border-emerald-600 animate-in fade-in zoom-in duration-150">
            {/* 팝업 헤더 */}
            <div className="bg-emerald-700 text-white p-4 md:p-5 rounded-t-[20px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-6 h-6" />
                <h3 className="text-xl md:text-2xl font-black">
                  연락처 등록 확인 ({contactsToImport.length}명)
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModalSafely}
                className="text-white hover:bg-emerald-800 p-1.5 rounded-full cursor-pointer transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 팝업 본문 */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-start gap-2.5 text-sm text-emerald-950 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  휴대폰에서 불러온 연락처 목록입니다. 등록을 원하시는 고객을 체크하신 후 아래 <strong>[선택한 고객 장부에 저장]</strong> 버튼을 눌러주세요.
                </div>
              </div>

              {/* 전체 선택 토글 */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={toggleSelectAllContacts}
                  className="inline-flex items-center gap-2 text-base font-bold text-slate-800 hover:text-emerald-700 cursor-pointer"
                >
                  {contactsToImport.every((c) => c.selected) ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                  <span>전체 선택 / 해제 ({contactsToImport.filter((c) => c.selected).length}/{contactsToImport.length})</span>
                </button>
              </div>

              {/* 연락처 리스트 */}
              <div className="divide-y divide-slate-200 border-2 border-slate-200 rounded-2xl overflow-hidden max-h-[350px] overflow-y-auto">
                {contactsToImport.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => toggleContact(contact.id)}
                    className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                      contact.selected ? "bg-emerald-50/70" : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="shrink-0">
                      {contact.selected ? (
                        <CheckSquare className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <Square className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900">{contact.name}</span>
                        <span className="text-base font-bold text-emerald-700">{contact.phone}</span>
                      </div>
                      {contact.address && (
                        <div className="text-xs text-slate-600 truncate mt-0.5">
                          {contact.address}
                        </div>
                      )}
                      {contact.memo && (
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          메모: {contact.memo}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 팝업 하단 버튼 */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-[20px] flex gap-3">
              <button
                type="button"
                onClick={closeModalSafely}
                disabled={isImporting}
                className="flex-1 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-lg cursor-pointer transition-colors text-center"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveImportedContacts}
                disabled={isImporting || contactsToImport.filter((c) => c.selected).length === 0}
                className="flex-2 py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white rounded-xl font-bold text-lg cursor-pointer transition-colors shadow-md text-center"
              >
                {isImporting
                  ? "저장 중..."
                  : `선택한 ${contactsToImport.filter((c) => c.selected).length}명 고객 장부에 저장`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 2: 미지원 브라우저(PC / 사파리) 안내 모달 */}
      {unsupportedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-4 border-slate-400 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-black text-xl">
                <AlertCircle className="w-6 h-6 text-amber-600" />
                <span>연락처 가져오기 안내</span>
              </div>
              <button
                type="button"
                onClick={closeModalSafely}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="text-slate-700 space-y-3 text-base leading-relaxed">
              <p>
                현재 사용 중이신 브라우저는 보안 정책상 <strong>스마트폰 연락처 팝업 바로가기</strong>를 지원하지 않는 환경입니다.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-sm text-blue-950 space-y-1.5 font-medium">
                <div className="font-bold text-blue-900">💡 스마트폰에서 사용 시:</div>
                <div>• <strong>갤럭시/안드로이드 (크롬, 삼성인터넷)</strong>: 버튼 클릭 시 주소록이 바로 열립니다.</div>
                <div>• <strong>아이폰/PC</strong>: 연락처 앱에서 <strong>[연락처 내보내기/공유]</strong>를 하신 후 아래 파일 불러오기를 이용하시면 됩니다.</div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  closeModalSafely();
                  fileInputRef.current?.click();
                }}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Upload className="w-5 h-5" />
                <span>연락처 파일(.vcf) 불러오기</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeModalSafely();
                  openModalSafely("manual");
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-base flex items-center justify-center gap-2 border border-slate-300 cursor-pointer"
              >
                <UserPlus className="w-5 h-5 text-slate-600" />
                <span>직접 고객 정보 입력하기</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 3: 직접 고객 등록 모달 */}
      {manualAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border-4 border-blue-600 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
            <div className="bg-blue-700 text-white p-4 md:p-5 rounded-t-[20px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-6 h-6" />
                <h3 className="text-xl md:text-2xl font-black">신규 고객 직접 등록</h3>
              </div>
              <button
                type="button"
                onClick={closeModalSafely}
                className="text-white hover:bg-blue-800 p-1.5 rounded-full cursor-pointer transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveManualCustomer} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-base font-bold text-slate-900 mb-1">
                  고객 성함 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full text-lg font-bold border-2 border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-900 mb-1">
                  전화번호 <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="예: 010-1234-5678"
                  className="w-full text-lg font-bold border-2 border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-900 mb-1">
                  기본 배송 주소
                </label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="예: 서울시 강남구 테헤란로 123"
                  className="w-full text-base font-medium border-2 border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-900 mb-1">
                  상세 주소 (동/호수)
                </label>
                <input
                  type="text"
                  value={manualAddressDetail}
                  onChange={(e) => setManualAddressDetail(e.target.value)}
                  placeholder="예: 101동 202호"
                  className="w-full text-base font-medium border-2 border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-900 mb-1">
                  고객 메모
                </label>
                <textarea
                  value={manualMemo}
                  onChange={(e) => setManualMemo(e.target.value)}
                  placeholder="예: 매년 20kg 2박스 주문하시는 단골, 배추 절임 상태 바삭하게 선호"
                  rows={2}
                  className="w-full text-base font-medium border-2 border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeModalSafely}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-base cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="flex-2 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-base cursor-pointer shadow-md"
                >
                  {isImporting ? "등록 중..." : "고객 정보 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
