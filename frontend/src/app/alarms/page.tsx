"use client";

import React, { useState, useEffect, Suspense } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSSE } from "@/contexts/SSEContext";
import { useAuth } from "@/context/AuthContext";

interface Alarm {
  trace_id: string;
  detected_at: number | string;
  summary: string;
  host: string;
  os: string;
  checked: boolean;
  sigma_alert?: string;
  matched_span_count?: number;
  ai_summary?: string;
  severity?: string;
  severity_score?: number;
  sigma_rule_title?: string;
  isUpdated?: boolean;
  ai_score?: number;
  ai_decision?: string;
}

function timeAgo(dateNum: number) {
  if (!dateNum) return "-";
  const now = Date.now();
  const diff = Math.floor((now - dateNum) / 1000);

  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;

  return `${Math.floor(diff / 86400)}일 전`;
}

function AlarmsContent() {
  const {
    alarms,
    sseConnected: wsConnected,
    sseError: wsError,
    updateAlarm,
  } = useSSE();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
    "status" | "trace_id" | "summary" | "detected_at"
  >("detected_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(alarms.length);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();

  const [severityFilters, setSeverityFilters] = useState<string[]>([]);
  const [aiDecisionFilter, setAiDecisionFilter] = useState("all");
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setTotal(alarms.length);
  }, [alarms.length]);

  // trace_id 쿼리 파라미터 처리
  useEffect(() => {
    const traceId = searchParams.get("trace_id");
    if (traceId) {
      setSearch(traceId);
    }
  }, [searchParams]);

  function sortAlarms(list: Alarm[]) {
    return [...list].sort((a, b) => {
      let v1: string | number = "",
        v2: string | number = "";
      if (sortBy === "status") {
        v1 = a.checked ? 1 : 0;
        v2 = b.checked ? 1 : 0;
      } else if (sortBy === "trace_id") {
        v1 = a.trace_id || "";
        v2 = b.trace_id || "";
      } else if (sortBy === "summary") {
        v1 = a.summary || "";
        v2 = b.summary || "";
      } else if (sortBy === "detected_at") {
        v1 = a.detected_at || "";
        v2 = b.detected_at || "";
      }
      if (v1 < v2) return sortDir === "asc" ? -1 : 1;
      if (v1 > v2) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  const filteredAlarms = sortAlarms(
    alarms.filter((alarm) => {
      const traceId = alarm.trace_id || "";
      const summary = alarm.summary || "";

      const matchSearch =
        traceId.toLowerCase().includes(search.toLowerCase()) ||
        summary.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "checked" && alarm.checked) ||
        (statusFilter === "unchecked" && !alarm.checked);

      const matchSeverity =
        severityFilters.length === 0 ||
        severityFilters.includes(alarm.severity || "low");

      const matchAiDecision =
        aiDecisionFilter === "all" ||
        (aiDecisionFilter === "malicious" &&
          alarm.ai_decision === "malicious") ||
        (aiDecisionFilter === "benign" && alarm.ai_decision === "benign");

      return matchSearch && matchStatus && matchSeverity && matchAiDecision;
    })
  );

  const handleCheck = async (trace_id: string) => {
    try {
      const currentAlarm = alarms.find((alarm) => alarm.trace_id === trace_id);
      const newCheckedStatus = !currentAlarm?.checked;

      const { fetchWithAuth } = await import("@/lib/api");
      const response = await fetchWithAuth("/api/alarms/check", {
        method: "POST",
        body: JSON.stringify({
          trace_id: trace_id?.replace(/[<>]/g, ""), // XSS 방지를 위한 필터링
          checked: newCheckedStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("상태 업데이트 실패");
      }
      updateAlarm(trace_id, { checked: newCheckedStatus });
    } catch (error) {
      // console.error("알림 상태 업데이트 실패:", error);
      alert("알림 상태 업데이트에 실패했습니다.");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSeverityFilters([]);
    setAiDecisionFilter("all");
    setDateRange({ startDate: "", endDate: "" });
  };

  const toggleSeverityFilter = (severity: string) => {
    setSeverityFilters((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity]
    );
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <DashboardLayout onLogout={handleLogout}>
      <div className="max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 backdrop-blur-md border border-blue-500/30 rounded-lg p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white font-sans mb-2">
                보안 알림 센터
              </h1>
              <p className="text-white text-sm md:text-base font-sans">
                의심스러운 활동을 발견했을 때 단계별로 어떤 일이 일어났는지
                보여드립니다
              </p>
            </div>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-200 hover:bg-blue-500/30 transition-colors font-sans text-sm"
            >
              {showGuide ? "가이드 접기" : "가이드 보기"}
            </button>
          </div>
        </motion.div>

        {/* 초보자 가이드 */}
        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden mb-6"
            >
              <div className="p-6">
                <h2 className="text-lg font-bold text-cyan-400 mb-4">
                  라벨링 설명
                </h2>
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full border text-xs font-medium bg-red-600/10 text-red-300 border-red-600/30">
                      critical
                    </span>
                    <span className="px-3 py-1 rounded-full border text-xs font-medium bg-red-500/10 text-red-400 border-red-500/30">
                      high
                    </span>
                    <span className="px-3 py-1 rounded-full border text-xs font-medium bg-orange-500/10 text-orange-400 border-orange-500/30">
                      medium
                    </span>
                    <span className="px-3 py-1 rounded-full border text-xs font-medium bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                      low
                    </span>
                  </div>
                  <span className="text-sm text-slate-400">
                    시그마 룰 매칭 평균 위험도
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                    <span className="px-3 py-1 rounded-full border text-xs font-medium bg-blue-500/10 text-blue-400 border-blue-500/30">
                      86.1%
                    </span>
                    <span className="text-sm text-slate-400">
                      AI가 분석한 악성 점수 (0-100%)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full border text-xs font-medium bg-red-600/10 text-red-300 border-red-600/30">
                        악성
                      </span>
                      <span className="px-3 py-1 rounded-full border text-xs font-medium bg-green-500/10 text-green-400 border-green-500/30">
                        정상
                      </span>
                    </div>
                    <span className="text-sm text-slate-400">
                      AI의 최종 판정 (악성/정상)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                    <span className="px-3 py-1 rounded-full border text-xs font-medium bg-slate-500/10 text-slate-400 border-slate-500/30">
                      3개
                    </span>
                    <span className="text-sm text-slate-400">
                      매칭된 보안 규칙의 개수
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-slate-400 text-sm font-mono">
                총 {total}개 알람{" "}
                {filteredAlarms.length !== alarms.length &&
                  `(필터링됨: ${filteredAlarms.length}개)`}
              </div>

              {/* SSE 연결 상태 표시 */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    wsConnected ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>
                <span className="text-xs font-mono text-slate-400">
                  {wsConnected ? "실시간 연결됨" : "실시간 연결 끊김"}
                </span>
                {wsError && (
                  <span className="text-xs font-mono text-red-400">
                    ({wsError})
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-row gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Trace ID, 요약으로 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-80"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* 메인 콘텐츠 */}
          <div className="flex-1">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-6">
              {loading ? (
                <div className="text-center text-slate-400 py-10 text-lg font-mono">
                  알람 데이터를 불러오는 중...
                </div>
              ) : error ? (
                <div className="text-center text-red-400 py-10 text-lg font-mono">
                  {error}
                </div>
              ) : filteredAlarms.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-lg font-mono">
                  알람이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredAlarms.map((alarm, idx) => (
                    <motion.div
                      key={`${alarm.trace_id}-${alarm.detected_at}-${idx}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: alarm.isUpdated ? 1.02 : 1,
                        borderColor: alarm.isUpdated
                          ? "rgb(59 130 246)"
                          : "rgb(51 65 85)",
                      }}
                      transition={{
                        delay: idx * 0.1,
                        duration: alarm.isUpdated ? 0.3 : 0.2,
                      }}
                      className={`rounded-lg p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/50 ${
                        alarm.isUpdated
                          ? "bg-blue-900/20 border-2 border-blue-500/50 shadow-lg shadow-blue-500/20"
                          : "bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600/50"
                      }`}
                      onClick={() => router.push(`/alarms/${alarm.trace_id}`)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      layout
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-slate-100 mb-2">
                            {alarm.sigma_rule_title ? (
                              <>
                                {alarm.sigma_rule_title}
                                <span className="text-sm font-normal text-slate-400">
                                  {" "}
                                  ({alarm.trace_id})
                                </span>
                              </>
                            ) : (
                              alarm.summary
                            )}
                          </h3>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 rounded-full border text-xs font-medium select-none cursor-pointer ${
                                alarm.checked
                                  ? "bg-green-500/10 text-green-400 border-green-500/30"
                                  : "bg-red-500/10 text-red-400 border-red-500/30"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheck(alarm.trace_id);
                              }}
                            >
                              {alarm.checked ? "확인됨" : "미확인"}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full border text-xs font-medium ${
                                alarm.severity === "critical"
                                  ? "bg-red-600/10 text-red-300 border-red-600/30"
                                  : alarm.severity === "high"
                                  ? "bg-red-500/10 text-red-400 border-red-500/30"
                                  : alarm.severity === "medium"
                                  ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                              }`}
                            >
                              {alarm.severity || "low"}
                            </span>
                            {alarm.ai_score !== undefined && (
                              <span className="px-3 py-1 rounded-full border text-xs font-medium bg-blue-500/10 text-blue-400 border-blue-500/30">
                                {(alarm.ai_score * 100).toFixed(1)}%
                              </span>
                            )}
                            {alarm.ai_decision && (
                              <span
                                className={`px-3 py-1 rounded-full border text-xs font-medium ${
                                  alarm.ai_decision === "malicious"
                                    ? "bg-red-600/10 text-red-300 border-red-600/30"
                                    : "bg-green-500/10 text-green-400 border-green-500/30"
                                }`}
                              >
                                {alarm.ai_decision === "malicious"
                                  ? "악성"
                                  : "정상"}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {timeAgo(Number(alarm.detected_at))}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-slate-400 mb-1">
                            제품
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const os = alarm.os || "unknown";
                              const osLower = os.toLowerCase();
                              return (
                                <>
                                  {osLower.includes("windows") ? (
                                    <img
                                      src="/windows.webp"
                                      alt="Windows"
                                      className="w-4 h-4 object-contain"
                                    />
                                  ) : osLower.includes("linux") ? (
                                    <img
                                      src="/linux.png"
                                      alt="Linux"
                                      className="w-4 h-4 object-contain"
                                    />
                                  ) : null}
                                  <span className="text-sm text-slate-200 font-mono">
                                    {osLower.includes("windows")
                                      ? "windows"
                                      : osLower.includes("linux")
                                      ? "linux"
                                      : os}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-1">
                            룰 매칭 개수
                          </div>
                          <div className="text-sm text-slate-200 font-mono">
                            {alarm.matched_span_count || 0}개
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-1">
                            호스트명
                          </div>
                          <div className="text-sm text-slate-200 font-mono truncate">
                            {alarm.host || "unknown"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="text-xs text-slate-400 mb-1">
                          AI 요약
                        </div>
                        <div className="w-full text-sm text-slate-200 bg-slate-800/50 border border-slate-700/50 rounded px-3 py-2 whitespace-normal leading-6 max-h-48 overflow-auto">
                          {alarm.ai_summary || "AI 추론중..."}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 필터 사이드바 */}
          <div className="w-80 flex-shrink-0">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-200">필터</h3>
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-3 py-1 bg-slate-800 border-slate-700 rounded text-slate-300 hover:bg-slate-700 transition-colors text-sm"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  초기화
                </button>
              </div>

              <div className="space-y-6">
                {/* 심각도 필터 */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">
                    심각도
                  </label>
                  <div className="space-y-2">
                    {["critical", "high", "medium", "low"].map((severity) => (
                      <label
                        key={severity}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={severityFilters.includes(severity)}
                          onChange={() => toggleSeverityFilter(severity)}
                          className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm text-slate-300 capitalize">
                          {severity}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 상태 필터 */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">
                    상태
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: "all", label: "전체" },
                      { value: "unchecked", label: "미확인" },
                      { value: "checked", label: "확인됨" },
                    ].map((status) => (
                      <label
                        key={status.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="statusFilter"
                          value={status.value}
                          checked={statusFilter === status.value}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-600 focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm text-slate-300">
                          {status.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* AI 판정 필터 */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">
                    AI 판정
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: "all", label: "전체" },
                      { value: "malicious", label: "악성" },
                      { value: "benign", label: "정상" },
                    ].map((decision) => (
                      <label
                        key={decision.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="aiDecisionFilter"
                          value={decision.value}
                          checked={aiDecisionFilter === decision.value}
                          onChange={(e) => setAiDecisionFilter(e.target.value)}
                          className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-600 focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm text-slate-300">
                          {decision.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function AlarmsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">알람을 불러오는 중...</div>
        </div>
      }
    >
      <AlarmsContent />
    </Suspense>
  );
}
