"use client";

import { useRouter } from "next/navigation";

export default function Welcome() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white px-4">
      {/* 상단 상태 안내 */}
      <div className="flex flex-col items-center mb-12">
        <div className="text-7xl mb-4">🟢</div>
        <h1 className="text-3xl font-bold mb-2">지금은 안전해요!</h1>
        <p className="text-lg text-slate-300">시스템에 문제가 없습니다.</p>
      </div>

      {/* 상태 확인 버튼 */}
      <button
        className="btn btn-primary text-2xl px-10 py-5 mb-10"
        onClick={() => router.push("/dashboard")}
      >
        상태 확인하기
      </button>

      {/* 안내 문구 */}
      <div className="mb-16 text-center text-slate-400 text-lg">
        문제가 생기면 자동으로 알려드려요.
        <br />
        걱정하지 마세요!
      </div>

      {/* 도움말 버튼 */}
      <button
        className="btn text-lg flex items-center gap-2 border border-slate-600 px-6 py-3"
        onClick={() => alert("도움말 페이지는 준비 중입니다!")}
      >
        <span className="text-2xl">❓</span> 도움이 필요하신가요? 여기를
        눌러주세요!
      </button>
    </div>
  );
}
