"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";

// Mock data for response recommendation system (inspired by EDR products)
const mockResponseData = {
  statistics: {
    activeThreats: 7,
    recommendedActions: 89,
    manualActions: 23,
    avgResponseTime: 2.3,
    successRate: 98.7,
    reportedIncidents: 12,
  },
  responseTypes: [
    {
      id: "isolation",
      name: "호스트 격리 제안",
      count: 15,
      color: "text-red-400",
      automated: true,
    },
    {
      id: "process-kill",
      name: "프로세스 종료 제안",
      count: 34,
      color: "text-orange-400",
      automated: true,
    },
    {
      id: "network-block",
      name: "네트워크 차단 제안",
      count: 28,
      color: "text-yellow-400",
      automated: false,
    },
    {
      id: "file-quarantine",
      name: "파일 격리 제안",
      count: 19,
      color: "text-green-400",
      automated: true,
    },
    {
      id: "rollback",
      name: "시스템 복구 제안",
      count: 8,
      color: "text-blue-400",
      automated: false,
    },
  ],
  activeIncidents: [
    {
      id: "incident-001",
      threat: "Ransomware Detection",
      severity: "CRITICAL",
      status: "INVESTIGATING",
      target: "WS-PROD-045",
      detectedAt: "2024-12-20 15:42:18",
      responseTime: "1.2초",
      actions: ["DETECTED", "REPORTED", "RECOMMENDATION_SENT"],
      description: "랜섬웨어 암호화 활동 탐지 및 대응 제안",
      mitreId: "T1486",
      autoResponse: false,
    },
    {
      id: "incident-002",
      threat: "Lateral Movement",
      severity: "HIGH",
      status: "MONITORING",
      target: "SRV-DB-012",
      detectedAt: "2024-12-20 15:38:45",
      responseTime: "0.8초",
      actions: ["DETECTED", "MONITORING", "RECOMMENDATION_SENT"],
      description: "측면 이동 시도 감지",
      mitreId: "T1021",
      autoResponse: false,
    },
    {
      id: "incident-003",
      threat: "Data Exfiltration",
      severity: "HIGH",
      status: "INVESTIGATING",
      target: "WS-DEV-021",
      detectedAt: "2024-12-20 15:35:12",
      responseTime: "2.1초",
      actions: ["NETWORK_MONITORED", "FILES_TRACKED"],
      description: "대용량 데이터 외부 전송 시도",
      mitreId: "T1041",
      autoResponse: false,
    },
    {
      id: "incident-004",
      threat: "Process Injection",
      severity: "MEDIUM",
      status: "INVESTIGATING",
      target: "WS-ADMIN-003",
      detectedAt: "2024-12-20 15:30:33",
      responseTime: "1.7초",
      actions: ["DETECTED", "ANALYZED", "RECOMMENDATION_SENT"],
      description: "프로세스 인젝션 기법 탐지 및 분석",
      mitreId: "T1055",
      autoResponse: false,
    },
  ],
  responseActions: [
    {
      id: "action-001",
      type: "ISOLATION_RECOMMENDATION",
      name: "호스트 격리 제안",
      description: "악성 활동 탐지 시 네트워크 격리 방안 제안",
      enabled: true,
      priority: 1,
      conditions: ["severity >= HIGH", "malware_detected", "lateral_movement"],
      avgExecutionTime: "0.5초",
      successRate: 99.2,
    },
    {
      id: "action-002",
      type: "PROCESS_TERMINATION_RECOMMENDATION",
      name: "프로세스 종료 제안",
      description: "의심스러운 프로세스 종료 방안 제안",
      enabled: true,
      priority: 2,
      conditions: [
        "process_injection",
        "code_injection",
        "suspicious_behavior",
      ],
      avgExecutionTime: "0.2초",
      successRate: 97.8,
    },
    {
      id: "action-003",
      type: "NETWORK_BLOCKING_RECOMMENDATION",
      name: "네트워크 차단 제안",
      description: "악성 IP/도메인 차단 방안 제안",
      enabled: true,
      priority: 3,
      conditions: ["c2_communication", "data_exfiltration", "malicious_domain"],
      avgExecutionTime: "1.1초",
      successRate: 98.5,
    },
    {
      id: "action-004",
      type: "FILE_QUARANTINE_RECOMMENDATION",
      name: "파일 격리 제안",
      description: "악성 파일 격리 방안 제안",
      enabled: true,
      priority: 4,
      conditions: ["malware_file", "suspicious_executable", "encrypted_file"],
      avgExecutionTime: "2.3초",
      successRate: 96.9,
    },
  ],
  playbooks: [
    {
      id: "playbook-001",
      name: "Ransomware Response Recommendations",
      description: "랜섬웨어 감염 시 대응 제안 플레이북",
      steps: 8,
      avgDuration: "5분",
      category: "malware",
      priority: "CRITICAL",
      enabled: true,
      executions: 12,
      successRate: 95.8,
    },
    {
      id: "playbook-002",
      name: "APT Detection Response Recommendations",
      description: "고급 지속 위협 탐지 시 대응 제안 절차",
      steps: 12,
      avgDuration: "15분",
      category: "apt",
      priority: "HIGH",
      enabled: true,
      executions: 7,
      successRate: 89.2,
    },
    {
      id: "playbook-003",
      name: "Insider Threat Mitigation Recommendations",
      description: "내부자 위협 완화 제안 절차",
      steps: 6,
      avgDuration: "8분",
      category: "insider",
      priority: "MEDIUM",
      enabled: false,
      executions: 3,
      successRate: 92.1,
    },
  ],
  recentActivity: [
    {
      timestamp: "15:45:23",
      action: "대응 제안 전송",
      target: "WS-PROD-045",
      status: "SUCCESS",
    },
    {
      timestamp: "15:44:12",
      action: "위협 분석 완료",
      target: "SRV-WEB-023",
      status: "SUCCESS",
    },
    {
      timestamp: "15:43:08",
      action: "보안 권고 발송",
      target: "외부IP-192.168.1.100",
      status: "SUCCESS",
    },
  ],
  recommendationLogs: [
    {
      id: "rec-001",
      timestamp: "2024-12-20 15:42:18",
      threat: "Ransomware Detection",
      target: "WS-PROD-045",
      severity: "CRITICAL",
      aiConfidence: 96.8,
      action: "HOST_ISOLATION_RECOMMENDED",
      actionReason: "악성 암호화 활동 탐지 및 측면 이동 위험성",
      ruleMatched: "RULE-RANSOMWARE-001",
      responseTime: "0.8초",
      status: "RECOMMENDED",
      impact: "보안팀에 격리 권고 전송, 분석 보고서 생성",
      followupRequired: true,
      mitreId: "T1486",
      evidenceFiles: ["encrypt.exe", "ransom.txt", "shadow_delete.bat"],
    },
    {
      id: "rec-002",
      timestamp: "2024-12-20 15:38:45",
      threat: "Lateral Movement Attempt",
      target: "SRV-DB-012",
      severity: "HIGH",
      aiConfidence: 89.3,
      action: "NETWORK_MONITORING_RECOMMENDED",
      actionReason: "비정상적인 네트워크 연결 패턴 및 권한 상승 시도",
      ruleMatched: "RULE-LATERAL-MOVEMENT-003",
      responseTime: "1.2초",
      status: "RECOMMENDED",
      impact: "네트워크 감시 권고 전송, 상세 분석 보고서 생성",
      followupRequired: true,
      mitreId: "T1021",
      evidenceFiles: ["psexec.exe", "net_commands.log"],
    },
    {
      id: "rec-003",
      timestamp: "2024-12-20 15:35:12",
      threat: "Process Injection",
      target: "WS-ADMIN-003",
      severity: "MEDIUM",
      aiConfidence: 82.1,
      action: "PROCESS_ANALYSIS_RECOMMENDED",
      actionReason: "DLL 인젝션 패턴 탐지, 메모리 조작 시도",
      ruleMatched: "RULE-PROCESS-INJECTION-002",
      responseTime: "0.5초",
      status: "RECOMMENDED",
      impact: "프로세스 분석 권고 전송, 메모리 덤프 생성",
      followupRequired: true,
      mitreId: "T1055",
      evidenceFiles: ["injected.dll", "memory_dump.bin"],
    },
  ],
  manualActionRequired: [
    {
      id: "manual-001",
      timestamp: "2024-12-20 15:40:33",
      threat: "Advanced Persistent Threat",
      target: "SRV-FILE-007",
      severity: "HIGH",
      aiConfidence: 67.4,
      whyNotAutomatic: "신뢰도 임계값 미달 (70% 미만)",
      riskAssessment: "복잡한 APT 공격 패턴, 오탐 가능성 존재",
      suggestedActions: [
        "상세 네트워크 트래픽 분석",
        "파일 시스템 무결성 검사",
        "사용자 계정 활동 로그 검토",
      ],
      priority: "HIGH",
      estimatedTimeToResolve: "30-45분",
      assignedTo: "보안팀",
      mitreId: "T1078",
      evidenceFiles: ["suspicious_login.log", "file_access.log"],
      aiRecommendation: "수동 조사 후 격리 여부 결정 권장",
    },
    {
      id: "manual-002",
      timestamp: "2024-12-20 15:35:21",
      threat: "Data Exfiltration Attempt",
      target: "WS-DEV-021",
      severity: "MEDIUM",
      aiConfidence: 74.2,
      whyNotAutomatic: "정책상 개발환경 자동차단 제한",
      riskAssessment: "개발 데이터 외부 전송, 업무 영향도 고려 필요",
      suggestedActions: [
        "전송 데이터 내용 확인",
        "사용자 의도 확인",
        "필요시 네트워크 제한 적용",
      ],
      priority: "MEDIUM",
      estimatedTimeToResolve: "15-20분",
      assignedTo: "IT팀",
      mitreId: "T1041",
      evidenceFiles: ["network_traffic.pcap", "file_transfer.log"],
      aiRecommendation: "사용자 확인 후 차단 여부 결정",
    },
    {
      id: "manual-003",
      timestamp: "2024-12-20 15:30:15",
      threat: "Privilege Escalation",
      target: "WS-FINANCE-012",
      severity: "HIGH",
      aiConfidence: 68.9,
      whyNotAutomatic: "금융 시스템 접근으로 오탐 영향도 높음",
      riskAssessment: "권한 상승 시도이나 정상 업무일 가능성 존재",
      suggestedActions: [
        "사용자 업무 패턴 확인",
        "권한 변경 이력 조사",
        "관리자 승인 하에 계정 제한",
      ],
      priority: "HIGH",
      estimatedTimeToResolve: "20-30분",
      assignedTo: "보안팀",
      mitreId: "T1548",
      evidenceFiles: ["privilege_change.log", "user_activity.log"],
      aiRecommendation: "즉시 조사 필요, 필요시 계정 일시 제한",
    },
  ],
};

export default function ResponsePage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [selectedAction, setSelectedAction] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const tabs = [
    { id: "overview", label: "통계 현황" },
    { id: "incidents", label: "활성 위협" },
    { id: "autoLogs", label: "대응 제안" },
    { id: "manualRequired", label: "전문가 검토" },
  ];

  const { isLoggedIn, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
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
      case "responding":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      case "monitoring":
        return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      case "investigating":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "recommended":
        return "text-blue-400 bg-blue-500/10 border-blue-500/30";
      case "contained":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

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
                  response-recommend://loading --threat-mitigation
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="text-cyan-400 font-mono text-sm mb-4">
                $ threat-response --load-recommendations --advisory
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-4 border-2 border-cyan-500/50 border-t-cyan-500 rounded-full animate-spin"></div>
                <span className="text-slate-300 font-mono text-sm">
                  대응 제안 시스템 로딩 중...
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-400">
                  {">"} Loading response recommendations
                </div>
                <div className="text-slate-400">
                  {">"} Initializing recommendation engine
                </div>
                <div className="text-slate-400">
                  {">"} Checking advisory systems
                </div>
                <div className="text-cyan-400 animate-pulse">
                  {">"} Activating response advisor...
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
              response-recommend://threat-mitigation --suggestions
            </span>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-4 text-sm font-mono mb-4">
              <span className="text-cyan-400">security@response:~$</span>
              <span className="text-slate-300">
                manage --response-recommendations --containment
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-cyan-400 font-mono mb-2">
                보안 대응 제안 센터
              </h1>
              <p className="text-slate-400 font-mono text-sm">
                위험 상황에 대한 대응 방안을 제안하고 관리하세요
              </p>
            </div>
          </div>
        </motion.div>

        {/* Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
        >
          {[
            {
              label: "활성 위협",
              value: mockResponseData.statistics.activeThreats,
              color: "text-red-400",
              desc: "현재 대응 중",
            },
            {
              label: "제안된 대응",
              value: mockResponseData.statistics.recommendedActions,
              color: "text-orange-400",
              desc: "24시간 내",
            },
            {
              label: "수동 조치",
              value: mockResponseData.statistics.manualActions,
              color: "text-yellow-400",
              desc: "수동 개입",
            },
            {
              label: "평균 대응시간",
              value: `${mockResponseData.statistics.avgResponseTime}초`,
              color: "text-green-400",
              desc: "제안 생성",
            },
            {
              label: "성공률",
              value: `${mockResponseData.statistics.successRate}%`,
              color: "text-blue-400",
              desc: "대응 성공",
            },
            {
              label: "신고된 사건",
              value: mockResponseData.statistics.reportedIncidents,
              color: "text-purple-400",
              desc: "보고됨",
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
              <div className={`text-xl font-bold font-mono ${stat.color} mb-1`}>
                {typeof stat.value === "number"
                  ? stat.value.toLocaleString()
                  : stat.value}
              </div>
              <div className="text-slate-500 text-xs font-mono">
                {stat.desc}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
        >
          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-slate-400 text-sm font-mono ml-2">
              response-navigator --tabs --configuration
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
              {/* Response Types */}
              <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
                <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-400 text-sm font-mono ml-2">
                    response-types --categories
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="text-orange-400 font-mono text-sm mb-4">
                    대응 유형별 통계
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mockResponseData.responseTypes.map((type, index) => (
                      <motion.div
                        key={type.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`font-mono font-medium ${type.color}`}>
                            {type.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm font-mono">
                              {type.count}회
                            </span>
                            {type.automated && (
                              <span className="text-xs px-2 py-1 rounded border bg-blue-500/10 border-blue-500/30 text-blue-400 font-mono">
                                제안
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${type.color.replace(
                              "text-",
                              "bg-"
                            )} rounded-full transition-all duration-500`}
                            style={{ width: `${(type.count / 40) * 100}%` }}
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
                    activity-log --recent-responses
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="text-orange-400 font-mono text-sm mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                    최근 대응 활동
                  </h3>
                  <div className="space-y-2">
                    {mockResponseData.recentActivity.map((activity, index) => (
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
                        <span className="text-cyan-400 font-mono text-xs">
                          {activity.action}
                        </span>
                        <span className="text-slate-300 font-mono text-xs flex-1">
                          {activity.target}
                        </span>
                        <span className="text-orange-400 font-mono text-xs">
                          {activity.status}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "incidents" && (
            <motion.div
              key="incidents"
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
                  incident-manager --active --real-time
                </span>
              </div>

              <div className="p-4">
                <div className="space-y-4">
                  {mockResponseData.activeIncidents.map((incident, index) => (
                    <motion.div
                      key={incident.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() =>
                        setSelectedIncident(
                          selectedIncident?.id === incident.id ? null : incident
                        )
                      }
                      className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-slate-300 font-mono font-medium">
                            {incident.threat}
                          </h3>
                          {incident.autoResponse && (
                            <span className="text-xs px-2 py-1 rounded border bg-blue-500/10 border-blue-500/30 text-blue-400 font-mono">
                              AUTO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-1 rounded border font-mono ${getSeverityColor(
                              incident.severity
                            )}`}
                          >
                            {incident.severity}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded border font-mono ${getStatusColor(
                              incident.status
                            )}`}
                          >
                            {incident.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-500 text-sm font-mono mb-3">
                        {incident.description}
                      </p>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400">
                            대상:{" "}
                            <span className="text-cyan-400">
                              {incident.target}
                            </span>
                          </span>
                          <span className="text-slate-400">
                            대응시간:{" "}
                            <span className="text-green-400">
                              {incident.responseTime}
                            </span>
                          </span>
                          <span className="text-slate-400">
                            MITRE:{" "}
                            <span className="text-purple-400">
                              {incident.mitreId}
                            </span>
                          </span>
                        </div>
                        <span className="text-slate-500">
                          탐지: {incident.detectedAt}
                        </span>
                      </div>

                      {selectedIncident?.id === incident.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-slate-700/50"
                        >
                          <div className="space-y-3">
                            <div>
                              <div className="text-slate-400 font-mono text-sm mb-2">
                                실행된 대응 조치
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {incident.actions.map(
                                  (action: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="text-xs px-2 py-1 rounded border bg-green-500/10 border-green-500/30 text-green-400 font-mono"
                                    >
                                      {action}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-blue-300 font-mono text-xs transition-colors">
                                상세 모니터링
                              </button>
                              <button className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded text-green-300 font-mono text-xs transition-colors">
                                분석 보고서
                              </button>
                              <button className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded text-purple-300 font-mono text-xs transition-colors">
                                전문가 상담
                              </button>
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

          {activeTab === "autoLogs" && (
            <motion.div
              key="autoLogs"
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
                  auto-response-logger --ai-decisions --execution-history
                </span>
              </div>

              <div className="p-4">
                <h3 className="text-cyan-400 font-mono text-lg mb-4">
                  보안 대응 제안 및 가이드
                </h3>
                <div className="space-y-4">
                  {mockResponseData.recommendationLogs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h4 className="text-blue-400 font-mono font-bold">
                            {log.threat}
                          </h4>
                          <span
                            className={`text-xs px-2 py-1 rounded border font-mono ${
                              log.severity === "CRITICAL"
                                ? "text-red-400 bg-red-500/10 border-red-500/30"
                                : log.severity === "HIGH"
                                ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
                                : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                            }`}
                          >
                            {log.severity}
                          </span>
                          <span className="text-blue-400 bg-blue-500/10 border border-blue-500/30 text-xs px-2 py-1 rounded font-mono">
                            제안
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-sm">
                          {log.timestamp}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-slate-400 font-mono text-xs mb-1">
                            대상 시스템
                          </div>
                          <div className="text-cyan-400 font-mono text-sm">
                            {log.target}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 font-mono text-xs mb-1">
                            위험도
                          </div>
                          <div className="text-green-400 font-mono text-sm">
                            {log.aiConfidence}%
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 font-mono text-xs mb-1">
                            적용 규칙
                          </div>
                          <div className="text-orange-400 font-mono text-sm">
                            {log.ruleMatched}
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-slate-400 font-mono text-xs mb-2">
                          권장 대응 조치 및 근거
                        </div>
                        <div className="text-slate-300 font-mono text-sm bg-slate-900/50 p-3 rounded border border-slate-600/30">
                          <div className="mb-3">
                            <span className="text-cyan-400 font-semibold">
                              권장 조치:{" "}
                            </span>
                            {log.action === "HOST_ISOLATION_RECOMMENDED" &&
                              "해당 시스템을 즉시 네트워크에서 분리"}
                            {log.action === "NETWORK_MONITORING_RECOMMENDED" &&
                              "네트워크 트래픽 실시간 모니터링 강화"}
                            {log.action === "PROCESS_ANALYSIS_RECOMMENDED" &&
                              "의심스러운 프로세스 상세 분석 실시"}
                          </div>
                          <div>
                            <span className="text-yellow-400 font-semibold">
                              근거:{" "}
                            </span>
                            {log.actionReason}
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-slate-400 font-mono text-xs mb-2">
                          구체적 대응 방법
                        </div>
                        <div className="text-slate-300 font-mono text-sm bg-slate-900/50 p-3 rounded border border-slate-600/30">
                          {log.action === "HOST_ISOLATION_RECOMMENDED" && (
                            <div className="space-y-2">
                              <div>
                                • 1단계: 네트워크 케이블 분리 또는 Wi-Fi 연결
                                해제
                              </div>
                              <div>
                                • 2단계: 현재 실행 중인 모든 프로그램 목록 확인
                              </div>
                              <div>• 3단계: 시스템 이벤트 로그 백업</div>
                              <div>• 4단계: 보안팀에 즉시 연락 (내선 1234)</div>
                            </div>
                          )}
                          {log.action === "NETWORK_MONITORING_RECOMMENDED" && (
                            <div className="space-y-2">
                              <div>
                                • 1단계: 방화벽 로그 실시간 모니터링 활성화
                              </div>
                              <div>
                                • 2단계: 의심스러운 IP 주소 차단 목록 확인
                              </div>
                              <div>• 3단계: 네트워크 트래픽 패턴 분석</div>
                              <div>• 4단계: 30분마다 상황 보고</div>
                            </div>
                          )}
                          {log.action === "PROCESS_ANALYSIS_RECOMMENDED" && (
                            <div className="space-y-2">
                              <div>
                                • 1단계: 작업 관리자에서 CPU/메모리 사용량 높은
                                프로세스 확인
                              </div>
                              <div>
                                • 2단계: Process Explorer로 상세 프로세스 트리
                                분석
                              </div>
                              <div>
                                • 3단계: 의심 프로세스의 파일 위치 및 디지털
                                서명 확인
                              </div>
                              <div>
                                • 4단계: 필요시 프로세스 메모리 덤프 생성
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400 font-mono text-xs">
                            MITRE ID:{" "}
                            <span className="text-red-400">{log.mitreId}</span>
                          </span>
                          <span className="text-slate-400 font-mono text-xs">
                            증거 파일:{" "}
                            <span className="text-blue-400">
                              {log.evidenceFiles.length}개
                            </span>
                          </span>
                        </div>
                        {log.followupRequired && (
                          <span className="text-xs px-2 py-1 rounded border bg-green-500/10 border-green-500/30 text-green-400 font-mono">
                            관리자 확인 필요
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "manualRequired" && (
            <motion.div
              key="manualRequired"
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
                  manual-intervention --pending-actions --analyst-required
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-cyan-400 font-mono text-lg">
                    전문가 검토 필요 항목
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-400 font-mono text-sm">
                      {mockResponseData.manualActionRequired.length}건 대기
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {mockResponseData.manualActionRequired.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 border-l-4 border-l-orange-500"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h4 className="text-orange-400 font-mono font-bold">
                            {item.threat}
                          </h4>
                          <span
                            className={`text-xs px-2 py-1 rounded border font-mono ${
                              item.priority === "HIGH"
                                ? "text-red-400 bg-red-500/10 border-red-500/30"
                                : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                            }`}
                          >
                            {item.priority}
                          </span>
                          <span className="text-purple-400 bg-purple-500/10 border border-purple-500/30 text-xs px-2 py-1 rounded font-mono">
                            검토
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-sm">
                          {item.timestamp}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-slate-400 font-mono text-xs mb-1">
                            대상 시스템
                          </div>
                          <div className="text-cyan-400 font-mono text-sm">
                            {item.target}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 font-mono text-xs mb-1">
                            복잡도 지수
                          </div>
                          <div className="text-yellow-400 font-mono text-sm">
                            {item.aiConfidence}% (고복잡도)
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 font-mono text-xs mb-1">
                            예상 처리시간
                          </div>
                          <div className="text-purple-400 font-mono text-sm">
                            {item.estimatedTimeToResolve}
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-slate-400 font-mono text-xs mb-2">
                          전문가 검토 필요사항
                        </div>
                        <div className="text-blue-300 font-mono text-sm bg-blue-500/5 p-3 rounded border border-blue-500/20">
                          {item.threat === "Advanced Persistent Threat" &&
                            "복잡한 APT 공격 패턴으로 다단계 분석과 전문가 판단이 필요합니다."}
                          {item.threat === "Data Exfiltration Attempt" &&
                            "개발 환경 특성상 정상 업무와 구분하기 위한 세밀한 분석이 필요합니다."}
                          {item.threat === "Privilege Escalation" &&
                            "금융 시스템 접근 권한 변경으로 업무 영향도를 고려한 신중한 검토가 필요합니다."}
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-slate-400 font-mono text-xs mb-2">
                          비즈니스 영향도 분석
                        </div>
                        <div className="text-slate-300 font-mono text-sm bg-slate-900/50 p-3 rounded border border-slate-600/30">
                          {item.threat === "Advanced Persistent Threat" &&
                            "파일 서버 침해 시 전사 업무 중단 위험. 단계적 대응으로 업무 연속성 보장 필요."}
                          {item.threat === "Data Exfiltration Attempt" &&
                            "개발 소스코드 유출 가능성. 지적재산권 보호와 개발 업무 지속성 균형 고려 필요."}
                          {item.threat === "Privilege Escalation" &&
                            "금융 거래 시스템 접근 권한 변경. 금융 규제 준수와 업무 중단 최소화 방안 필요."}
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-slate-400 font-mono text-xs mb-2">
                          권장 분석 절차
                        </div>
                        <div className="space-y-2">
                          {item.threat === "Advanced Persistent Threat" && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">•</span>
                                <span className="text-slate-300 font-mono text-sm">
                                  네트워크 트래픽 패턴 상세 분석
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">•</span>
                                <span className="text-slate-300 font-mono text-sm">
                                  파일 접근 이력 및 무결성 검사
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">•</span>
                                <span className="text-slate-300 font-mono text-sm">
                                  사용자 계정 활동 패턴 분석
                                </span>
                              </div>
                            </>
                          )}
                          {item.threat === "Data Exfiltration Attempt" && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">•</span>
                                <span className="text-slate-300 font-mono text-sm">
                                  전송 데이터 내용 및 목적지 확인
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">•</span>
                                <span className="text-slate-300 font-mono text-sm">
                                  개발자 업무 패턴과 비교 분석
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">•</span>
                                <span className="text-slate-300 font-mono text-sm">
                                  정상 업무 여부 사용자 확인
                                </span>
                              </div>
                            </>
                          )}
                          {item.threat === "Privilege Escalation" && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">•</span>
                                <span className="text-slate-300 font-mono text-sm">
                                  권한 변경 요청 내역 확인
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">•</span>
                                <span className="text-slate-300 font-mono text-sm">
                                  금융 규제 준수 사항 검토
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400">•</span>
                                <span className="text-slate-300 font-mono text-sm">
                                  관리자 승인 하에 임시 권한 제한
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-slate-400 font-mono text-xs mb-2">
                          전문가 검토 가이드
                        </div>
                        <div className="text-green-300 font-mono text-sm bg-green-500/5 p-3 rounded border border-green-500/20">
                          {item.threat === "Advanced Persistent Threat" &&
                            "보안 전문가와 시스템 관리자가 협력하여 단계적 대응 전략을 수립하세요. 업무 중단 최소화를 위해 우선순위를 정하여 진행하세요."}
                          {item.threat === "Data Exfiltration Attempt" &&
                            "개발팀장과 보안팀이 합동으로 해당 데이터의 민감도를 평가하고, 정상 업무 여부를 확인한 후 대응 방향을 결정하세요."}
                          {item.threat === "Privilege Escalation" &&
                            "정보보호 담당자와 준법감시인이 참여하여 금융 규제 위반 여부를 검토하고, 비즈니스 연속성을 고려한 대응 방안을 마련하세요."}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400 font-mono text-xs">
                            담당:{" "}
                            <span className="text-cyan-400">
                              {item.assignedTo}
                            </span>
                          </span>
                          <span className="text-slate-400 font-mono text-xs">
                            MITRE ID:{" "}
                            <span className="text-red-400">{item.mitreId}</span>
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-blue-300 font-mono text-xs transition-colors">
                            상세 분석 시작
                          </button>
                          <button className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded text-green-300 font-mono text-xs transition-colors">
                            전문가 배정
                          </button>
                          <button className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded text-yellow-300 font-mono text-xs transition-colors">
                            우선순위 변경
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
