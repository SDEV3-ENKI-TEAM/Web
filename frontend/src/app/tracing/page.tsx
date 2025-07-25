"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";

// Mock data for tracing/data processing
const mockTracingData = {
  pipeline: {
    status: "ACTIVE",
    totalProcessed: 45672,
    processedToday: 3421,
    avgProcessingTime: 120, // ms
    throughput: 156, // events/second
    errorRate: 0.02, // 2%
    otelConversionRate: 98.5, // %
    lastUpdated: new Date(),
  },
  stages: [
    {
      id: "agent-collection",
      name: "Agent Data Collection",
      status: "RUNNING",
      processed: 3421,
      errors: 2,
      avgTime: 45,
      description: "에이전트로부터 원시 보안 이벤트 수집",
    },
    {
      id: "data-validation",
      name: "Data Validation",
      status: "RUNNING",
      processed: 3419,
      errors: 0,
      avgTime: 23,
      description: "수집된 데이터 유효성 검증 및 사전 처리",
    },
    {
      id: "otel-conversion",
      name: "OTEL Format Conversion",
      status: "RUNNING",
      processed: 3415,
      errors: 4,
      avgTime: 67,
      description: "OpenTelemetry 표준 형식으로 데이터 변환",
    },
    {
      id: "enrichment",
      name: "Data Enrichment",
      status: "RUNNING",
      processed: 3413,
      errors: 1,
      avgTime: 89,
      description: "컨텍스트 정보 추가 및 메타데이터 보강",
    },
    {
      id: "rule-preparation",
      name: "Rule Engine Preparation",
      status: "RUNNING",
      processed: 3411,
      errors: 0,
      avgTime: 34,
      description: "룰 엔진 분석을 위한 데이터 준비",
    },
  ],
  recentLogs: [
    {
      timestamp: "15:30:45",
      level: "INFO",
      stage: "otel-conversion",
      message: "Successfully converted batch of 50 events to OTEL format",
      details: "Processing time: 67ms, Memory usage: 45MB",
    },
    {
      timestamp: "15:30:42",
      level: "WARN",
      stage: "agent-collection",
      message: "Agent timeout detected for endpoint 192.168.1.150",
      details: "Retrying connection... Attempt 2/3",
    },
    {
      timestamp: "15:30:38",
      level: "ERROR",
      stage: "otel-conversion",
      message: "Failed to parse event schema from agent WS-SEC-003",
      details: "Invalid timestamp format, event dropped",
    },
    {
      timestamp: "15:30:35",
      level: "INFO",
      stage: "data-validation",
      message: "Data quality check completed for batch #4521",
      details: "100% validation success rate",
    },
    {
      timestamp: "15:30:30",
      level: "INFO",
      stage: "enrichment",
      message: "Added geolocation data for 45 events",
      details: "IP enrichment successful, processing time: 23ms",
    },
  ],
  performanceMetrics: {
    memoryUsage: 67, // %
    cpuUsage: 34, // %
    diskIO: 23, // MB/s
    networkIO: 45, // MB/s
    queueSize: 127,
    maxQueueSize: 1000,
  },
  otelSample: {
    traceId: "abc123def456789",
    spanId: "span789012345",
    operationName: "security.event.process",
    timestamp: "2024-12-20T15:30:45.123Z",
    duration: 67000, // microseconds
    tags: {
      "service.name": "security-agent",
      "agent.hostname": "WS-DEV-001",
      "event.type": "file_access",
      "user.name": "john.doe",
      severity: "medium",
    },
    logs: [
      {
        timestamp: "2024-12-20T15:30:45.123Z",
        level: "INFO",
        message: "File access event detected",
        fields: {
          "file.path": "/etc/passwd",
          "process.name": "cat",
          "user.id": "1001",
        },
      },
    ],
  },
};

export default function TracingPage() {
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"overview" | "logs" | "otel">(
    "overview"
  );
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { isLoggedIn, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Auto refresh simulation
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Here you would fetch real data
      console.log("Refreshing tracing data...");
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "running":
      case "active":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      case "error":
      case "failed":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "warning":
      case "degraded":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "stopped":
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
      default:
        return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return "text-red-400";
      case "warn":
      case "warning":
        return "text-yellow-400";
      case "info":
        return "text-blue-400";
      case "debug":
        return "text-slate-400";
      default:
        return "text-slate-300";
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center relative">
        {/* 3D Bubbles Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-xl animate-float"></div>
          <div className="absolute top-40 right-20 w-80 h-80 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-full blur-xl animate-float-delay-1"></div>
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-gradient-to-br from-green-500/15 to-blue-500/15 rounded-full blur-xl animate-float-delay-2"></div>
          <div className="absolute bottom-40 right-10 w-60 h-60 bg-gradient-to-br from-pink-500/20 to-yellow-500/20 rounded-full blur-xl animate-float-delay-3"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Terminal Loading Window */}
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border border-slate-700/50">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-slate-400 text-sm font-mono">
                  otel-processor://data-pipeline --initializing
                </span>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="p-6">
              <div className="text-cyan-400 font-mono text-sm mb-4">
                $ data-pipeline --otel-conversion --monitoring --realtime
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-4 border-2 border-cyan-500/50 border-t-cyan-500 rounded-full animate-spin"></div>
                <span className="text-slate-300 font-mono text-sm">
                  데이터 파이프라인 시스템 부팅 중...
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-400">
                  ✓ Loading OTEL processor modules
                </div>
                <div className="text-slate-400">
                  ✓ Initializing data transformation engine
                </div>
                <div className="text-slate-400">
                  ✓ Starting pipeline monitoring services
                </div>
                <div className="text-cyan-400 animate-pulse">
                  ✓ Connecting to agent data streams...
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-xl">로그인이 필요합니다.</div>
      </main>
    );
  }

  return (
    <DashboardLayout onLogout={handleLogout} onOpenSettings={() => {}}>
      {/* 3D Bubbles Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-xl animate-float"></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-full blur-xl animate-float-delay-1"></div>
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-gradient-to-br from-green-500/15 to-blue-500/15 rounded-full blur-xl animate-float-delay-2"></div>
        <div className="absolute bottom-40 right-10 w-60 h-60 bg-gradient-to-br from-pink-500/20 to-yellow-500/20 rounded-full blur-xl animate-float-delay-3"></div>
      </div>

      <div className="relative z-10 p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
        >
          {/* Terminal Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border border-slate-700/50">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="flex-1 text-center">
              <span className="text-slate-400 text-sm font-mono">
                otel-processor://data-pipeline --monitoring --realtime
              </span>
            </div>
          </div>

          {/* Terminal Content */}
          <div className="p-6">
            <div className="text-cyan-400 font-mono text-sm mb-4">
              $ data-pipeline --status --otel-conversion --monitoring
            </div>
            <div>
              <h1 className="text-2xl font-bold text-cyan-400 font-mono mb-2">
                Data Processing Pipeline
              </h1>
              <p className="text-slate-400 font-mono text-sm">
                실시간 이벤트 데이터 처리 및 OTEL 변환 모니터링
              </p>
            </div>
          </div>
        </motion.div>

        {/* Pipeline Status Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            {
              label: "처리량",
              value: `${mockTracingData.pipeline.throughput}/s`,
              color: "text-blue-400",
              desc: "초당 이벤트",
            },
            {
              label: "총 처리",
              value: mockTracingData.pipeline.totalProcessed.toLocaleString(),
              color: "text-green-400",
              desc: "전체 이벤트",
            },
            {
              label: "오늘 처리",
              value: mockTracingData.pipeline.processedToday.toLocaleString(),
              color: "text-purple-400",
              desc: "금일 이벤트",
            },
            {
              label: "OTEL 변환율",
              value: `${mockTracingData.pipeline.otelConversionRate}%`,
              color: "text-cyan-400",
              desc: "변환 성공률",
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-slate-400 text-xs font-mono">
                  {stat.label}
                </span>
              </div>
              <div
                className={`text-2xl font-bold font-mono ${stat.color} mb-1`}
              >
                {stat.value}
              </div>
              <div className="text-slate-500 text-xs font-mono">
                {stat.desc}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg p-4"
        >
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("overview")}
                className={`px-4 py-2 text-sm font-mono rounded transition-colors ${
                  viewMode === "overview"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                    : "text-slate-400 hover:text-slate-300 border border-slate-600/50"
                }`}
              >
                파이프라인 개요
              </button>
              <button
                onClick={() => setViewMode("logs")}
                className={`px-4 py-2 text-sm font-mono rounded transition-colors ${
                  viewMode === "logs"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                    : "text-slate-400 hover:text-slate-300 border border-slate-600/50"
                }`}
              >
                처리 로그
              </button>
              <button
                onClick={() => setViewMode("otel")}
                className={`px-4 py-2 text-sm font-mono rounded transition-colors ${
                  viewMode === "otel"
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                    : "text-slate-400 hover:text-slate-300 border border-slate-600/50"
                }`}
              >
                OTEL 샘플
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-mono text-slate-400">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600"
                />
                자동 새로고침
              </label>
              <span
                className={`text-xs px-2 py-1 rounded border font-mono ${getStatusColor(
                  mockTracingData.pipeline.status
                )}`}
              >
                {mockTracingData.pipeline.status}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Content based on view mode */}
        <AnimatePresence mode="wait">
          {viewMode === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              {/* Pipeline Stages */}
              <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
                <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-400 text-sm font-mono ml-2">
                    pipeline-stages --list --status
                  </span>
                </div>

                <div className="p-4">
                  <div className="space-y-4">
                    {mockTracingData.stages.map((stage, index) => (
                      <motion.div
                        key={stage.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() =>
                          setSelectedStage(
                            selectedStage?.id === stage.id ? null : stage
                          )
                        }
                        className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs px-2 py-1 rounded border font-mono ${getStatusColor(
                                stage.status
                              )}`}
                            >
                              {stage.status}
                            </span>
                            <h3 className="text-slate-300 font-mono font-medium">
                              {stage.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-4 text-sm font-mono">
                            <span className="text-slate-400">
                              처리:{" "}
                              <span className="text-cyan-400">
                                {stage.processed}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              오류:{" "}
                              <span
                                className={
                                  stage.errors > 0
                                    ? "text-red-400"
                                    : "text-green-400"
                                }
                              >
                                {stage.errors}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              평균:{" "}
                              <span className="text-blue-400">
                                {stage.avgTime}ms
                              </span>
                            </span>
                          </div>
                        </div>
                        <p className="text-slate-500 text-sm font-mono">
                          {stage.description}
                        </p>

                        {selectedStage?.id === stage.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-slate-700/50"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-slate-400 font-mono mb-1">
                                  처리 현황
                                </div>
                                <div className="text-cyan-400 font-mono">
                                  {stage.processed.toLocaleString()} 이벤트
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-400 font-mono mb-1">
                                  성공률
                                </div>
                                <div className="text-green-400 font-mono">
                                  {(
                                    ((stage.processed - stage.errors) /
                                      stage.processed) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-400 font-mono mb-1">
                                  처리 속도
                                </div>
                                <div className="text-blue-400 font-mono">
                                  {(stage.processed / 3600).toFixed(1)} /초
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
                <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-400 text-sm font-mono ml-2">
                    system-metrics --performance --realtime
                  </span>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      {
                        label: "메모리 사용률",
                        value: mockTracingData.performanceMetrics.memoryUsage,
                        unit: "%",
                        color: "blue",
                      },
                      {
                        label: "CPU 사용률",
                        value: mockTracingData.performanceMetrics.cpuUsage,
                        unit: "%",
                        color: "green",
                      },
                      {
                        label: "디스크 I/O",
                        value: mockTracingData.performanceMetrics.diskIO,
                        unit: "MB/s",
                        color: "purple",
                      },
                      {
                        label: "네트워크 I/O",
                        value: mockTracingData.performanceMetrics.networkIO,
                        unit: "MB/s",
                        color: "cyan",
                      },
                      {
                        label: "대기열 크기",
                        value: mockTracingData.performanceMetrics.queueSize,
                        unit: `/${mockTracingData.performanceMetrics.maxQueueSize}`,
                        color: "yellow",
                      },
                    ].map((metric, index) => (
                      <div
                        key={metric.label}
                        className="bg-slate-800/30 rounded border border-slate-700/50 p-3"
                      >
                        <div className="text-slate-400 text-xs font-mono mb-2">
                          {metric.label}
                        </div>
                        <div className="flex items-end gap-2">
                          <span
                            className={`text-xl font-bold font-mono text-${metric.color}-400`}
                          >
                            {metric.value}
                          </span>
                          <span className="text-slate-500 text-sm font-mono">
                            {metric.unit}
                          </span>
                        </div>
                        <div className="w-full h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full bg-${metric.color}-500 rounded-full transition-all duration-500`}
                            style={{ width: `${Math.min(100, metric.value)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {viewMode === "logs" && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
            >
              <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-slate-400 text-sm font-mono ml-2">
                  tail -f /var/log/pipeline/processing.log
                </span>
              </div>

              <div className="p-4 max-h-96 overflow-y-auto">
                <style jsx>{`
                  .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-track {
                    background: #1e293b;
                    border-radius: 3px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 3px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #64748b;
                  }
                `}</style>
                <div className="space-y-2 custom-scrollbar">
                  {mockTracingData.recentLogs.map((log, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-4 p-3 bg-slate-800/30 rounded border border-slate-700/30 font-mono text-sm"
                    >
                      <span className="text-slate-500 text-xs">
                        {log.timestamp}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded border font-bold ${
                          log.level === "ERROR"
                            ? "bg-red-500/20 border-red-500/50 text-red-300"
                            : log.level === "WARN"
                            ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                            : "bg-blue-500/20 border-blue-500/50 text-blue-300"
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-cyan-400 text-xs">{log.stage}</span>
                      <div className="flex-1">
                        <div className="text-slate-300 text-xs">
                          {log.message}
                        </div>
                        <div className="text-slate-500 text-xs mt-1">
                          {log.details}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {viewMode === "otel" && (
            <motion.div
              key="otel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
            >
              <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-slate-400 text-sm font-mono ml-2">
                  otel-trace --sample --format=json
                </span>
              </div>

              <div className="p-4">
                <pre className="text-xs font-mono text-slate-300 bg-slate-800/50 p-4 rounded border border-slate-700/50 overflow-x-auto">
                  {JSON.stringify(mockTracingData.otelSample, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
