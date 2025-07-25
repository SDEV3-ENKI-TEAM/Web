"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";

// Mock data for detection rules (inspired by EDR products)
const mockRulesData = {
  categories: [
    {
      id: "mitre-attack",
      name: "MITRE ATT&CK",
      count: 45,
      color: "text-red-400",
    },
    { id: "network", name: "네트워크 보안", count: 23, color: "text-blue-400" },
    {
      id: "file-integrity",
      name: "파일 무결성",
      count: 18,
      color: "text-green-400",
    },
    {
      id: "behavioral",
      name: "행동 분석",
      count: 34,
      color: "text-purple-400",
    },
    { id: "custom", name: "사용자 정의", count: 12, color: "text-cyan-400" },
  ],
  rules: [
    {
      id: "rule-001",
      name: "Suspicious PowerShell Execution",
      category: "mitre-attack",
      severity: "HIGH",
      status: "ACTIVE",
      description: "PowerShell 스크립트의 의심스러운 실행 패턴을 탐지",
      mitreId: "T1059.001",
      technique: "PowerShell",
      detections: 247,
      lastTriggered: "2024-12-20 14:30:15",
      threshold: 5,
      isCustom: false,
    },
    {
      id: "rule-002",
      name: "Lateral Movement Detection",
      category: "mitre-attack",
      severity: "CRITICAL",
      status: "ACTIVE",
      description: "네트워크 내부의 측면 이동 시도 탐지",
      mitreId: "T1021",
      technique: "Remote Services",
      detections: 89,
      lastTriggered: "2024-12-20 13:45:22",
      threshold: 3,
      isCustom: false,
    },
    {
      id: "rule-003",
      name: "Unusual File Access Pattern",
      category: "file-integrity",
      severity: "MEDIUM",
      status: "ACTIVE",
      description: "비정상적인 파일 접근 패턴 탐지",
      mitreId: "T1005",
      technique: "Data from Local System",
      detections: 156,
      lastTriggered: "2024-12-20 15:12:08",
      threshold: 10,
      isCustom: false,
    },
    {
      id: "rule-004",
      name: "Custom SQL Injection Detection",
      category: "custom",
      severity: "HIGH",
      status: "ACTIVE",
      description: "웹 애플리케이션 SQL 인젝션 공격 탐지",
      mitreId: "T1190",
      technique: "Exploit Public-Facing Application",
      detections: 43,
      lastTriggered: "2024-12-20 16:20:31",
      threshold: 1,
      isCustom: true,
    },
    {
      id: "rule-005",
      name: "Process Injection Detection",
      category: "behavioral",
      severity: "HIGH",
      status: "DISABLED",
      description: "프로세스 인젝션 기법 탐지",
      mitreId: "T1055",
      technique: "Process Injection",
      detections: 12,
      lastTriggered: "2024-12-19 22:15:44",
      threshold: 2,
      isCustom: false,
    },
  ],
  recentActivity: [
    {
      timestamp: "15:30:45",
      rule: "Suspicious PowerShell Execution",
      action: "DETECTED",
      target: "WS-DEV-001",
      severity: "HIGH",
    },
    {
      timestamp: "15:28:12",
      rule: "Custom SQL Injection Detection",
      action: "BLOCKED",
      target: "Web Server",
      severity: "HIGH",
    },
    {
      timestamp: "15:25:33",
      rule: "Unusual File Access Pattern",
      action: "LOGGED",
      target: "FILE-SRV-01",
      severity: "MEDIUM",
    },
  ],
  statistics: {
    totalRules: 132,
    activeRules: 118,
    disabledRules: 14,
    detections24h: 542,
    blocked24h: 89,
    highSeverity: 23,
    customRules: 12,
  },
};

export default function RulesPage() {
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs = [
    { id: "overview", label: "규칙 현황" },
    { id: "rules", label: "규칙 관리" },
    { id: "create", label: "규칙 생성" },
  ];

  const { isLoggedIn, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "text-red-500 bg-red-500/10 border-red-500/30";
      case "high":
        return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      case "medium":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "low":
        return "text-blue-400 bg-blue-500/10 border-blue-500/30";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      case "disabled":
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
      case "testing":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

  const filteredRules = mockRulesData.rules.filter((rule) => {
    const matchesCategory =
      selectedCategory === "all" || rule.category === selectedCategory;
    const matchesSearch =
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-xl animate-float"></div>
          <div className="absolute top-40 right-20 w-80 h-80 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-full blur-xl animate-float-delay-1"></div>
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-gradient-to-br from-green-500/15 to-blue-500/15 rounded-full blur-xl animate-float-delay-2"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-slate-400 text-sm font-mono">
                  rule-engine://loading --security-rules
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="text-cyan-400 font-mono text-sm mb-4">
                $ threat-detection --load-rules --mitre-attack
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-4 border-2 border-cyan-500/50 border-t-cyan-500 rounded-full animate-spin"></div>
                <span className="text-slate-300 font-mono text-sm">
                  위협 탐지 규칙 로딩 중...
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-400">
                  {">"} Loading MITRE ATT&CK rules
                </div>
                <div className="text-slate-400">
                  {">"} Validating rule syntax
                </div>
                <div className="text-slate-400">
                  {">"} Checking rule dependencies
                </div>
                <div className="text-cyan-400 animate-pulse">
                  {">"} Initializing rule engine...
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
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-xl animate-float"></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-full blur-xl animate-float-delay-1"></div>
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-gradient-to-br from-green-500/15 to-blue-500/15 rounded-full blur-xl animate-float-delay-2"></div>
      </div>

      <div className="relative z-10 p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
        >
          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-slate-400 text-sm font-mono ml-2">
              threat-detection://rule-manager --edr-style
            </span>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-4 text-sm font-mono mb-4">
              <span className="text-cyan-400">security@rules:~$</span>
              <span className="text-slate-300">
                manage --detection-rules --mitre-attack
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-cyan-400 font-mono mb-2">
                Threat Detection Rules
              </h1>
              <p className="text-slate-400 font-mono text-sm">
                어떤 상황을 위험으로 판단할지 설정하고 관리하세요
              </p>
            </div>
          </div>
        </motion.div>

        {/* Statistics Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            {
              label: "전체 규칙",
              value: mockRulesData.statistics.totalRules,
              color: "text-blue-400",
              desc: "총 탐지 규칙 수",
            },
            {
              label: "활성 규칙",
              value: mockRulesData.statistics.activeRules,
              color: "text-green-400",
              desc: "현재 동작 중",
            },
            {
              label: "24시간 탐지",
              value: mockRulesData.statistics.detections24h,
              color: "text-orange-400",
              desc: "금일 탐지 건수",
            },
            {
              label: "자동 차단",
              value: mockRulesData.statistics.blocked24h,
              color: "text-red-400",
              desc: "금일 차단 건수",
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
                {stat.value.toLocaleString()}
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

            {activeTab === "rules" && (
              <div className="flex gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="규칙 이름이나 설명으로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-slate-300 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Content based on active tab */}
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              {/* Rule Categories */}
              <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
                <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-400 text-sm font-mono ml-2">
                    rule-categories --mitre-taxonomy
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="text-orange-400 font-mono text-sm mb-4">
                    규칙 카테고리
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mockRulesData.categories.map((category, index) => (
                      <motion.div
                        key={category.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setActiveTab("rules");
                        }}
                        className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4
                            className={`font-mono font-medium ${category.color}`}
                          >
                            {category.name}
                          </h4>
                          <span className="text-slate-400 text-sm font-mono">
                            {category.count}개
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${category.color.replace(
                              "text-",
                              "bg-"
                            )} rounded-full transition-all duration-500`}
                            style={{ width: `${(category.count / 50) * 100}%` }}
                          ></div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
                <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-400 text-sm font-mono ml-2">
                    activity-monitor --recent-detections
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="text-orange-400 font-mono text-sm mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                    최근 탐지 활동
                  </h3>
                  <div className="space-y-2">
                    {mockRulesData.recentActivity.map((activity, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-4 p-3 bg-slate-800/30 rounded border border-slate-700/30"
                      >
                        <span className="text-slate-500 font-mono text-xs">
                          {activity.timestamp}
                        </span>
                        <span className="text-cyan-400 font-mono text-xs flex-1">
                          {activity.rule}
                        </span>
                        <span
                          className={`font-mono text-xs px-2 py-1 rounded border ${
                            activity.action === "BLOCKED"
                              ? "text-red-400 bg-red-500/10 border-red-500/30"
                              : activity.action === "DETECTED"
                              ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
                              : "text-blue-400 bg-blue-500/10 border-blue-500/30"
                          }`}
                        >
                          {activity.action}
                        </span>
                        <span className="text-slate-400 font-mono text-xs">
                          {activity.target}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "rules" && (
            <motion.div
              key="rules"
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
                  rule-list --filter={selectedCategory} --search="{searchQuery}"
                </span>
              </div>

              <div className="p-4">
                <div className="space-y-4">
                  {filteredRules.map((rule, index) => (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() =>
                        setSelectedRule(
                          selectedRule?.id === rule.id ? null : rule
                        )
                      }
                      className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-slate-300 font-mono font-medium">
                            {rule.name}
                          </h3>
                          {rule.isCustom && (
                            <span className="text-xs px-2 py-1 rounded border bg-purple-500/10 border-purple-500/30 text-purple-400 font-mono">
                              CUSTOM
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-1 rounded border font-mono ${getSeverityColor(
                              rule.severity
                            )}`}
                          >
                            {rule.severity}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded border font-mono ${getStatusColor(
                              rule.status
                            )}`}
                          >
                            {rule.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-500 text-sm font-mono mb-3">
                        {rule.description}
                      </p>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400">
                            MITRE:{" "}
                            <span className="text-cyan-400">
                              {rule.mitreId}
                            </span>
                          </span>
                          <span className="text-slate-400">
                            탐지:{" "}
                            <span className="text-green-400">
                              {rule.detections}
                            </span>
                          </span>
                          <span className="text-slate-400">
                            임계값:{" "}
                            <span className="text-blue-400">
                              {rule.threshold}
                            </span>
                          </span>
                        </div>
                        <span className="text-slate-500">
                          최근: {rule.lastTriggered}
                        </span>
                      </div>

                      {selectedRule?.id === rule.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-slate-700/50"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-slate-400 font-mono mb-2">
                                규칙 세부사항
                              </div>
                              <div className="space-y-1 text-xs font-mono">
                                <div>
                                  기법:{" "}
                                  <span className="text-cyan-400">
                                    {rule.technique}
                                  </span>
                                </div>
                                <div>
                                  카테고리:{" "}
                                  <span className="text-blue-400">
                                    {rule.category}
                                  </span>
                                </div>
                                <div>
                                  우선순위:{" "}
                                  <span className="text-purple-400">
                                    P{Math.floor(Math.random() * 3) + 1}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-400 font-mono mb-2">
                                제어 옵션
                              </div>
                              <div className="flex gap-2">
                                <button className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-blue-300 font-mono text-xs transition-colors">
                                  편집
                                </button>
                                <button className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded text-yellow-300 font-mono text-xs transition-colors">
                                  테스트
                                </button>
                                <button
                                  className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
                                    rule.status === "ACTIVE"
                                      ? "bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300"
                                      : "bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300"
                                  }`}
                                >
                                  {rule.status === "ACTIVE"
                                    ? "비활성화"
                                    : "활성화"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "create" && (
            <motion.div
              key="create"
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
                  rule-builder --custom --new
                </span>
              </div>

              <div className="p-6">
                <h3 className="text-orange-400 font-mono text-lg mb-6">
                  새 탐지 규칙 생성
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-400 font-mono text-sm mb-2">
                        규칙 이름
                      </label>
                      <input
                        type="text"
                        placeholder="Custom Detection Rule"
                        className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-slate-300 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-mono text-sm mb-2">
                        설명
                      </label>
                      <textarea
                        placeholder="규칙에 대한 상세 설명을 입력하세요"
                        rows={3}
                        className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-slate-300 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 font-mono text-sm mb-2">
                          심각도
                        </label>
                        <select className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-slate-300 font-mono text-sm focus:outline-none focus:border-cyan-500/50">
                          <option value="LOW">낮음</option>
                          <option value="MEDIUM">보통</option>
                          <option value="HIGH">높음</option>
                          <option value="CRITICAL">심각</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-mono text-sm mb-2">
                          카테고리
                        </label>
                        <select className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-slate-300 font-mono text-sm focus:outline-none focus:border-cyan-500/50">
                          <option value="custom">사용자 정의</option>
                          <option value="network">네트워크</option>
                          <option value="file-integrity">파일 무결성</option>
                          <option value="behavioral">행동 분석</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-400 font-mono text-sm mb-2">
                        탐지 조건 (YAML)
                      </label>
                      <textarea
                        placeholder={`detection:
  selection:
    EventID: 4688
    ProcessName|contains: 'powershell'
    CommandLine|contains: 
      - 'Invoke-Expression'
      - 'DownloadString'
  condition: selection`}
                        rows={8}
                        className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-slate-300 placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-cyan-500/50 resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded text-yellow-300 font-mono text-sm transition-colors">
                        구문 검증
                      </button>
                      <button className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded text-green-300 font-mono text-sm transition-colors">
                        규칙 생성
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
