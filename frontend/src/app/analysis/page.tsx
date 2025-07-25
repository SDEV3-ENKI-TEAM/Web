"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";

// Mock data for AI Threat Analysis
const mockThreatData = {
  threatAnalysis: {
    totalThreats: 1247,
    highRiskThreats: 89,
    mediumRiskThreats: 312,
    lowRiskThreats: 846,
    aiAccuracy: 94.7,
    processingTime: 1.2,
    falsePositives: 3.1,
  },
  threatCategories: [
    { category: "악성코드", count: 234, severity: "high", trend: "+12%" },
    { category: "APT 공격", count: 67, severity: "critical", trend: "+8%" },
    { category: "내부자 위협", count: 123, severity: "medium", trend: "-5%" },
    { category: "피싱", count: 189, severity: "medium", trend: "+15%" },
    { category: "DDoS", count: 45, severity: "high", trend: "-2%" },
    { category: "랜섬웨어", count: 34, severity: "critical", trend: "+7%" },
  ],
  aiInsights: [
    {
      insight: "새로운 APT 그룹의 공격 패턴 탐지",
      confidence: 92.4,
      riskLevel: "critical",
      affectedSystems: 23,
      timestamp: "2024-03-15 14:32:15",
    },
    {
      insight: "비정상적인 네트워크 트래픽 패턴",
      confidence: 87.6,
      riskLevel: "high",
      affectedSystems: 8,
      timestamp: "2024-03-15 14:15:42",
    },
    {
      insight: "권한 상승 시도 증가 추세",
      confidence: 78.9,
      riskLevel: "medium",
      affectedSystems: 45,
      timestamp: "2024-03-15 13:58:21",
    },
    {
      insight: "외부 IP에서 반복적인 접근 시도",
      confidence: 95.1,
      riskLevel: "high",
      affectedSystems: 12,
      timestamp: "2024-03-15 13:45:33",
    },
  ],
  realtimeAnalysis: [
    {
      eventId: "TH-2024-031501",
      source: "192.168.1.105",
      target: "DC-Server-01",
      threatType: "Lateral Movement",
      severity: "high",
      aiScore: 89.3,
      status: "분석중",
      timestamp: "14:35:22",
    },
    {
      eventId: "TH-2024-031502",
      source: "외부-221.143.22.8",
      target: "Web-Server-03",
      threatType: "SQL Injection",
      severity: "critical",
      aiScore: 96.7,
      status: "차단됨",
      timestamp: "14:34:15",
    },
    {
      eventId: "TH-2024-031503",
      source: "192.168.1.87",
      target: "File-Server-02",
      threatType: "Suspicious File Access",
      severity: "medium",
      aiScore: 73.2,
      status: "모니터링",
      timestamp: "14:33:08",
    },
  ],
  modelPerformance: [
    { time: "00:00", accuracy: 94.2, processed: 156, blocked: 23 },
    { time: "04:00", accuracy: 93.8, processed: 189, blocked: 31 },
    { time: "08:00", accuracy: 95.1, processed: 312, blocked: 45 },
    { time: "12:00", accuracy: 92.4, processed: 428, blocked: 67 },
    { time: "16:00", accuracy: 94.7, processed: 398, blocked: 52 },
    { time: "20:00", accuracy: 95.3, processed: 267, blocked: 38 },
  ],
};

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState("threatAnalysis");
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState("queries");
  const [realTimeData, setRealTimeData] = useState({
    activeThreats: 0,
    aiAnalysisCount: 0,
    blockedAttacks: 0,
  });

  const { isLoggedIn, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeData({
        activeThreats: Math.floor(Math.random() * 50) + 20,
        aiAnalysisCount: Math.floor(Math.random() * 200) + 100,
        blockedAttacks: Math.floor(Math.random() * 15) + 5,
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const tabs = [
    { id: "threatAnalysis", label: "위협 분석 개요" },
    { id: "threatCategories", label: "위협 카테고리" },
    { id: "aiInsights", label: "AI 인사이트" },
    { id: "realtimeAnalysis", label: "실시간 분석" },
    { id: "modelPerformance", label: "모델 성능" },
  ];

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
                  ai-threat-analyzer://security-monitor --initializing
                </span>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="p-6">
              <div className="text-cyan-400 font-mono text-sm mb-4">
                $ threat-analyzer --ai-engine --real-time --monitoring
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-4 border-2 border-cyan-500/50 border-t-cyan-500 rounded-full animate-spin"></div>
                <span className="text-slate-300 font-mono text-sm">
                  AI 위협 분석 시스템 부팅 중...
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-400">
                  ✓ Loading threat detection models
                </div>
                <div className="text-slate-400">
                  ✓ Initializing AI analysis engine
                </div>
                <div className="text-slate-400">
                  ✓ Connecting real-time monitoring systems
                </div>
                <div className="text-cyan-400 animate-pulse">
                  → Analyzing security threat patterns...
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
        {/* Terminal Header with Real-time Stats */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
        >
          {/* Terminal Title Bar */}
          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-slate-400 text-sm font-mono ml-2">
              rag-analytics://langgraph-dashboard --comprehensive --live
            </span>
          </div>

          {/* Command Interface */}
          <div className="p-4">
            <div className="flex items-center gap-4 text-sm font-mono mb-4">
              <span className="text-cyan-400">rag@langgraph:~$</span>
              <span className="text-slate-300">
                monitor --retrieval --workflows --agents --vectors
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-cyan-400 font-mono mb-2">
                  Analytics Hub
                </h1>
                <p className="text-slate-400 font-mono text-sm">
                  검색 증강 생성 및 워크플로우 오케스트레이션 모니터링 시스템
                </p>
              </div>

              {/* Real-time Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-600/30 text-center">
                  <div className="text-xs text-slate-400 font-mono mb-1">
                    활성 위협
                  </div>
                  <div className="text-lg font-bold text-cyan-400 font-mono">
                    {realTimeData.activeThreats}
                  </div>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-600/30 text-center">
                  <div className="text-xs text-slate-400 font-mono mb-1">
                    AI 분석
                  </div>
                  <div className="text-lg font-bold text-green-400 font-mono">
                    {realTimeData.aiAnalysisCount}/s
                  </div>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-600/30 text-center">
                  <div className="text-xs text-slate-400 font-mono mb-1">
                    차단된 공격
                  </div>
                  <div className="text-lg font-bold text-yellow-400 font-mono">
                    {realTimeData.blockedAttacks}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
        >
          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-slate-400 text-sm font-mono ml-2">
              tab-navigator --rag --langgraph --agents --vectors
            </span>
          </div>

          <div className="p-4">
            <div className="flex space-x-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 rounded-lg transition-all duration-200 font-mono text-sm ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 border border-blue-500/50 shadow-lg"
                      : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/30"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <div className="min-h-[600px]">
          <AnimatePresence mode="wait">
            {activeTab === "threatAnalysis" && (
              <motion.div
                key="threatAnalysis"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <ThreatAnalysis data={mockThreatData.threatAnalysis} />
              </motion.div>
            )}

            {activeTab === "threatCategories" && (
              <motion.div
                key="threatCategories"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <ThreatCategories data={mockThreatData.threatCategories} />
              </motion.div>
            )}

            {activeTab === "aiInsights" && (
              <motion.div
                key="aiInsights"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <AIInsights data={mockThreatData.aiInsights} />
              </motion.div>
            )}

            {activeTab === "realtimeAnalysis" && (
              <motion.div
                key="realtimeAnalysis"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <RealtimeAnalysis data={mockThreatData.realtimeAnalysis} />
              </motion.div>
            )}

            {activeTab === "modelPerformance" && (
              <motion.div
                key="modelPerformance"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <ModelPerformance data={mockThreatData.modelPerformance} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(71, 85, 105, 0.5) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(71, 85, 105, 0.5);
          border-radius: 3px;
          border: none;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(71, 85, 105, 0.7);
        }
      `}</style>
    </DashboardLayout>
  );
}

// Threat Analysis Component
function ThreatAnalysis({ data }: { data: any }) {
  const metrics = [
    {
      key: "totalThreats",
      label: "전체 위협 수",
      value: data.totalThreats.toLocaleString(),
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
    },
    {
      key: "highRiskThreats",
      label: "고위험 위협",
      value: data.highRiskThreats.toLocaleString(),
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
    },
    {
      key: "aiAccuracy",
      label: "AI 정확도",
      value: `${data.aiAccuracy}%`,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
    },
    {
      key: "processingTime",
      label: "평균 처리시간",
      value: `${data.processingTime}s`,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-slate-400 text-sm font-mono ml-2">
            ai-threat-analyzer --analysis --metrics --real-time
          </span>
        </div>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-6 font-mono">
            AI 위협 분석 개요
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`${metric.bg} ${metric.border} border rounded-lg p-4 relative overflow-hidden group hover:scale-105 transition-transform duration-300`}
              >
                <div className="relative z-10">
                  <h4 className={`${metric.color} font-mono text-sm mb-2`}>
                    {metric.label}
                  </h4>
                  <p className="text-white text-2xl font-bold font-mono">
                    {metric.value}
                  </p>
                </div>
                <div
                  className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${
                    metric.color.includes("cyan")
                      ? "from-cyan-500 to-blue-500"
                      : metric.color.includes("red")
                      ? "from-red-500 to-pink-500"
                      : metric.color.includes("green")
                      ? "from-green-500 to-emerald-500"
                      : "from-purple-500 to-violet-500"
                  }`}
                ></div>
              </motion.div>
            ))}
          </div>

          {/* 위협 분포 차트 */}
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
            <h4 className="text-blue-400 font-mono text-sm mb-4">
              위험도별 위협 분포
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-red-400 font-mono text-sm">고위험</span>
                <div className="flex-1 mx-4 bg-slate-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        (data.highRiskThreats / data.totalThreats) * 100
                      }%`,
                    }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="h-2 bg-red-500 rounded-full"
                  />
                </div>
                <span className="text-slate-300 font-mono text-sm">
                  {data.highRiskThreats}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-yellow-400 font-mono text-sm">
                  중위험
                </span>
                <div className="flex-1 mx-4 bg-slate-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        (data.mediumRiskThreats / data.totalThreats) * 100
                      }%`,
                    }}
                    transition={{ delay: 0.7, duration: 1 }}
                    className="h-2 bg-yellow-500 rounded-full"
                  />
                </div>
                <span className="text-slate-300 font-mono text-sm">
                  {data.mediumRiskThreats}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-green-400 font-mono text-sm">저위험</span>
                <div className="flex-1 mx-4 bg-slate-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        (data.lowRiskThreats / data.totalThreats) * 100
                      }%`,
                    }}
                    transition={{ delay: 0.9, duration: 1 }}
                    className="h-2 bg-green-500 rounded-full"
                  />
                </div>
                <span className="text-slate-300 font-mono text-sm">
                  {data.lowRiskThreats}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Threat Categories Component
function ThreatCategories({ data }: { data: any[] }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "high":
        return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      case "medium":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "low":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend.startsWith("+")) {
      return <span className="text-red-400">↗</span>;
    } else if (trend.startsWith("-")) {
      return <span className="text-green-400">↘</span>;
    }
    return <span className="text-slate-400">→</span>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-slate-400 text-sm font-mono ml-2">
            threat-categorizer --classification --trend-analysis
          </span>
        </div>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-6 font-mono">
            위협 카테고리 분석
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((category, index) => (
              <motion.div
                key={category.category}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30 hover:scale-105 transition-transform"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-blue-400 font-mono font-bold text-lg">
                    {category.category}
                  </h4>
                  <span
                    className={`text-xs font-mono px-3 py-1 rounded-full border ${getSeverityColor(
                      category.severity
                    )}`}
                  >
                    {category.severity.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-mono text-sm">
                      탐지 건수:
                    </span>
                    <span className="text-white font-mono text-xl font-bold">
                      {category.count.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-mono text-sm">
                      추세:
                    </span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(category.trend)}
                      <span
                        className={`font-mono text-sm ${
                          category.trend.startsWith("+")
                            ? "text-red-400"
                            : category.trend.startsWith("-")
                            ? "text-green-400"
                            : "text-slate-400"
                        }`}
                      >
                        {category.trend}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-700/50 rounded-full h-2 mt-4">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          (category.count / 500) * 100,
                          100
                        )}%`,
                      }}
                      transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                      className={`h-2 rounded-full ${
                        category.severity === "critical"
                          ? "bg-red-500"
                          : category.severity === "high"
                          ? "bg-orange-500"
                          : category.severity === "medium"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    ></motion.div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-500 font-mono text-xs">
                      위험도:
                    </span>
                    <div
                      className={`font-mono text-sm ${
                        category.severity === "critical"
                          ? "text-red-400"
                          : category.severity === "high"
                          ? "text-orange-400"
                          : category.severity === "medium"
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {category.severity === "critical"
                        ? "매우 높음"
                        : category.severity === "high"
                        ? "높음"
                        : category.severity === "medium"
                        ? "보통"
                        : "낮음"}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* 위협 트렌드 요약 */}
          <div className="mt-8 bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
            <h4 className="text-blue-400 font-mono text-sm mb-4">
              위협 트렌드 요약
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-red-400 text-2xl font-bold font-mono">
                  {data.filter((item) => item.trend.startsWith("+")).length}
                </div>
                <div className="text-slate-400 text-sm font-mono">
                  증가 추세
                </div>
              </div>
              <div className="text-center">
                <div className="text-green-400 text-2xl font-bold font-mono">
                  {data.filter((item) => item.trend.startsWith("-")).length}
                </div>
                <div className="text-slate-400 text-sm font-mono">
                  감소 추세
                </div>
              </div>
              <div className="text-center">
                <div className="text-cyan-400 text-2xl font-bold font-mono">
                  {data
                    .reduce((sum, item) => sum + item.count, 0)
                    .toLocaleString()}
                </div>
                <div className="text-slate-400 text-sm font-mono">
                  총 위협 수
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// AI Insights Component
function AIInsights({ data }: { data: any[] }) {
  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "critical":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "high":
        return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      case "medium":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "low":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-400";
    if (confidence >= 80) return "text-yellow-400";
    if (confidence >= 70) return "text-orange-400";
    return "text-red-400";
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("ko-KR");
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-slate-400 text-sm font-mono ml-2">
            ai-threat-insights --machine-learning --pattern-analysis
          </span>
        </div>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-6 font-mono">
            AI 위협 인사이트
          </h3>

          <div className="space-y-4">
            {data.map((insight, index) => (
              <motion.div
                key={insight.insight}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30 hover:scale-[1.02] transition-transform"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-blue-400 font-mono font-bold text-lg mb-2">
                      {insight.insight}
                    </h4>
                    <div className="flex items-center gap-4 mb-3">
                      <span
                        className={`text-xs font-mono px-3 py-1 rounded-full border ${getRiskLevelColor(
                          insight.riskLevel
                        )}`}
                      >
                        {insight.riskLevel.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-xs">
                          신뢰도:
                        </span>
                        <span
                          className={`font-mono text-sm font-bold ${getConfidenceColor(
                            insight.confidence
                          )}`}
                        >
                          {insight.confidence}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                    <div className="text-slate-400 font-mono text-xs mb-1">
                      영향받는 시스템
                    </div>
                    <div className="text-cyan-400 font-mono text-xl font-bold">
                      {insight.affectedSystems}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                    <div className="text-slate-400 font-mono text-xs mb-1">
                      위험 수준
                    </div>
                    <div
                      className={`font-mono text-xl font-bold ${
                        insight.riskLevel === "critical"
                          ? "text-red-400"
                          : insight.riskLevel === "high"
                          ? "text-orange-400"
                          : insight.riskLevel === "medium"
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {insight.riskLevel === "critical"
                        ? "매우 높음"
                        : insight.riskLevel === "high"
                        ? "높음"
                        : insight.riskLevel === "medium"
                        ? "보통"
                        : "낮음"}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                    <div className="text-slate-400 font-mono text-xs mb-1">
                      탐지 시각
                    </div>
                    <div className="text-purple-400 font-mono text-sm">
                      {formatTimestamp(insight.timestamp)}
                    </div>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="w-full bg-slate-700/50 rounded-full h-2 mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${insight.confidence}%` }}
                    transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                    className={`h-2 rounded-full ${
                      getConfidenceColor(insight.confidence).includes("green")
                        ? "bg-green-500"
                        : getConfidenceColor(insight.confidence).includes(
                            "yellow"
                          )
                        ? "bg-yellow-500"
                        : getConfidenceColor(insight.confidence).includes(
                            "orange"
                          )
                        ? "bg-orange-500"
                        : "bg-red-500"
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">
                    AI 신뢰도: {insight.confidence}%
                  </span>
                  <span className="text-slate-500">
                    분석 ID: AI-{Date.now() + index}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* AI 분석 요약 */}
          <div className="mt-8 bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
            <h4 className="text-blue-400 font-mono text-sm mb-4">
              AI 분석 요약
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-red-400 text-2xl font-bold font-mono">
                  {data.filter((item) => item.riskLevel === "critical").length}
                </div>
                <div className="text-slate-400 text-sm font-mono">
                  긴급 위협
                </div>
              </div>
              <div className="text-center">
                <div className="text-orange-400 text-2xl font-bold font-mono">
                  {data.filter((item) => item.riskLevel === "high").length}
                </div>
                <div className="text-slate-400 text-sm font-mono">
                  고위험 위협
                </div>
              </div>
              <div className="text-center">
                <div className="text-green-400 text-2xl font-bold font-mono">
                  {(
                    data.reduce((sum, item) => sum + item.confidence, 0) /
                    data.length
                  ).toFixed(1)}
                  %
                </div>
                <div className="text-slate-400 text-sm font-mono">
                  평균 신뢰도
                </div>
              </div>
              <div className="text-center">
                <div className="text-cyan-400 text-2xl font-bold font-mono">
                  {data.reduce((sum, item) => sum + item.affectedSystems, 0)}
                </div>
                <div className="text-slate-400 text-sm font-mono">
                  영향받는 시스템
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Real-time Analysis Component
function RealtimeAnalysis({ data }: { data: any[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "분석중":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "차단됨":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "모니터링":
        return "text-blue-400 bg-blue-500/10 border-blue-500/30";
      case "허용됨":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-400";
      case "high":
        return "text-orange-400";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-green-400";
      default:
        return "text-slate-400";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-red-400";
    if (score >= 70) return "text-orange-400";
    if (score >= 50) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-slate-400 text-sm font-mono ml-2">
            real-time-analyzer --live-monitoring --threat-detection
          </span>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-cyan-400 font-mono">
              실시간 위협 분석
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 font-mono text-sm">Live</span>
            </div>
          </div>

          {/* 실시간 위협 이벤트 목록 */}
          <div className="space-y-3">
            {data.map((event, index) => (
              <motion.div
                key={event.eventId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30 hover:bg-slate-800/50 transition-all duration-200"
              >
                <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-center">
                  {/* Event ID & Timestamp */}
                  <div className="lg:col-span-1">
                    <div className="text-blue-400 font-mono text-sm font-bold mb-1">
                      {event.eventId}
                    </div>
                    <div className="text-slate-400 font-mono text-xs">
                      {event.timestamp}
                    </div>
                  </div>

                  {/* Source & Target */}
                  <div className="lg:col-span-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-xs">
                          Source:
                        </span>
                        <span className="text-cyan-400 font-mono text-sm">
                          {event.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-xs">
                          Target:
                        </span>
                        <span className="text-purple-400 font-mono text-sm">
                          {event.target}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Threat Type & Severity */}
                  <div className="lg:col-span-1">
                    <div className="text-white font-mono text-sm font-bold mb-1">
                      {event.threatType}
                    </div>
                    <div
                      className={`font-mono text-xs ${getSeverityColor(
                        event.severity
                      )}`}
                    >
                      {event.severity.toUpperCase()}
                    </div>
                  </div>

                  {/* AI Score */}
                  <div className="lg:col-span-1">
                    <div className="text-center">
                      <div
                        className={`text-2xl font-bold font-mono ${getScoreColor(
                          event.aiScore
                        )}`}
                      >
                        {event.aiScore}
                      </div>
                      <div className="text-slate-400 font-mono text-xs">
                        AI 스코어
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1 mt-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${event.aiScore}%` }}
                        transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                        className={`h-1 rounded-full ${
                          event.aiScore >= 90
                            ? "bg-red-500"
                            : event.aiScore >= 70
                            ? "bg-orange-500"
                            : event.aiScore >= 50
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="lg:col-span-1">
                    <div className="flex justify-end">
                      <span
                        className={`text-xs font-mono px-3 py-1 rounded-full border ${getStatusColor(
                          event.status
                        )}`}
                      >
                        {event.status}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* 실시간 통계 */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30 text-center">
              <div className="text-cyan-400 text-2xl font-bold font-mono">
                {data.length}
              </div>
              <div className="text-slate-400 text-sm font-mono">
                실시간 이벤트
              </div>
            </div>
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30 text-center">
              <div className="text-red-400 text-2xl font-bold font-mono">
                {data.filter((event) => event.severity === "critical").length}
              </div>
              <div className="text-slate-400 text-sm font-mono">긴급 위협</div>
            </div>
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30 text-center">
              <div className="text-orange-400 text-2xl font-bold font-mono">
                {data.filter((event) => event.status === "차단됨").length}
              </div>
              <div className="text-slate-400 text-sm font-mono">
                차단된 위협
              </div>
            </div>
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30 text-center">
              <div className="text-green-400 text-2xl font-bold font-mono">
                {(
                  data.reduce((sum, event) => sum + event.aiScore, 0) /
                  data.length
                ).toFixed(1)}
              </div>
              <div className="text-slate-400 text-sm font-mono">
                평균 AI 스코어
              </div>
            </div>
          </div>

          {/* 위협 유형별 분포 */}
          <div className="mt-8 bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
            <h4 className="text-blue-400 font-mono text-sm mb-4">
              위협 유형별 분포
            </h4>
            <div className="space-y-2">
              {Object.entries(
                data.reduce((acc, event) => {
                  acc[event.threatType] = (acc[event.threatType] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([threatType, count], index) => (
                <div
                  key={threatType}
                  className="flex items-center justify-between"
                >
                  <span className="text-slate-300 font-mono text-sm">
                    {threatType}
                  </span>
                  <div className="flex items-center gap-2 flex-1 mx-4">
                    <div className="flex-1 bg-slate-700 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${((count as number) / data.length) * 100}%`,
                        }}
                        transition={{ delay: index * 0.1, duration: 0.8 }}
                        className="h-2 bg-blue-500 rounded-full"
                      />
                    </div>
                    <span className="text-blue-400 font-mono text-sm w-8">
                      {count as number}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Model Performance Component
function ModelPerformance({ data }: { data: any[] }) {
  const metrics = [
    { key: "accuracy", label: "정확도", color: "text-cyan-400", unit: "%" },
    {
      key: "processed",
      label: "처리된 이벤트",
      color: "text-blue-400",
      unit: "",
    },
    { key: "blocked", label: "차단된 위협", color: "text-red-400", unit: "" },
  ];

  const getMetricIcon = (key: string) => {
    switch (key) {
      case "accuracy":
        return "🎯";
      case "processed":
        return "📊";
      case "blocked":
        return "🛡️";
      default:
        return "📈";
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-slate-400 text-sm font-mono ml-2">
            ai-model-analyzer --performance --accuracy --metrics
          </span>
        </div>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-6 font-mono">
            AI 모델 성능 분석
          </h3>

          {/* 메트릭 선택 버튼 */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {metrics.map((metric) => (
              <button
                key={metric.key}
                className="px-4 py-2 rounded-lg transition-all duration-200 font-mono text-sm bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 border border-blue-500/50"
              >
                <span className="mr-2">{getMetricIcon(metric.key)}</span>
                {metric.label}
              </button>
            ))}
          </div>

          {/* 성능 차트 */}
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30 mb-6">
            <h4 className="text-blue-400 font-mono text-sm mb-4">
              시간대별 성능 추이
            </h4>
            <div className="flex items-end justify-between h-40 gap-2">
              {data.map((item, index) => {
                const accuracyHeight =
                  (item.accuracy / Math.max(...data.map((d) => d.accuracy))) *
                  100;
                const processedHeight =
                  (item.processed / Math.max(...data.map((d) => d.processed))) *
                  100;
                const blockedHeight =
                  (item.blocked / Math.max(...data.map((d) => d.blocked))) *
                  100;

                return (
                  <div
                    key={item.time}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    {/* 정확도 바 */}
                    <div className="relative group w-full">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${accuracyHeight}%` }}
                        transition={{ delay: index * 0.1, duration: 0.8 }}
                        className="bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t min-h-[4px] relative group-hover:shadow-lg transition-all duration-200"
                        style={{ height: `${accuracyHeight}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-xs text-cyan-400 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono whitespace-nowrap">
                          정확도: {item.accuracy}%<br />
                          처리: {item.processed}
                          <br />
                          차단: {item.blocked}
                        </div>
                      </motion.div>
                    </div>

                    <div className="text-xs text-blue-400 font-mono text-center">
                      {item.time}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 모델 성능 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
              <h4 className="text-cyan-400 font-mono text-sm mb-2">
                평균 정확도
              </h4>
              <div className="text-2xl font-bold text-cyan-400 font-mono">
                {(
                  data.reduce((sum, item) => sum + item.accuracy, 0) /
                  data.length
                ).toFixed(1)}
                %
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      data.reduce((sum, item) => sum + item.accuracy, 0) /
                      data.length
                    }%`,
                  }}
                  transition={{ delay: 0.5, duration: 1 }}
                  className="h-2 bg-cyan-500 rounded-full"
                />
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
              <h4 className="text-blue-400 font-mono text-sm mb-2">
                총 처리 이벤트
              </h4>
              <div className="text-2xl font-bold text-blue-400 font-mono">
                {data
                  .reduce((sum, item) => sum + item.processed, 0)
                  .toLocaleString()}
              </div>
              <div className="text-slate-400 font-mono text-xs mt-1">
                시간당 평균:{" "}
                {Math.round(
                  data.reduce((sum, item) => sum + item.processed, 0) /
                    data.length
                )}
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
              <h4 className="text-red-400 font-mono text-sm mb-2">
                총 차단 위협
              </h4>
              <div className="text-2xl font-bold text-red-400 font-mono">
                {data
                  .reduce((sum, item) => sum + item.blocked, 0)
                  .toLocaleString()}
              </div>
              <div className="text-slate-400 font-mono text-xs mt-1">
                차단률:{" "}
                {(
                  (data.reduce((sum, item) => sum + item.blocked, 0) /
                    data.reduce((sum, item) => sum + item.processed, 0)) *
                  100
                ).toFixed(1)}
                %
              </div>
            </div>
          </div>

          {/* 성능 지표 */}
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
            <h4 className="text-blue-400 font-mono text-sm mb-4">성능 지표</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-sm">
                  최고 정확도
                </span>
                <span className="text-green-400 font-mono text-sm">
                  {Math.max(...data.map((item) => item.accuracy))}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-sm">
                  최저 정확도
                </span>
                <span className="text-orange-400 font-mono text-sm">
                  {Math.min(...data.map((item) => item.accuracy))}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-sm">
                  처리량 변동성
                </span>
                <span className="text-blue-400 font-mono text-sm">
                  ±
                  {Math.round(
                    (Math.max(...data.map((item) => item.processed)) -
                      Math.min(...data.map((item) => item.processed))) /
                      2
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-sm">
                  평균 응답시간
                </span>
                <span className="text-purple-400 font-mono text-sm">1.2s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
