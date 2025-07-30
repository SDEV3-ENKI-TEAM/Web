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

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/alarms?offset=${(page - 1) * limit}&limit=${limit}`)
      .then((res) => {
        if (!res.ok) throw new Error("API 오류");
        return res.json();
      })
      .then((data) => {
        setAlarms(
          (data.alarms || []).map((a: any) => ({
            ...a,
            checked: a.checked || false,
          }))
        );
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch((e) => {
        setError("알람 데이터를 불러오지 못했습니다.");
        setLoading(false);
      });
  }, [page]);

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
      const matchSearch =
        alarm.trace_id.toLowerCase().includes(search.toLowerCase()) ||
        alarm.summary.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "checked" && alarm.checked) ||
        (statusFilter === "unchecked" && !alarm.checked);
      return matchSearch && matchStatus;
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
          <div className="text-slate-400 text-sm font-mono">
            총 {total}개 알람
          </div>
          <div className="flex flex-row gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Trace ID, 요약으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-80"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
            >
              <option value="all">전체</option>
              <option value="unchecked">미확인</option>
              <option value="checked">확인됨</option>
            </select>
          </div>
        </div>
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
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-6 cursor-pointer hover:bg-slate-800/80 hover:border-slate-600/50 transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/50"
                  onClick={() => router.push(`/alarms/${alarm.trace_id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-100 mb-2">
                        {alarm.sigma_alert || alarm.summary}
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
                        <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-medium">
                          high
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
                        {alarm.os.toLowerCase().includes("windows") ? (
                          <img
                            src="/windows.webp"
                            alt="Windows"
                            className="w-4 h-4 object-contain"
                          />
                        ) : alarm.os.toLowerCase().includes("linux") ? (
                          <img
                            src="/linux.png"
                            alt="Linux"
                            className="w-4 h-4 object-contain"
                          />
                        ) : null}
                        <span className="text-sm text-slate-200 font-mono">
                          {alarm.os.toLowerCase().includes("windows")
                            ? "windows"
                            : alarm.os.toLowerCase().includes("linux")
                            ? "linux"
                            : alarm.os}
                        </span>
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
                        {alarm.host}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">
                        Trace ID
                      </div>
                      <div className="text-xs text-cyan-400 break-all font-mono">
                        {alarm.trace_id}
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
