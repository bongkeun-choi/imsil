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
  Plus,
  Trash2,
  Bookmark,
  Search,
  Edit3,
} from "lucide-react";
import {
  fetchCustomersService,
  fetchCustomerDetailService,
  createCustomerService,
  updateCustomerService,
  batchCreateCustomersService,
  addCustomerAddressService,
  updateCustomerAddressService,
  deleteCustomerAddressService,
  CustomerAddress,
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
  const [manualPhone2, setManualPhone2] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualAddressDetail, setManualAddressDetail] = useState("");
  const [manualMemo, setManualMemo] = useState("");

  // 고객 정보 수정 모달 상태
  const [editCustomerModal, setEditCustomerModal] = useState(false);
  const [editCustomerCode, setEditCustomerCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPhone2, setEditPhone2] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAddressDetail, setEditAddressDetail] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // 배송지(수령인) 추가/수정 모달 상태
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressAlias, setAddressAlias] = useState("서울 딸네");
  const [addressRecipientName, setAddressRecipientName] = useState("");
  const [addressRecipientPhone, setAddressRecipientPhone] = useState("");
  const [addressRecipientPhone2, setAddressRecipientPhone2] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [addressDetailLine, setAddressDetailLine] = useState("");
  const [addressMemo, setAddressMemo] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  // 고객 등급 필터 상태 (전체 / VIP / 우수 / 일반)
  const [gradeFilter, setGradeFilter] = useState<"ALL" | "VIP" | "REGULAR" | "NEW">("ALL");

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
      if (importContactsModal || manualAddModal || unsupportedModal || showAddressModal || editCustomerModal) {
        setImportContactsModal(false);
        setManualAddModal(false);
        setUnsupportedModal(false);
        setShowAddressModal(false);
        setEditCustomerModal(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [importContactsModal, manualAddModal, unsupportedModal, showAddressModal, editCustomerModal]);

  const openModalSafely = (type: "import" | "manual" | "unsupported" | "address" | "edit-customer") => {
    window.history.pushState({ modal: `customer-${type}` }, "");
    if (type === "import") setImportContactsModal(true);
    if (type === "manual") setManualAddModal(true);
    if (type === "unsupported") setUnsupportedModal(true);
    if (type === "address") setShowAddressModal(true);
    if (type === "edit-customer") setEditCustomerModal(true);
  };

  const closeModalSafely = () => {
    if (window.location.hash || window.history.state?.modal) {
      window.history.back();
    } else {
      setImportContactsModal(false);
      setManualAddModal(false);
      setUnsupportedModal(false);
      setShowAddressModal(false);
      setEditCustomerModal(false);
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
      if (error.name !== "AbortError") {
        console.error(error);
        alert("연락처를 가져오지 못했습니다: " + error.message);
      }
    }
  };

  // 2. vcf 파일 업로드 파싱
  const handleVcfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const contacts = parseVCard(text);
      if (contacts.length === 0) {
        alert("연락처 파일에서 유효한 전화번호를 찾지 못했습니다.");
        return;
      }
      setContactsToImport(contacts);
      openModalSafely("import");
    } catch (error: any) {
      console.error(error);
      alert("연락처 파일 읽기 오류: " + error.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 연락처 전체 선택 / 해제 토글
  const toggleSelectAllContacts = () => {
    const allSelected = contactsToImport.every((c) => c.selected);
    setContactsToImport((prev) =>
      prev.map((c) => ({ ...c, selected: !allSelected }))
    );
  };

  // 연락처 개별 선택 토글
  const toggleContactSelect = (index: number) => {
    setContactsToImport((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, selected: !c.selected } : c))
    );
  };

  // 선택한 연락처 일괄 저장
  const handleSaveSelectedContacts = async () => {
    const selected = contactsToImport.filter((c) => c.selected);
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
        phone2: manualPhone2.trim() ? formatKoreanPhone(manualPhone2.trim()) : undefined,
        address: manualAddress.trim(),
        address_detail: manualAddressDetail.trim(),
        memo: manualMemo.trim(),
      });

      alert("고객 정보가 성공적으로 저장되었습니다.");
      setManualName("");
      setManualPhone("");
      setManualPhone2("");
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

  // 고객 정보 수정 열기
  const handleOpenEditCustomer = () => {
    if (!customerDetail?.customer) return;
    const c = customerDetail.customer;
    setEditCustomerCode(c.customer_code || "");
    setEditName(c.name || "");
    setEditPhone(c.phone || "");
    setEditPhone2(c.phone2 || "");
    setEditAddress(c.address || "");
    setEditAddressDetail(c.address_detail || "");
    setEditMemo(c.memo || "");
    openModalSafely("edit-customer");
  };

  // 고객 정보 수정 저장
  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    if (!editName.trim() || !editPhone.trim()) {
      alert("고객 이름과 연락처는 필수입니다.");
      return;
    }

    setIsSavingCustomer(true);
    try {
      await updateCustomerService({
        id: selectedCustomerId,
        customer_code: editCustomerCode.trim() || undefined,
        name: editName.trim(),
        phone: formatKoreanPhone(editPhone.trim()),
        phone2: editPhone2.trim() ? formatKoreanPhone(editPhone2.trim()) : undefined,
        address: editAddress.trim(),
        address_detail: editAddressDetail.trim(),
        memo: editMemo.trim(),
      });

      alert("고객 정보가 성공적으로 수정되었습니다.");
      closeModalSafely();
      await loadCustomerDetail(selectedCustomerId);
      await fetchCustomers(query);
    } catch (err: any) {
      console.error(err);
      alert("고객 정보 수정 실패: " + err.message);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // 신규 배송지 등록 모달 열기
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressAlias("서울 딸네");
    setAddressRecipientName("");
    setAddressRecipientPhone("");
    setAddressRecipientPhone2("");
    setAddressLine("");
    setAddressDetailLine("");
    setAddressMemo("");
    openModalSafely("address");
  };

  // 배송지 수정 모달 열기
  const handleOpenEditAddress = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setAddressAlias(addr.alias || "배송지");
    setAddressRecipientName(addr.recipient_name || "");
    setAddressRecipientPhone(addr.recipient_phone || "");
    setAddressRecipientPhone2(addr.recipient_phone2 || "");
    setAddressLine(addr.address || "");
    setAddressDetailLine(addr.address_detail || "");
    setAddressMemo(addr.delivery_memo || "");
    openModalSafely("address");
  };

  // 배송지(수령인) 추가 또는 수정 저장
  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    if (!addressRecipientName.trim() || !addressLine.trim()) {
      alert("받는 분 성함과 주소를 입력해주세요.");
      return;
    }

    setIsAddingAddress(true);
    try {
      if (editingAddressId) {
        // 수정
        await updateCustomerAddressService({
          id: editingAddressId,
          customer_id: selectedCustomerId,
          alias: addressAlias.trim() || "배송지",
          recipient_name: addressRecipientName.trim(),
          recipient_phone: addressRecipientPhone.trim() ? formatKoreanPhone(addressRecipientPhone.trim()) : "",
          recipient_phone2: addressRecipientPhone2.trim() ? formatKoreanPhone(addressRecipientPhone2.trim()) : "",
          address: addressLine.trim(),
          address_detail: addressDetailLine.trim(),
          delivery_memo: addressMemo.trim(),
        });
        alert("배송지가 성공적으로 수정되었습니다.");
      } else {
        // 신규 추가
        await addCustomerAddressService({
          customer_id: selectedCustomerId,
          alias: addressAlias.trim() || "배송지",
          recipient_name: addressRecipientName.trim(),
          recipient_phone: addressRecipientPhone.trim() ? formatKoreanPhone(addressRecipientPhone.trim()) : (customerDetail?.customer?.phone || ""),
          recipient_phone2: addressRecipientPhone2.trim() ? formatKoreanPhone(addressRecipientPhone2.trim()) : undefined,
          address: addressLine.trim(),
          address_detail: addressDetailLine.trim(),
          delivery_memo: addressMemo.trim(),
        });
        alert("배송지가 성공적으로 추가되었습니다.");
      }

      setEditingAddressId(null);
      closeModalSafely();
      await loadCustomerDetail(selectedCustomerId);
      await fetchCustomers(query);
    } catch (err: any) {
      alert("배송지 저장 실패: " + err.message);
    } finally {
      setIsAddingAddress(false);
    }
  };

  // 배송지 삭제
  const handleDeleteAddress = async (addressId: number, alias: string) => {
    if (!confirm(`'${alias}' 배송지를 삭제하시겠습니까?`)) return;
    try {
      await deleteCustomerAddressService(addressId);
      if (selectedCustomerId) {
        await loadCustomerDetail(selectedCustomerId);
      }
    } catch (err: any) {
      alert("배송지 삭제 실패: " + err.message);
    }
  };

  // 고객 등급 계산 함수 (이모지 없음, 단정함)
  const getCustomerGradeBadge = (c: any) => {
    const orderCount = Number(c.order_count || 0);
    const totalSpent = Number(c.total_spent || 0);
    if (orderCount >= 3 || totalSpent >= 300000) {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-800 text-white whitespace-nowrap">
          [VIP단골]
        </span>
      );
    }
    if (orderCount >= 2) {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
          [우수단골]
        </span>
      );
    }
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
        [일반고객]
      </span>
    );
  };

  // 등급 필터링
  const filteredCustomers = customers.filter((c) => {
    if (gradeFilter === "ALL") return true;
    const orderCount = Number(c.order_count || 0);
    const totalSpent = Number(c.total_spent || 0);
    if (gradeFilter === "VIP") return orderCount >= 3 || totalSpent >= 300000;
    if (gradeFilter === "REGULAR") return orderCount >= 2 && !(orderCount >= 3 || totalSpent >= 300000);
    if (gradeFilter === "NEW") return orderCount <= 1;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-20">
      {/* 숨겨진 vcf 파일 업로드 input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleVcfFileUpload}
        accept=".vcf,text/vcard"
        className="hidden"
      />

      {/* 상단 검색 & 액션 바 */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border-2 border-slate-300 shadow-xs space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="고객명, 만단위코드(10001), 전화번호, 등록 배송지 수령인 검색"
              className="w-full text-base font-bold border-2 border-slate-300 rounded-xl pl-10 pr-4 py-2.5 focus:border-emerald-600 focus:outline-hidden bg-white text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="btn-large px-6 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            검색
          </button>
        </form>

        {/* 연락처 연동 및 추가 버튼 모음 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePickPhoneContacts}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-sm font-bold shadow-xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <Smartphone className="w-4 h-4" />
              <span>핸드폰 연락처 가져오기</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-300 px-3.5 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4 text-slate-600" />
              <span>연락처 파일(.vcf) 불러오기</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => openModalSafely("manual")}
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-2 border-emerald-500 px-3.5 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ml-auto"
          >
            <UserPlus className="w-4 h-4 text-emerald-700" />
            <span>+ 직접 고객 등록</span>
          </button>
        </div>
      </div>

      {/* 2열 메인 그리드: 고객 목록 & 우측 상세 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 등록된 단골 고객 목록 */}
        <div className="md:col-span-2 bg-white rounded-2xl border-2 border-slate-300 p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>고객 목록 ({filteredCustomers.length}명)</span>
            </h2>

            {/* 등급 필터 탭 */}
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden text-xs font-bold whitespace-nowrap">
              <button
                type="button"
                onClick={() => setGradeFilter("ALL")}
                className={`px-2.5 py-1 transition-colors ${
                  gradeFilter === "ALL" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setGradeFilter("VIP")}
                className={`px-2.5 py-1 border-l border-slate-200 transition-colors ${
                  gradeFilter === "VIP" ? "bg-emerald-800 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                VIP단골
              </button>
              <button
                type="button"
                onClick={() => setGradeFilter("REGULAR")}
                className={`px-2.5 py-1 border-l border-slate-200 transition-colors ${
                  gradeFilter === "REGULAR" ? "bg-emerald-100 text-emerald-900" : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                우수단골
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm font-bold text-slate-600">
              불러오는 중...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <p className="text-base font-bold text-slate-700">
                {query ? "일치하는 고객 정보가 없습니다." : "등록된 고객이 없습니다."}
              </p>
              <p className="text-xs text-slate-500">
                상단의 [핸드폰 연락처 가져오기] 또는 [+ 직접 고객 등록]을 이용해 고객을 추가하세요.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto pr-1">
              {filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  onClick={() => loadCustomerDetail(c.id)}
                  className={`py-3.5 px-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedCustomerId === c.id ? "bg-emerald-50 border-2 border-emerald-500" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 만 단위 숫자 코드 뱃지 */}
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 whitespace-nowrap shrink-0">
                        #{c.customer_code || c.id}
                      </span>
                      {getCustomerGradeBadge(c)}
                      <span className="text-base font-black text-slate-900 mr-1 whitespace-nowrap">
                        {c.name}
                      </span>
                      <span className="text-sm font-bold text-slate-700 whitespace-nowrap">
                        {c.phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                      <a
                        href={`tel:${c.phone.replace(/[^0-9]/g, "")}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap shrink-0"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>전화</span>
                      </a>
                      <a
                        href={`sms:${c.phone.replace(/[^0-9]/g, "")}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap shrink-0"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>문자</span>
                      </a>
                    </div>
                  </div>

                  {/* 대표 기본 주소 */}
                  <div className="text-xs text-slate-700 mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {c.address ? `${c.address} ${c.address_detail || ""}` : "등록된 기본 주소 없음"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                    <span>총 {c.order_count || 0}회 주문</span>
                    {Number(c.address_count || 0) > 1 && (
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                        등록 배송지: {c.address_count}곳
                      </span>
                    )}
                    {c.last_order_date && <span>최근: {c.last_order_date}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우측: 고객 상세 정보 및 다중 배송지 관리 */}
        <div className="bg-white rounded-2xl border-2 border-slate-300 p-5 shadow-xs">
          <h3 className="text-base font-black text-slate-900 border-b border-slate-200 pb-2.5 mb-3 flex items-center justify-between">
            <span>고객 상세 정보</span>
            {selectedCustomerId && (
              <span className="text-xs text-slate-500 font-bold">
                고객코드 #{customerDetail?.customer?.customer_code || selectedCustomerId}
              </span>
            )}
          </h3>

          {!customerDetail ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              왼쪽 목록에서 고객을 선택하면 상세 정보와 배송지 목록이 표시됩니다.
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {/* 고객 기본 프로필 카드 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>{customerDetail.customer.name} 님</span>
                    {getCustomerGradeBadge(customerDetail.customer)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      #{customerDetail.customer.customer_code}
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenEditCustomer}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-emerald-800 bg-white hover:bg-slate-100 border border-slate-300 px-2 py-0.5 rounded cursor-pointer whitespace-nowrap"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>정보수정</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                    <span>연락처1(대표): {customerDetail.customer.phone}</span>
                    {customerDetail.customer.phone2 && (
                      <span className="text-xs bg-slate-200 text-slate-800 font-bold px-1.5 py-0.5 rounded">
                        연락처2: {customerDetail.customer.phone2}
                      </span>
                    )}
                  </div>
                  {customerDetail.customer.address && (
                    <div className="text-xs text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{customerDetail.customer.address} {customerDetail.customer.address_detail || ""}</span>
                    </div>
                  )}
                </div>

                {customerDetail.customer.memo && (
                  <div className="text-xs bg-white p-2 rounded border border-slate-300 text-slate-700">
                    [메모] {customerDetail.customer.memo}
                  </div>
                )}
              </div>

              {/* 다중 배송지 주소록 섹션 */}
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Bookmark className="w-4 h-4 text-emerald-700" />
                    <span>등록 배송지 ({customerDetail.addresses?.length || 0}곳)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddAddress}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded cursor-pointer whitespace-nowrap"
                  >
                    + 배송지 추가
                  </button>
                </div>

                {(!customerDetail.addresses || customerDetail.addresses.length === 0) ? (
                  <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-300 rounded-lg">
                    등록된 추가 배송지가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
                    {customerDetail.addresses.map((addr: CustomerAddress) => (
                      <div
                        key={addr.id}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-1 relative"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded">
                            [{addr.alias || "배송지"}]
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAddress(addr)}
                              className="text-slate-500 hover:text-emerald-800 cursor-pointer p-0.5 text-xs font-bold flex items-center gap-0.5"
                              title="배송지 수정"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>수정</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id, addr.alias)}
                              className="text-slate-400 hover:text-red-600 cursor-pointer p-0.5"
                              title="배송지 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          <span>수령인: {addr.recipient_name} ({addr.recipient_phone})</span>
                          {addr.recipient_phone2 && (
                            <span className="text-[11px] bg-slate-200 text-slate-700 px-1 rounded">
                              추가: {addr.recipient_phone2}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600">
                          {addr.address} {addr.address_detail || ""}
                        </div>
                        {addr.delivery_memo && (
                          <div className="text-[11px] text-slate-500">
                            [요청] {addr.delivery_memo}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 과거 주문 이력 내역 */}
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <div className="text-sm font-black text-slate-900">
                  주문 기록 ({customerDetail.orders?.length || 0}건)
                </div>

                {customerDetail.orders?.length === 0 ? (
                  <div className="text-xs text-slate-400 py-3 text-center">주문 기록이 없습니다.</div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
                    {customerDetail.orders.map((ord: any) => (
                      <div
                        key={ord.id}
                        className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-xs space-y-1"
                      >
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>출고일: {ord.shipping_date}</span>
                          <span className="text-emerald-800 font-black">
                            {formatPrice(ord.total_amount)}원
                          </span>
                        </div>
                        <div className="text-slate-500">
                          주문번호: #{ord.order_no}
                        </div>
                        <div className="flex justify-between font-bold pt-0.5">
                          <span className={ord.payment_status === "PAID" ? "text-emerald-800" : "text-slate-600"}>
                            {ord.payment_status === "PAID" ? "입금완료" : "미입금"}
                          </span>
                          <span className="text-slate-700">
                            {ord.order_status === "SHIPPED"
                              ? "발송완료"
                              : ord.order_status === "PACKED"
                              ? "포장완료"
                              : "접수완료"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 모달 1: 가져온 연락처 확인 및 일괄 등록 팝업 */}
      {importContactsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl border-2 border-slate-300">
            <div className="bg-slate-900 text-white p-4 rounded-t-xl flex items-center justify-between">
              <h3 className="text-base font-bold">
                연락처 등록 확인 ({contactsToImport.length}명)
              </h3>
              <button
                type="button"
                onClick={closeModalSafely}
                className="text-white hover:bg-slate-800 p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={toggleSelectAllContacts}
                className="inline-flex items-center gap-1 font-bold text-slate-800 cursor-pointer"
              >
                {contactsToImport.every((c) => c.selected) ? (
                  <CheckSquare className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>전체 선택 / 해제</span>
              </button>
              <span className="font-bold text-emerald-800">
                선택됨: {contactsToImport.filter((c) => c.selected).length}명
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-200 text-xs">
              {contactsToImport.map((contact, index) => (
                <div
                  key={index}
                  onClick={() => toggleContactSelect(index)}
                  className={`py-2 px-2 flex items-center justify-between cursor-pointer rounded ${
                    contact.selected ? "bg-emerald-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {contact.selected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold text-slate-900 mr-2">{contact.name}</span>
                      <span className="text-slate-600">{contact.phone}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModalSafely}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveSelectedContacts}
                disabled={isImporting}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-bold cursor-pointer"
              >
                {isImporting ? "등록 중..." : "선택 고객 등록하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 2: 직접 고객 등록 모달 */}
      {manualAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border-2 border-slate-300 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 rounded-t-xl flex items-center justify-between">
              <h3 className="text-base font-bold">신규 고객 직접 등록</h3>
              <button
                type="button"
                onClick={closeModalSafely}
                className="text-white hover:bg-slate-800 p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualCustomer} className="p-4 space-y-3 overflow-y-auto flex-1 text-sm">
              <div className="bg-slate-100 p-2.5 rounded text-xs text-slate-700 font-medium">
                [안내] 등록 시 성씨 초성에 따라 <strong>만단위 고객코드(예: 김씨는 10001, 박씨는 60001)</strong>가 자동 발급됩니다.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  고객 성함 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    대표 연락처 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="예: 010-1234-5678"
                    className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    추가 연락처 (집/가족)
                  </label>
                  <input
                    type="tel"
                    value={manualPhone2}
                    onChange={(e) => setManualPhone2(e.target.value)}
                    placeholder="예: 063-640-0000"
                    className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  기본 배송 주소
                </label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="기본 도로명/지번 주소"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  상세 주소
                </label>
                <input
                  type="text"
                  value={manualAddressDetail}
                  onChange={(e) => setManualAddressDetail(e.target.value)}
                  placeholder="동/호수 등 상세 주소"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  특이사항 및 메모
                </label>
                <input
                  type="text"
                  value={manualMemo}
                  onChange={(e) => setManualMemo(e.target.value)}
                  placeholder="예: 양념세트 선호, 문앞 보관"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={closeModalSafely}
                  className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold cursor-pointer"
                >
                  {isImporting ? "등록 중..." : "고객 등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달 3: 배송지(수령인) 추가/수정 모달 */}
      {showAddressModal && selectedCustomerId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border-2 border-slate-300 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 rounded-t-xl flex items-center justify-between">
              <h3 className="text-base font-bold">
                {customerDetail?.customer?.name} 님의 {editingAddressId ? "배송지 정보 수정" : "추가 배송지 등록"}
              </h3>
              <button
                type="button"
                onClick={closeModalSafely}
                className="text-white hover:bg-slate-800 p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewAddress} className="p-4 space-y-3 overflow-y-auto flex-1 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  배송지 별칭 (관계) <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-1.5 mb-1.5 flex-wrap">
                  {["서울 딸네", "부산 아들네", "시댁", "친정", "자택"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setAddressAlias(tag)}
                      className={`text-xs px-2 py-1 rounded border font-bold cursor-pointer ${
                        addressAlias === tag
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={addressAlias}
                  onChange={(e) => setAddressAlias(e.target.value)}
                  placeholder="예: 서울 딸네, 시댁, 친정 등"
                  className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  받는 분 성함 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={addressRecipientName}
                  onChange={(e) => setAddressRecipientName(e.target.value)}
                  placeholder="수령인 성함 (예: 김딸, 박아들)"
                  className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    받는 분 연락처 1
                  </label>
                  <input
                    type="tel"
                    value={addressRecipientPhone}
                    onChange={(e) => setAddressRecipientPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    받는 분 연락처 2 (선택)
                  </label>
                  <input
                    type="tel"
                    value={addressRecipientPhone2}
                    onChange={(e) => setAddressRecipientPhone2(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  배송 주소 <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="도로명 또는 지번 주소"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  상세 주소
                </label>
                <input
                  type="text"
                  value={addressDetailLine}
                  onChange={(e) => setAddressDetailLine(e.target.value)}
                  placeholder="동/호수 등 상세 주소"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  배송 시 요청사항
                </label>
                <input
                  type="text"
                  value={addressMemo}
                  onChange={(e) => setAddressMemo(e.target.value)}
                  placeholder="예: 경비실 보관, 문 앞"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={closeModalSafely}
                  className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isAddingAddress}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold cursor-pointer"
                >
                  {isAddingAddress ? "저장 중..." : "배송지 저장하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 고객 정보 수정 모달 */}
      {editCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border-2 border-slate-300 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 rounded-t-xl flex items-center justify-between">
              <h3 className="text-base font-bold">
                고객 정보 수정 (#{editCustomerCode})
              </h3>
              <button
                type="button"
                onClick={closeModalSafely}
                className="text-white hover:bg-slate-800 p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="p-4 space-y-3 overflow-y-auto flex-1 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    고객 성함 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="고객 성함"
                    className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    고객 코드
                  </label>
                  <input
                    type="text"
                    value={editCustomerCode}
                    onChange={(e) => setEditCustomerCode(e.target.value)}
                    placeholder="예: 10001"
                    className="w-full font-mono font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    대표 연락처 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    추가 연락처 (집/가족)
                  </label>
                  <input
                    type="tel"
                    value={editPhone2}
                    onChange={(e) => setEditPhone2(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full font-bold border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  기본 배송 주소
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="도로명 또는 지번 주소"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  상세 주소
                </label>
                <input
                  type="text"
                  value={editAddressDetail}
                  onChange={(e) => setEditAddressDetail(e.target.value)}
                  placeholder="동/호수 등 상세 주소"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  특이사항 및 메모
                </label>
                <input
                  type="text"
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  placeholder="고객 특이사항 메모"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={closeModalSafely}
                  className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold cursor-pointer"
                >
                  {isSavingCustomer ? "저장 중..." : "수정 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 미지원 브라우저 안내 모달 */}
      {unsupportedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border-2 border-slate-300 p-5 space-y-3 text-sm">
            <h3 className="text-base font-bold text-slate-900 border-b pb-2">
              주소록 직접 호출 안내
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              현재 브라우저에서는 스마트폰 주소록 직접 호출이 제한되어 있습니다. 연락처 앱에서 <strong>[연락처 내보내기/공유]</strong>로 .vcf 파일을 생성하여 불러오시거나 직접 등록을 이용해주세요.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  closeModalSafely();
                  fileInputRef.current?.click();
                }}
                className="flex-1 py-2 bg-emerald-700 text-white font-bold rounded-lg text-xs"
              >
                .vcf 파일 불러오기
              </button>
              <button
                type="button"
                onClick={() => {
                  closeModalSafely();
                  openModalSafely("manual");
                }}
                className="flex-1 py-2 bg-slate-200 text-slate-800 font-bold rounded-lg text-xs"
              >
                직접 입력하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
