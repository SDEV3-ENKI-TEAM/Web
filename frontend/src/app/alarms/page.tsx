"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface Alarm {
  trace_id: string;
  detected_at: number;
  summary: string;
  host: string;
  os: string;
  checked: boolean;
  sigma_alert?: string;
  span_count?: number;
  ai_summary?: string;
  severity?: string;
  severity_score?: number;
  sigma_rule_title?: string;
  isUpdated?: boolean; // 업데이트 플래그 추가
}

function timeAgo(dateNum: number) {
  if (!dateNum) return "-";
  const now = new Date();
  const date = new Date(dateNum);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function AlarmsPage() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
    "status" | "trace_id" | "summary" | "detected_at"
  >("detected_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const router = useRouter();

  const [severityFilters, setSeverityFilters] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connectWebSocket = () => {
      try {
        ws = new WebSocket("ws://localhost:8004/ws/alarms?limit=100");

        ws.onopen = () => {
          console.log("WebSocket 연결 성공");
          setWsConnected(true);
          setWsError(null);
          console.log("WebSocket 연결됨 - API 호출 건너뜀");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("WebSocket 메시지 수신:", data.type);

            if (data.type === "initial_data") {
              const initialAlarms = data.alarms || [];
              setAlarms(initialAlarms);
              setTotal(initialAlarms.length);
              setLoading(false);
            } else if (data.type === "new_trace") {
              setAlarms((prevAlarms) => {
                const newAlarm = data.data;

                const exists = prevAlarms.find(
                  (alarm) => alarm.trace_id === newAlarm.trace_id
                );
                if (exists) return prevAlarms;

                return [
                  {
                    ...newAlarm,
                    isUpdated: true,
                    detected_at: newAlarm.detected_at,
                  },
                  ...prevAlarms.slice(0, 99),
                ];
              });
              setTotal((prev) => prev + 1);
            } else if (data.type === "trace_update") {
              setAlarms((prevAlarms) => {
                if (!data.trace_id || !data.data) {
                  console.warn("⚠️ 업데이트 데이터가 유효하지 않음:", data);
                  return prevAlarms;
                }

                return prevAlarms.map((alarm) => {
                  if (alarm.trace_id === data.trace_id) {
                    const updatedAlarm = {
                      ...alarm,
                      ...data.data,
                      detected_at: alarm.detected_at,
                      isUpdated: true,
                    };

                    setTimeout(() => {
                      setAlarms((current) =>
                        current.map((a) =>
                          a.trace_id === data.trace_id
                            ? { ...a, isUpdated: false }
                            : a
                        )
                      );
                    }, 3000);

                    return updatedAlarm;
                  }
                  return alarm;
                });
              });
            }
          } catch (e) {
            console.error("WebSocket 메시지 파싱 오류:", e);
          }
        };

        ws.onclose = () => {
          console.log("🔌 WebSocket 연결 해제");
          setWsConnected(false);
          setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (error) => {
          console.error("WebSocket 오류:", error);
          setWsError("WebSocket 연결 오류");
          setWsConnected(false);
        };
      } catch (e) {
        console.error("WebSocket 연결 실패:", e);
        setWsError("WebSocket 연결 실패");
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // WebSocket 연결 시도 후 실패 시 API 호출
  useEffect(() => {
    let wsTimeout: NodeJS.Timeout;

    const tryWebSocketFirst = () => {
      wsTimeout = setTimeout(() => {
        setWsConnected(false);
        fetchAlarmsFromAPI();
      }, 2000);
    };

    const fetchAlarmsFromAPI = async () => {
      setLoading(true);
      setError(null);

      try {
        const alarmsRes = await fetch(
          `/api/alarms?offset=${(page - 1) * limit}&limit=${limit}`
        );
        if (!alarmsRes.ok) throw new Error("알람 API 오류");
        const alarmsData = await alarmsRes.json();

        const severityRes = await fetch("/api/alarms/severity");
        let severityData: Record<string, any> = {};
        if (severityRes.ok) {
          const severityResult = await severityRes.json();
          severityData = severityResult.severity_data || {};
        }

        const alarmsWithSeverity = (alarmsData.alarms || []).map((a: any) => {
          const alarmSeverity = a.sigma_alert
            ? severityData[a.sigma_alert]
            : null;
          return {
            ...a,
            checked: a.checked || false,
            severity: alarmSeverity?.level || "low",
            severity_score: alarmSeverity?.severity_score || 30,
            sigma_rule_title:
              alarmSeverity?.title || a.sigma_alert || a.summary,
          };
        });

        setAlarms(alarmsWithSeverity);
        setTotal(alarmsData.total || 0);
        setLoading(false);
      } catch (e) {
        setError("알람 데이터를 불러오지 못했습니다.");
        setLoading(false);
      }
    };

    if (!wsConnected) {
      fetchAlarmsFromAPI();

      setTimeout(() => {
        if (!wsConnected) {
        }
      }, 1000);
    }

    return () => {
      if (wsTimeout) clearTimeout(wsTimeout);
    };
  }, [page, wsConnected]);

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

      return matchSearch && matchStatus && matchSeverity;
    })
  );

  function handleSort(col: "status" | "trace_id" | "summary" | "detected_at") {
    if (sortBy === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "detected_at" ? "desc" : "asc");
    }
  }

  const handleCheck = async (trace_id: string) => {
    try {
      const currentAlarm = alarms.find((alarm) => alarm.trace_id === trace_id);
      const newCheckedStatus = !currentAlarm?.checked;

      const response = await fetch("/api/alarms/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trace_id: trace_id,
          checked: newCheckedStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("상태 업데이트 실패");
      }
      setAlarms((prev) =>
        prev.map((alarm) =>
          alarm.trace_id === trace_id
            ? { ...alarm, checked: newCheckedStatus }
            : alarm
        )
      );
    } catch (error) {
      console.error("알림 상태 업데이트 실패:", error);
      alert("알림 상태 업데이트에 실패했습니다.");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSeverityFilters([]);
    setDateRange({ startDate: "", endDate: "" });
  };

  const toggleSeverityFilter = (severity: string) => {
    setSeverityFilters((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity]
    );
  };

  const totalPages = Math.ceil(total / limit);
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
      pageNumbers.push(i);
    } else if (
      (i === page - 3 && page - 3 > 1) ||
      (i === page + 3 && page + 3 < totalPages)
    ) {
      pageNumbers.push("...");
    }
  }

  return (
    <DashboardLayout onLogout={() => {}}>
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
              onClick={() => alert("초보자 가이드는 추후 제공 예정입니다.")}
              className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-200 hover:bg-blue-500/30 transition-colors font-sans text-sm"
            >
              초보자 가이드
            </button>
          </div>
        </motion.div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="text-slate-400 text-sm font-mono">
              총 {total}개 알람{" "}
              {filteredAlarms.length !== alarms.length &&
                `(필터링됨: ${filteredAlarms.length}개)`}
            </div>

            {/* WebSocket 연결 상태 표시 */}
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
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 hover:bg-slate-700 transition-colors font-sans text-sm flex items-center gap-2"
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
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
                />
              </svg>
              필터
            </button>
          </div>
        </div>

        {/* 필터 패널 */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 rounded-lg border border-slate-800 bg-slate-900/80 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">필터</h3>
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 transition-colors text-sm"
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            </div>
          </motion.div>
        )}

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
                        {alarm.sigma_rule_title || alarm.summary}
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
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {timeAgo(alarm.detected_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">제품</div>
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
                        Span 개수
                      </div>
                      <div className="text-sm text-slate-200 font-mono">
                        {alarm.span_count || 0}개
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
                    <div>
                      <div className="text-xs text-slate-400 mb-1">
                        Trace ID
                      </div>
                      <div className="text-xs text-cyan-400 break-all font-mono">
                        {alarm.trace_id || "unknown"}
                      </div>
                    </div>
                  </div>

                  {alarm.ai_summary && (
                    <div className="mb-4">
                      <div className="text-xs text-slate-400 mb-1">AI 요약</div>
                      <div className="text-sm text-slate-200 bg-slate-700/30 rounded p-3 border border-slate-600/30">
                        {alarm.ai_summary}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-slate-700/50 text-slate-300 text-xs font-mono">
                      behavior.process_creation
                    </span>
                    <span className="px-2 py-1 rounded-full bg-slate-700/50 text-slate-300 text-xs font-mono">
                      actor.suspicious
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center items-center gap-2 py-6">
          {pageNumbers.map((num, idx) =>
            num === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">
                ...
              </span>
            ) : (
              <button
                key={`${num}-${idx}`}
                onClick={() => setPage(Number(num))}
                className={`px-3 py-1 rounded border text-sm font-mono transition-all ${
                  page === num
                    ? "bg-blue-500/30 border-blue-500 text-blue-200 font-bold"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
                disabled={page === num}
              >
                {num}
              </button>
            )
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
