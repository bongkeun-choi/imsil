"use client";

import { useEffect, useRef } from "react";

/**
 * 모바일 뒤로가기(하드웨어 백 버튼) 시 모달/팝업을 닫도록 하는 훅
 * - 모달이 열리면 window.history에 더미 상태를 push
 * - 모바일에서 뒤로가기 버튼을 누르면 popstate를 가로채 모달만 닫음 (프로그램 종료 방지)
 * - React 18/StrictMode 마운트-언마운트 사이클에서 cleanup 내 history.back()으로 인해
 *   모달이 뜨자마자 꺼지는 현상을 근본적으로 차단하기 위해:
 *   1) cleanup에서는 오직 이벤트 리스너만 해제
 *   2) isOpen이 false로 변경될 때(사용자가 화면 닫기 버튼 등으로 닫았을 때)만 history.back() 정리
 */
export function useBackButtonModal(
  isOpen: boolean,
  onClose: () => void,
  modalId: string
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isPushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      // 모달이 닫힌 상태 (isOpen === false)
      // 만약 사용자가 화면의 [닫기]/[X] 버튼 등으로 모달을 닫았다면(isPushedRef가 아직 true라면)
      // 히스토리 스택에 남아있는 더미 상태를 1단계 되돌림
      if (isPushedRef.current && typeof window !== "undefined") {
        if (
          window.history.state?.isModal &&
          window.history.state?.modalId === modalId
        ) {
          isPushedRef.current = false;
          window.history.back();
        }
      }
      isPushedRef.current = false;
      return;
    }

    // 모달이 열린 상태 (isOpen === true)
    // 히스토리 상태를 아직 push하지 않았다면 1회만 push
    if (!isPushedRef.current && typeof window !== "undefined") {
      window.history.pushState({ isModal: true, modalId }, "");
      isPushedRef.current = true;
    }

    const handlePopState = () => {
      // 모바일 뒤로가기 또는 브라우저 백버튼을 누른 경우:
      // 이미 히스토리는 1단계 뒤로 갔으므로 isPushedRef를 false로 설정하고 onClose 호출
      if (isPushedRef.current) {
        isPushedRef.current = false;
        onCloseRef.current();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      // cleanup에서는 절대로 window.history.back()을 호출하지 않음!
      // 오직 이벤트 리스너만 해제하여 React 리렌더링 시 비동기 popstate 반사파로 모달이 꺼지는 버그를 원천 방지
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isOpen, modalId]);
}
