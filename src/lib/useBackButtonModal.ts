"use client";

import { useEffect, useRef } from "react";

/**
 * 모바일 뒤로가기(하드웨어 백 버튼) 시 모달/팝업을 닫도록 하는 훅
 * - 모달이 열리면 window.history에 더미 상태를 push
 * - 모바일에서 뒤로가기 버튼을 누르면 popstate를 가로채 모달만 닫음 (프로그램 종료 방지)
 * - 사용자가 화면의 'X'나 '닫기' 버튼으로 닫을 경우 push했던 히스토리를 깔끔하게 정리
 */
export function useBackButtonModal(
  isOpen: boolean,
  onClose: () => void,
  modalId: string
) {
  const isBackTriggeredRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    isBackTriggeredRef.current = false;

    // 모달 전용 히스토리 상태 push
    if (typeof window !== "undefined") {
      window.history.pushState({ isModal: true, modalId }, "");
    }

    const handlePopState = (e: PopStateEvent) => {
      // 뒤로가기 버튼을 눌렀을 때
      isBackTriggeredRef.current = true;
      onClose();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      // 만약 뒤로가기 버튼이 아닌 화면 상의 [닫기]/[X] 버튼으로 닫힌 경우,
      // push했던 더미 히스토리를 되돌림
      if (
        !isBackTriggeredRef.current &&
        typeof window !== "undefined" &&
        window.history.state?.isModal &&
        window.history.state?.modalId === modalId
      ) {
        window.history.back();
      }
    };
  }, [isOpen, onClose, modalId]);
}
