"use client";

import React, { useState } from "react";
import { saveTursoConfig, getClientDb, initClientTables } from "@/lib/clientDb";
import { Database, Key, CheckCircle, AlertCircle } from "lucide-react";

interface TursoConfigModalProps {
  isOpen: boolean;
  onConfigSaved: () => void;
  onClose?: () => void;
}

export function TursoConfigModal({
  isOpen,
  onConfigSaved,
  onClose,
}: TursoConfigModalProps) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !token.trim()) {
      setError("Turso Database URL과 Auth Token을 모두 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      saveTursoConfig({ url: url.trim(), authToken: token.trim() });
      const db = getClientDb();
      if (!db) throw new Error("DB 클라이언트를 생성할 수 없습니다.");

      // 테이블 자동 초기화 및 연결 테스트
      await initClientTables(db);
      alert("Turso 데이터베이스가 성공적으로 연결되었습니다!");
      onConfigSaved();
    } catch (err: any) {
      console.error(err);
      setError(`연결 실패: ${err.message || "URL 또는 토큰을 확인해 주세요."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-2xl border-2 border-slate-300 p-6 md:p-8 shadow-2xl space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-emerald-800 mb-1">
            <Database className="w-6 h-6" />
            <span className="text-sm font-bold">GitHub Pages 직접 연결</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">
            Turso 데이터베이스 연결 설정
          </h2>
          <p className="text-base text-slate-600 mt-2">
            본 프로그램은 개인 정보를 서버에 저장하지 않고, <strong>사용자 개인의 Turso DB</strong>에 브라우저가 직접 안전하게 보관합니다.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-900 font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-lg font-bold text-slate-900 mb-1">
              Turso Database URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="예: libsql://imsil-xxx.turso.io"
              className="w-full text-base font-bold border-2 border-slate-300 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-lg font-bold text-slate-900 mb-1">
              Turso Auth Token
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Turso에서 발급받은 인증 토큰을 붙여넣으세요"
              rows={3}
              className="w-full text-sm font-mono border-2 border-slate-300 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              required
            />
          </div>

          <div className="text-xs text-slate-500 bg-slate-100 p-3 rounded-lg">
            * 입력하신 정보는 이 스마트폰/PC의 브라우저 로컬 저장소에만 안전하게 보관되며 GitHub이나 외부 서버로 절대 전송되지 않습니다.
          </div>

          <div className="flex gap-3 pt-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="btn-large flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer"
              >
                닫기
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-large flex-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black cursor-pointer shadow-md transition-colors"
            >
              {loading ? "연결 확인 중..." : "저장 및 시작하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
