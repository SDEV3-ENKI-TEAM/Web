"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";

// Mock data for agents
const mockAgentData = {
  overview: {
    totalAgents: 247,
    onlineAgents: 234,
    offlineAgents: 13,
    criticalAlerts: 3,
    eventsPerSecond: 1247,
    lastUpdated: new Date(),
  },
  agents: [
    {
      id: "agent-001",
      hostname: "WS-DEV-001",
      ip: "192.168.1.100",
      os: "Windows 11 Pro",
      version: "v2.1.3",
      status: "online",
      lastSeen: "2024-12-20 15:30:00",
      events: 1247,
      cpu: 12,
      memory: 256,
      location: "Seoul Office",
      threats: 0,
    },
    {
      id: "agent-002",
      hostname: "SRV-PROD-001",
      ip: "192.168.1.50",
      os: "Ubuntu 22.04 LTS",
      version: "v2.1.3",
      status: "online",
      lastSeen: "2024-12-20 15:29:45",
      events: 2156,
      cpu: 8,
      memory: 512,
      location: "Data Center",
      threats: 1,
    },
    {
      id: "agent-003",
      hostname: "WS-SEC-003",
      ip: "192.168.1.150",
      os: "Windows 10 Enterprise",
      version: "v2.1.2",
      status: "warning",
      lastSeen: "2024-12-20 15:25:12",
      events: 89,
      cpu: 25,
      memory: 128,
      location: "Security Lab",
      threats: 2,
    },
    {
      id: "agent-004",
      hostname: "MAC-EXEC-004",
      ip: "192.168.1.200",
      os: "macOS Sonoma",
      version: "v2.1.1",
      status: "offline",
      lastSeen: "2024-12-20 12:15:30",
      events: 0,
      cpu: 0,
      memory: 0,
      location: "Executive Floor",
      threats: 0,
    },
    {
      id: "agent-005",
      hostname: "LNX-WEB-005",
      ip: "192.168.1.75",
      os: "CentOS 8",
      version: "v2.1.3",
      status: "online",
      lastSeen: "2024-12-20 15:30:05",
      events: 3421,
      cpu: 15,
      memory: 1024,
      location: "Web Server Farm",
      threats: 0,
    },
  ],
  recentEvents: [
    {
      timestamp: "15:30:12",
      agent: "WS-SEC-003",
      event: "의심스러운 프로그램 실행이 감지되었습니다",
      severity: "high",
      action: "격리 완료",
    },
    {
      timestamp: "15:29:45",
      agent: "SRV-PROD-001",
      event: "위험한 사이트로의 접속 시도가 차단되었습니다",
      severity: "medium",
      action: "접속 차단",
    },
    {
      timestamp: "15:28:30",
      agent: "WS-DEV-001",
      event: "시스템 폴더의 파일이 수정되었습니다",
      severity: "low",
      action: "기록 완료",
    },
    {
      timestamp: "15:27:15",
      agent: "LNX-WEB-005",
      event: "잘못된 비밀번호로 로그인을 여러 번 시도했습니다",
      severity: "medium",
      action: "경고 발송",
    },
  ],
};

export default function AgentsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showGuide, setShowGuide] = useState(false);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      case "offline":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "warning":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-red-400";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-blue-400";
      default:
        return "text-slate-400";
    }
  };

  const filteredAgents = mockAgentData.agents.filter((agent) => {
    const matchesSearch =
      agent.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.ip.includes(searchQuery) ||
      agent.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center relative">
        {/* Loading animation */}
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
                  PC 보안 관리 - 모든 컴퓨터 상태 확인 중
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="text-cyan-400 font-mono text-sm mb-4">
                $ 컴퓨터 찾기 및 보안 상태 확인 중...
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-4 border-2 border-cyan-500/50 border-t-cyan-500 rounded-full animate-spin"></div>
                <span className="text-slate-300 font-mono text-sm">
                  연결된 컴퓨터들을 확인하는 중...
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-400">
                  {">"} 네트워크에 연결된 컴퓨터 찾는 중
                </div>
                <div className="text-slate-400">
                  {">"} 각 컴퓨터의 보안 상태 확인 중
                </div>
                <div className="text-slate-400">
                  {">"} 성능 및 위험 요소 분석 중
                </div>
                <div className="text-cyan-400 animate-pulse">
                  {">"} PC 관리 화면 준비 중...
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
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 backdrop-blur-md border border-blue-500/30 rounded-lg p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                PC 관리 센터
              </h1>
              <p className="text-slate-300 text-sm">
                회사 내 모든 컴퓨터의 보안 상태를 실시간으로 관리하고
                모니터링합니다
              </p>
            </div>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors"
            >
              {showGuide ? "가이드 접기" : "초보자 가이드"}
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
              className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
            >
              <div className="p-6">
                <h2 className="text-lg font-bold text-cyan-400 mb-4">
                  PC 관리 센터 사용법
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-md font-semibold text-white mb-3">
                      주요 기능 설명
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-blue-400">•</span>
                        <div>
                          <div className="font-semibold text-blue-400">
                            실시간 상태 모니터링
                          </div>
                          <div className="text-sm text-slate-400">
                            회사 내 모든 컴퓨터의 연결 상태와 보안 상황을
                            실시간으로 확인할 수 있습니다
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-green-400">•</span>
                        <div>
                          <div className="font-semibold text-green-400">
                            빠른 검색 및 필터링
                          </div>
                          <div className="text-sm text-slate-400">
                            컴퓨터명, IP 주소, 위치로 원하는 컴퓨터를 빠르게
                            찾을 수 있습니다
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-yellow-400">•</span>
                        <div>
                          <div className="font-semibold text-yellow-400">
                            위험 상황 조기 감지
                          </div>
                          <div className="text-sm text-slate-400">
                            보안 위협이나 문제가 발생한 컴퓨터를 즉시 파악하고
                            대응할 수 있습니다
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-md font-semibold text-white mb-3">
                      이 화면 사용법
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="font-semibold text-green-400 mb-1">
                          1. 전체 현황 확인
                        </div>
                        <div className="text-slate-400">
                          상단 통계에서 전체 컴퓨터 수와 연결 상태를 확인하세요
                        </div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="font-semibold text-blue-400 mb-1">
                          2. 컴퓨터 목록 보기
                        </div>
                        <div className="text-slate-400">
                          목록에서 각 컴퓨터의 상세 정보와 보안 상태를
                          확인하세요
                        </div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="font-semibold text-purple-400 mb-1">
                          3. 상세 정보 확인
                        </div>
                        <div className="text-slate-400">
                          컴퓨터를 클릭하면 성능 정보와 보안 프로그램 상태를 볼
                          수 있습니다
                        </div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="font-semibold text-yellow-400 mb-1">
                          4. 원격 관리
                        </div>
                        <div className="text-slate-400">
                          필요시 재시작이나 업데이트를 원격으로 실행할 수
                          있습니다
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Terminal Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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
              PC 관리 모니터링 시스템
            </span>
          </div>

          {/* Command Interface */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-4 text-sm font-mono">
              <span className="text-blue-400">PC관리@보안센터:~$</span>
              <div className="flex items-center gap-4 flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="컴퓨터명, IP 주소, 위치로 검색..."
                  className="flex-1 bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500/50"
                >
                  <option value="all">모든 컴퓨터</option>
                  <option value="online">정상 연결</option>
                  <option value="offline">연결 끊김</option>
                  <option value="warning">주의 필요</option>
                </select>
                <button
                  onClick={() =>
                    setViewMode(viewMode === "grid" ? "list" : "grid")
                  }
                  className="bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  {viewMode === "grid" ? "목록으로 보기" : "격자로 보기"}
                </button>
              </div>
            </div>

            {/* Status Info */}
            <div className="flex items-center gap-6 text-xs font-mono">
              <span className="text-slate-400">
                총 컴퓨터 수:{" "}
                <span className="text-cyan-400">
                  {mockAgentData.overview.totalAgents}
                </span>
              </span>
              <span className="text-slate-400">
                정상 연결:{" "}
                <span className="text-green-400">
                  {mockAgentData.overview.onlineAgents}
                </span>
              </span>
              <span className="text-slate-400">
                연결 끊김:{" "}
                <span className="text-red-400">
                  {mockAgentData.overview.offlineAgents}
                </span>
              </span>
              <span className="text-slate-400">
                모니터링 상태: <span className="text-green-400">정상 작동</span>
              </span>
            </div>
          </div>
        </motion.div>

        {/* Overview Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          {[
            {
              label: "전체 컴퓨터",
              value: mockAgentData.overview.totalAgents,
              color: "text-blue-400",
              description: "관리 중인 모든 컴퓨터 수",
            },
            {
              label: "정상 연결",
              value: mockAgentData.overview.onlineAgents,
              color: "text-green-400",
              description: "현재 온라인 상태인 컴퓨터",
            },
            {
              label: "연결 끊김",
              value: mockAgentData.overview.offlineAgents,
              color: "text-red-400",
              description: "오프라인 상태인 컴퓨터",
            },
            {
              label: "위험 경고",
              value: mockAgentData.overview.criticalAlerts,
              color: "text-yellow-400",
              description: "즉시 조치가 필요한 위험 상황",
            },
            {
              label: "보안 활동",
              value: mockAgentData.overview.eventsPerSecond,
              color: "text-purple-400",
              description: "초당 처리되는 보안 이벤트 수",
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
              <div className={`text-2xl font-bold font-mono ${stat.color}`}>
                {stat.value.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {stat.description}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Agents List/Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
        >
          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-slate-400 text-sm font-mono ml-2">
              컴퓨터 목록 - 상태 및 성능 정보 실시간 확인
            </span>
          </div>

          <div className="p-4">
            {viewMode === "list" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left py-3 px-4 text-slate-400 font-mono">
                        컴퓨터명
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-mono">
                        IP 주소
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-mono">
                        운영체제
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-mono">
                        연결 상태
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-mono">
                        보안 프로그램
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-mono">
                        위치
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-mono">
                        보안 활동
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-mono">
                        발견된 위협
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent, index) => (
                      <motion.tr
                        key={agent.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => setSelectedAgent(agent)}
                        className="border-b border-slate-700/30 hover:bg-slate-800/30 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 text-slate-300 font-mono">
                          {agent.hostname}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {agent.ip}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {agent.os}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2 py-1 rounded border font-mono w-16 text-center inline-block ${getStatusColor(
                              agent.status
                            )}`}
                          >
                            {agent.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {agent.version}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {agent.location}
                        </td>
                        <td className="py-3 px-4 text-cyan-400 font-mono">
                          {agent.events.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-mono ${
                              agent.threats > 0
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          >
                            {agent.threats}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAgents.map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedAgent(agent)}
                    className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-slate-300 font-mono font-medium">
                        {agent.hostname}
                      </h3>
                      <span
                        className={`text-xs px-2 py-1 rounded border font-mono w-16 text-center inline-block ${getStatusColor(
                          agent.status
                        )}`}
                      >
                        {agent.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">IP:</span>
                        <span className="text-slate-400 font-mono">
                          {agent.ip}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">OS:</span>
                        <span className="text-slate-400 font-mono">
                          {agent.os}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">이벤트:</span>
                        <span className="text-cyan-400 font-mono">
                          {agent.events.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">위협:</span>
                        <span
                          className={`font-mono ${
                            agent.threats > 0
                              ? "text-red-400"
                              : "text-green-400"
                          }`}
                        >
                          {agent.threats}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
        >
          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-slate-400 text-sm font-mono ml-2">
              실시간 보안 활동 - 최근 발생한 보안 이벤트 확인
            </span>
          </div>

          <div className="p-4">
            <h3 className="text-orange-400 font-mono text-sm mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
              최근 보안 활동 기록
            </h3>
            <div className="space-y-2">
              {mockAgentData.recentEvents.map((event, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-3 bg-slate-800/30 rounded border border-slate-700/30"
                >
                  <span className="text-slate-500 font-mono text-xs">
                    {event.timestamp}
                  </span>
                  <span className="text-cyan-400 font-mono text-xs">
                    {event.agent}
                  </span>
                  <span className="text-slate-300 font-mono text-xs flex-1">
                    {event.event}
                  </span>
                  <span
                    className={`font-mono text-xs ${getSeverityColor(
                      event.severity
                    )}`}
                  >
                    {event.severity.toUpperCase()}
                  </span>
                  <span className="text-slate-400 font-mono text-xs">
                    {event.action}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Agent Detail Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedAgent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900/95 border border-slate-700/50 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-400 text-sm font-mono ml-2">
                    컴퓨터 상세 정보 - {selectedAgent.hostname}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <h2 className="text-xl font-bold text-cyan-400 font-mono mb-4">
                  {selectedAgent.hostname}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-slate-400 font-mono text-sm mb-2">
                        기본 정보
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">IP 주소:</span>
                          <span className="text-slate-300 font-mono">
                            {selectedAgent.ip}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">운영체제:</span>
                          <span className="text-slate-300 font-mono">
                            {selectedAgent.os}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">버전:</span>
                          <span className="text-slate-300 font-mono">
                            {selectedAgent.version}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">위치:</span>
                          <span className="text-slate-300 font-mono">
                            {selectedAgent.location}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">마지막 연결:</span>
                          <span className="text-slate-300 font-mono">
                            {selectedAgent.lastSeen}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-slate-400 font-mono text-sm mb-2">
                        성능 정보
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">CPU 사용률:</span>
                          <span className="text-cyan-400 font-mono">
                            {selectedAgent.cpu}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">메모리 사용량:</span>
                          <span className="text-cyan-400 font-mono">
                            {selectedAgent.memory}MB
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">처리된 이벤트:</span>
                          <span className="text-cyan-400 font-mono">
                            {selectedAgent.events.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">탐지된 위협:</span>
                          <span
                            className={`font-mono ${
                              selectedAgent.threats > 0
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          >
                            {selectedAgent.threats}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-2">
                  <button className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-blue-300 font-mono text-sm transition-colors">
                    재시작
                  </button>
                  <button className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded text-green-300 font-mono text-sm transition-colors">
                    업데이트
                  </button>
                  <button className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded text-yellow-300 font-mono text-sm transition-colors">
                    격리
                  </button>
                  <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded text-red-300 font-mono text-sm transition-colors">
                    제거
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
