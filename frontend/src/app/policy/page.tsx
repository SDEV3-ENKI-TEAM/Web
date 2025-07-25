"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";

// Mock data for security operations policies
const mockSecurityPolicyData = {
  securityPolicies: [
    {
      id: 1,
      name: "네트워크 보안 정책",
      category: "Network",
      enabled: true,
      severity: "Critical",
      description: "네트워크 트래픽 모니터링 및 침입 차단 정책",
      lastModified: "2024-12-20",
      status: "Active",
      coverage: 95,
      violations: 3,
      settings: {
        firewallEnabled: true,
        intrusionDetection: true,
        trafficAnalysis: true,
        portScanning: "blocked",
      },
    },
    {
      id: 2,
      name: "엔드포인트 보안 정책",
      category: "Endpoint",
      enabled: true,
      severity: "High",
      description: "엔드포인트 보호 및 악성코드 탐지 정책",
      lastModified: "2024-12-19",
      status: "Active",
      coverage: 98,
      violations: 1,
      settings: {
        antivirusEnabled: true,
        realTimeScanning: true,
        behaviorMonitoring: true,
        quarantineEnabled: true,
      },
    },
    {
      id: 3,
      name: "데이터 보호 정책",
      category: "Data",
      enabled: true,
      severity: "Critical",
      description: "민감한 데이터 암호화 및 접근 제어 정책",
      lastModified: "2024-12-18",
      status: "Active",
      coverage: 92,
      violations: 0,
      settings: {
        encryptionEnabled: true,
        accessLogging: true,
        dataClassification: true,
        backupEncryption: true,
      },
    },
    {
      id: 4,
      name: "웹 보안 정책",
      category: "Web",
      enabled: false,
      severity: "Medium",
      description: "웹 트래픽 필터링 및 악성 사이트 차단",
      lastModified: "2024-12-17",
      status: "Inactive",
      coverage: 0,
      violations: 0,
      settings: {
        urlFiltering: false,
        contentScanning: false,
        sslInspection: false,
        downloadControl: false,
      },
    },
  ],
  complianceRules: [
    {
      id: 1,
      name: "개인정보보호법 준수",
      framework: "PIPA",
      status: "Compliant",
      lastAudit: "2024-12-15",
      nextAudit: "2025-03-15",
      coverage: 100,
      issues: 0,
      requirements: [
        "개인정보 수집 동의",
        "데이터 암호화",
        "접근 로그 관리",
        "정보 파기 절차",
      ],
    },
    {
      id: 2,
      name: "정보보호 관리체계",
      framework: "ISMS-P",
      status: "Compliant",
      lastAudit: "2024-11-20",
      nextAudit: "2025-02-20",
      coverage: 95,
      issues: 2,
      requirements: ["관리체계 수립", "위험관리", "보호대책 구현", "모니터링"],
    },
    {
      id: 3,
      name: "산업보안 기준",
      framework: "ISO 27001",
      status: "Partial",
      lastAudit: "2024-10-10",
      nextAudit: "2025-01-10",
      coverage: 78,
      issues: 5,
      requirements: ["정보보안 정책", "위험 평가", "접근 통제", "암호화 관리"],
    },
  ],
  accessControl: [
    {
      role: "보안 관리자",
      users: 3,
      permissions: {
        policyManagement: true,
        threatResponse: true,
        userManagement: true,
        systemConfig: true,
        auditAccess: true,
      },
      restrictions: {
        maxSessions: 2,
        ipRestriction: true,
        mfaRequired: true,
        sessionTimeout: 30,
      },
    },
    {
      role: "보안 분석가",
      users: 8,
      permissions: {
        policyManagement: false,
        threatResponse: true,
        userManagement: false,
        systemConfig: false,
        auditAccess: true,
      },
      restrictions: {
        maxSessions: 3,
        ipRestriction: false,
        mfaRequired: true,
        sessionTimeout: 60,
      },
    },
    {
      role: "운영자",
      users: 15,
      permissions: {
        policyManagement: false,
        threatResponse: false,
        userManagement: false,
        systemConfig: true,
        auditAccess: false,
      },
      restrictions: {
        maxSessions: 1,
        ipRestriction: true,
        mfaRequired: false,
        sessionTimeout: 120,
      },
    },
  ],
  securityOperations: [
    {
      id: 1,
      procedure: "침해사고 대응 절차",
      category: "Incident Response",
      priority: "Critical",
      status: "Active",
      lastUpdate: "2024-12-20",
      steps: [
        "사고 탐지 및 식별",
        "초기 대응팀 구성",
        "영향 범위 분석",
        "격리 및 복구 조치",
        "사후 분석 및 보고",
      ],
      automation: 60,
      avgResponseTime: "15분",
    },
    {
      id: 2,
      procedure: "취약점 관리 절차",
      category: "Vulnerability Management",
      priority: "High",
      status: "Active",
      lastUpdate: "2024-12-18",
      steps: [
        "취약점 스캔 수행",
        "위험도 평가",
        "패치 우선순위 결정",
        "패치 배포 및 검증",
        "효과성 모니터링",
      ],
      automation: 40,
      avgResponseTime: "2시간",
    },
    {
      id: 3,
      procedure: "보안 모니터링 절차",
      category: "Security Monitoring",
      priority: "Medium",
      status: "Active",
      lastUpdate: "2024-12-17",
      steps: [
        "실시간 이벤트 수집",
        "이상 행위 탐지",
        "알림 생성 및 분류",
        "분석가 할당",
        "대응 조치 실행",
      ],
      automation: 80,
      avgResponseTime: "5분",
    },
  ],
};

export default function PolicyPage() {
  const [activeTab, setActiveTab] = useState("security");
  const [loading, setLoading] = useState(true);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  const { isLoggedIn, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    // Loading animation
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const tabs = [
    { id: "security", label: "보안 정책" },
    { id: "compliance", label: "컴플라이언스" },
    { id: "access", label: "접근 제어" },
    { id: "operations", label: "운영 관리" },
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
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-slate-400 text-sm font-mono">
                  security-policy://policy-manager --initializing
                </span>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="p-6">
              <div className="text-cyan-400 font-mono text-sm mb-4">
                $ policy-manager --security --compliance --access-control
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-4 h-4 border-2 border-cyan-500/50 border-t-cyan-500 rounded-full animate-spin"></div>
                <span className="text-slate-300 font-mono text-sm">
                  보안 정책 시스템 로딩 중...
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-400">
                  ✓ Loading security policy engine
                </div>
                <div className="text-slate-400">
                  ✓ Initializing compliance framework
                </div>
                <div className="text-slate-400">
                  ✓ Configuring access control systems
                </div>
                <div className="text-cyan-400 animate-pulse">
                  → Synchronizing operational procedures...
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <DashboardLayout onLogout={handleLogout}>
      {/* 3D Bubbles Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full blur-xl animate-float"></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-full blur-xl animate-float-delay-1"></div>
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-gradient-to-br from-green-500/15 to-blue-500/15 rounded-full blur-xl animate-float-delay-2"></div>
        <div className="absolute bottom-40 right-10 w-60 h-60 bg-gradient-to-br from-pink-500/20 to-yellow-500/20 rounded-full blur-xl animate-float-delay-3"></div>
      </div>

      <div className="relative z-10 p-6 space-y-6">
        {/* Terminal Header */}
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
              security-policy://policy-manager --edr-style
            </span>
          </div>

          {/* Command Interface */}
          <div className="p-4">
            <div className="flex items-center gap-4 text-sm font-mono mb-4">
              <span className="text-cyan-400">security@policy:~$</span>
              <span className="text-slate-300">
                manage --security-policies --compliance --access-control
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-cyan-400 font-mono mb-2">
                Security Policy Manager
              </h1>
              <p className="text-slate-400 font-mono text-sm">
                보안 정책과 컴플라이언스 규칙을 설정하고 관리하세요
              </p>
            </div>
          </div>
        </motion.div>

        {/* Policy Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 font-mono">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">ACTIVE POLICIES</p>
                <p className="text-2xl font-bold text-green-400">12</p>
              </div>
              <div className="text-green-400 text-sm">ONLINE</div>
            </div>
            <div className="mt-2">
              <span className="text-green-400 text-sm">+2 this week</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 font-mono">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">COMPLIANCE</p>
                <p className="text-2xl font-bold text-blue-400">91%</p>
              </div>
              <div className="text-blue-400 text-sm">PASS</div>
            </div>
            <div className="mt-2">
              <span className="text-blue-400 text-sm">compliance rate</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 font-mono">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">VIOLATIONS</p>
                <p className="text-2xl font-bold text-yellow-400">4</p>
              </div>
              <div className="text-yellow-400 text-sm">ALERT</div>
            </div>
            <div className="mt-2">
              <span className="text-yellow-400 text-sm">24h period</span>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 font-mono">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">AUTOMATION</p>
                <p className="text-2xl font-bold text-cyan-400">68%</p>
              </div>
              <div className="text-cyan-400 text-sm">AUTO</div>
            </div>
            <div className="mt-2">
              <span className="text-cyan-400 text-sm">policy enforcement</span>
            </div>
          </div>
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
              policy-navigator --tabs --configuration --management
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

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "security" && (
              <SecurityPolicies
                data={mockSecurityPolicyData.securityPolicies}
              />
            )}
            {activeTab === "compliance" && (
              <ComplianceRules data={mockSecurityPolicyData.complianceRules} />
            )}
            {activeTab === "access" && (
              <AccessControl data={mockSecurityPolicyData.accessControl} />
            )}
            {activeTab === "operations" && (
              <SecurityOperations
                data={mockSecurityPolicyData.securityOperations}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

// Security Policies Component
function SecurityPolicies({ data }: { data: any[] }) {
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
            security-policy-manager --policy-list --configuration
          </span>
        </div>
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-cyan-400 font-mono">
              보안 정책 관리
            </h2>
            <button className="bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-300 px-4 py-2 rounded-lg text-sm font-mono transition-colors">
              새 정책 추가
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="text-left p-4 text-slate-300 font-medium">
                  정책명
                </th>
                <th className="text-left p-4 text-slate-300 font-medium">
                  카테고리
                </th>
                <th className="text-left p-4 text-slate-300 font-medium">
                  심각도
                </th>
                <th className="text-left p-4 text-slate-300 font-medium">
                  상태
                </th>
                <th className="text-left p-4 text-slate-300 font-medium">
                  적용률
                </th>
                <th className="text-left p-4 text-slate-300 font-medium">
                  위반
                </th>
                <th className="text-left p-4 text-slate-300 font-medium">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((policy, index) => (
                <motion.tr
                  key={policy.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border-b border-slate-700 hover:bg-slate-700/50"
                >
                  <td className="p-4">
                    <div>
                      <div className="text-white font-medium">
                        {policy.name}
                      </div>
                      <div className="text-slate-400 text-sm">
                        {policy.description}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        policy.category === "Network"
                          ? "bg-blue-500/20 text-blue-400"
                          : policy.category === "Endpoint"
                          ? "bg-green-500/20 text-green-400"
                          : policy.category === "Data"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {policy.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        policy.severity === "Critical"
                          ? "bg-red-500/20 text-red-400"
                          : policy.severity === "High"
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {policy.severity}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        policy.enabled
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {policy.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-slate-600 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            policy.coverage >= 90
                              ? "bg-green-400"
                              : policy.coverage >= 70
                              ? "bg-yellow-400"
                              : "bg-red-400"
                          }`}
                          style={{ width: `${policy.coverage}%` }}
                        ></div>
                      </div>
                      <span className="text-slate-300 text-sm">
                        {policy.coverage}%
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`font-medium ${
                        policy.violations === 0
                          ? "text-green-400"
                          : policy.violations <= 2
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {policy.violations}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex space-x-2">
                      <button className="text-cyan-400 hover:text-cyan-300 text-sm">
                        편집
                      </button>
                      <button
                        className={`text-sm ${
                          policy.enabled
                            ? "text-orange-400 hover:text-orange-300"
                            : "text-green-400 hover:text-green-300"
                        }`}
                      >
                        {policy.enabled ? "비활성화" : "활성화"}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Compliance Rules Component
function ComplianceRules({ data }: { data: any[] }) {
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
            compliance-manager --frameworks --audit --monitoring
          </span>
        </div>
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-cyan-400 font-mono">
              컴플라이언스 관리
            </h2>
            <button className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 px-4 py-2 rounded-lg text-sm font-mono transition-colors">
              규정 추가
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {data.map((rule, index) => (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-slate-800/30 rounded-lg p-5 border border-slate-600/30 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {rule.name}
                  </h3>
                  <p className="text-slate-400">프레임워크: {rule.framework}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    rule.status === "Compliant"
                      ? "bg-green-500/20 text-green-400"
                      : rule.status === "Partial"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {rule.status === "Compliant"
                    ? "준수"
                    : rule.status === "Partial"
                    ? "부분 준수"
                    : "미준수"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-slate-400 text-sm">적용률</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex-1 bg-slate-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          rule.coverage >= 90
                            ? "bg-green-400"
                            : rule.coverage >= 70
                            ? "bg-yellow-400"
                            : "bg-red-400"
                        }`}
                        style={{ width: `${rule.coverage}%` }}
                      ></div>
                    </div>
                    <span className="text-white text-sm">{rule.coverage}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">이슈</p>
                  <p
                    className={`text-lg font-bold ${
                      rule.issues === 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {rule.issues}개
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">다음 감사</p>
                  <p className="text-white">{rule.nextAudit}</p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-3">요구사항</p>
                <div className="flex flex-wrap gap-2">
                  {rule.requirements.map((req: string, reqIndex: number) => (
                    <span
                      key={reqIndex}
                      className="bg-slate-600 text-slate-300 px-2 py-1 rounded text-sm"
                    >
                      {req}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Access Control Component
function AccessControl({ data }: { data: any[] }) {
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
            access-control --roles --permissions --restrictions
          </span>
        </div>
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-cyan-400 font-mono">
              접근 제어 관리
            </h2>
            <button className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300 px-4 py-2 rounded-lg text-sm font-mono transition-colors">
              역할 추가
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {data.map((role, index) => (
            <motion.div
              key={role.role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-slate-800/30 rounded-lg p-5 border border-slate-600/30 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {role.role}
                  </h3>
                  <p className="text-slate-400">{role.users}명의 사용자</p>
                </div>
                <div className="flex space-x-2">
                  <button className="text-cyan-400 hover:text-cyan-300 text-sm">
                    편집
                  </button>
                  <button className="text-red-400 hover:text-red-300 text-sm">
                    삭제
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-medium mb-3">권한</h4>
                  <div className="space-y-2">
                    {Object.entries(role.permissions).map(
                      ([permission, allowed]) => (
                        <div
                          key={permission}
                          className="flex items-center justify-between"
                        >
                          <span className="text-slate-300 text-sm">
                            {permission === "policyManagement"
                              ? "정책 관리"
                              : permission === "threatResponse"
                              ? "위협 대응"
                              : permission === "userManagement"
                              ? "사용자 관리"
                              : permission === "systemConfig"
                              ? "시스템 설정"
                              : permission === "auditAccess"
                              ? "감사 로그"
                              : permission}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              allowed
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {allowed ? "허용" : "차단"}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-3">제한사항</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">최대 세션</span>
                      <span className="text-white">
                        {role.restrictions.maxSessions}개
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">IP 제한</span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          role.restrictions.ipRestriction
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-green-500/20 text-green-400"
                        }`}
                      >
                        {role.restrictions.ipRestriction ? "적용" : "없음"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">다중 인증</span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          role.restrictions.mfaRequired
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {role.restrictions.mfaRequired ? "필수" : "선택"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">
                        세션 타임아웃
                      </span>
                      <span className="text-white">
                        {role.restrictions.sessionTimeout}분
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Security Operations Component
function SecurityOperations({ data }: { data: any[] }) {
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
            security-operations --procedures --automation --monitoring
          </span>
        </div>
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-cyan-400 font-mono">
              보안 운영 절차
            </h2>
            <button className="bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-300 px-4 py-2 rounded-lg text-sm font-mono transition-colors">
              절차 추가
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {data.map((procedure, index) => (
            <motion.div
              key={procedure.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-slate-800/30 rounded-lg p-5 border border-slate-600/30 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {procedure.procedure}
                  </h3>
                  <p className="text-slate-400">{procedure.category}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      procedure.priority === "Critical"
                        ? "bg-red-500/20 text-red-400"
                        : procedure.priority === "High"
                        ? "bg-orange-500/20 text-orange-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {procedure.priority === "Critical"
                      ? "매우 중요"
                      : procedure.priority === "High"
                      ? "중요"
                      : "보통"}
                  </span>
                  <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                    {procedure.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-slate-400 text-sm">자동화율</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex-1 bg-slate-600 rounded-full h-2">
                      <div
                        className="bg-cyan-400 h-2 rounded-full"
                        style={{ width: `${procedure.automation}%` }}
                      ></div>
                    </div>
                    <span className="text-white text-sm">
                      {procedure.automation}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">평균 대응시간</p>
                  <p className="text-lg font-bold text-white">
                    {procedure.avgResponseTime}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">최근 업데이트</p>
                  <p className="text-white">{procedure.lastUpdate}</p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-3">절차 단계</p>
                <div className="space-y-2">
                  {procedure.steps.map((step: string, stepIndex: number) => (
                    <div
                      key={stepIndex}
                      className="flex items-center space-x-3"
                    >
                      <div className="flex-shrink-0 w-6 h-6 bg-cyan-600 text-white rounded-full flex items-center justify-center text-xs">
                        {stepIndex + 1}
                      </div>
                      <span className="text-slate-300">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
