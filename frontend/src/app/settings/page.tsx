"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

interface SettingOption {
  value: string;
  label: string;
}

interface Setting {
  name: string;
  description: string;
  type: "toggle" | "select" | "text";
  value: any;
  key: string;
  options?: SettingOption[];
  placeholder?: string;
}

const settingsCategories = [
  {
    id: "security",
    name: "보안 설정",
    description: "기본 보안 기능 설정",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: "•",
    settings: [
      {
        name: "실시간 보안 검사",
        description: "파일을 열거나 프로그램을 실행할 때 실시간으로 검사합니다",
        type: "toggle",
        value: true,
        key: "realtime_scan",
      },
      {
        name: "보안 검사 강도",
        description: "높을수록 더 철저하게 검사하지만 속도가 느려집니다",
        type: "select",
        value: "medium",
        options: [
          { value: "low", label: "낮음 (빠름)" },
          { value: "medium", label: "보통 (권장)" },
          { value: "high", label: "높음 (느림)" },
        ],
        key: "scan_level",
      },
    ],
  },
  {
    id: "notifications",
    name: "알림 설정",
    description: "보안 알림 및 Slack 연동 설정",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    icon: "•",
    settings: [
      {
        name: "위험 알림",
        description: "위험한 상황이 발생했을 때 알림을 받습니다",
        type: "toggle",
        value: true,
        key: "danger_alerts",
      },
      {
        name: "주의 알림",
        description: "의심스러운 활동이 감지되었을 때 알림을 받습니다",
        type: "toggle",
        value: true,
        key: "warning_alerts",
      },
      {
        name: "알림 표시 방법",
        description: "알림을 어떻게 표시할지 선택하세요",
        type: "select",
        value: "popup",
        options: [
          { value: "popup", label: "팝업 창" },
          { value: "notification", label: "시스템 알림" },
          { value: "both", label: "둘 다" },
        ],
        key: "notification_type",
      },
      {
        name: "Slack 알림 연동",
        description: "Slack으로 보안 알림을 전송합니다",
        type: "toggle",
        value: false,
        key: "slack_enabled",
      },
      {
        name: "Slack 웹훅 URL",
        description: "Slack 채널의 웹훅 URL을 입력하세요",
        type: "text",
        value: "",
        placeholder: "https://hooks.slack.com/services/...",
        key: "slack_webhook_url",
      },
      {
        name: "Slack 채널명",
        description: "알림을 받을 Slack 채널명을 입력하세요",
        type: "text",
        value: "#security-alerts",
        placeholder: "#security-alerts",
        key: "slack_channel",
      },
      {
        name: "Slack 알림 종류",
        description: "Slack으로 보낼 알림의 종류를 선택하세요",
        type: "select",
        value: "critical",
        options: [
          { value: "all", label: "모든 알림" },
          { value: "critical", label: "위험 알림만" },
          { value: "critical_warning", label: "위험+주의 알림" },
        ],
        key: "slack_alert_level",
      },
    ],
  },
  {
    id: "system",
    name: "시스템 설정",
    description: "프로그램 동작 및 관리 설정",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    icon: "•",
    settings: [
      {
        name: "윈도우 시작 시 자동 실행",
        description: "컴퓨터를 켤 때 보안 프로그램을 자동으로 시작합니다",
        type: "toggle",
        value: true,
        key: "auto_start",
      },
      {
        name: "자동 업데이트",
        description: "새로운 보안 정의 파일을 자동으로 업데이트합니다",
        type: "toggle",
        value: true,
        key: "auto_update",
      },
      {
        name: "자동 설정 백업",
        description: "설정 변경 시 자동으로 백업을 생성합니다",
        type: "toggle",
        value: true,
        key: "auto_backup",
      },
      {
        name: "CPU 사용량 제한",
        description: "보안 검사 시 CPU 사용량을 제한합니다",
        type: "select",
        value: "medium",
        options: [
          { value: "low", label: "낮음 (성능 우선)" },
          { value: "medium", label: "보통 (균형)" },
          { value: "high", label: "높음 (보안 우선)" },
        ],
        key: "cpu_limit",
      },
    ],
  },
];

export default function SettingsPage() {
  const { isLoggedIn, logout, isLoading } = useAuth();
  const router = useRouter();
  const [showGuide, setShowGuide] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    router.push("/login");
    return null;
  }

  const handleSettingChange = (
    categoryId: string,
    settingKey: string,
    value: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      [`${categoryId}_${settingKey}`]: value,
    }));
    setHasChanges(true);
  };

  const handleSaveSettings = () => {
    console.log("Settings saved:", settings);
    setHasChanges(false);
  };

  const handleResetSettings = () => {
    if (confirm("모든 설정을 기본값으로 되돌리시겠습니까?")) {
      setSettings({});
      setHasChanges(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <Header onLogout={logout} />

      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 p-6 space-y-6">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 backdrop-blur-md border border-blue-500/30 rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  설정 센터
                </h1>
                <p className="text-slate-300 text-sm">
                  보안 프로그램의 동작을 사용자에게 맞게 설정하고 관리하세요
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
                    설정 센터 사용법
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-md font-semibold text-white mb-3">
                        설정 카테고리 설명
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                          <span className="text-red-400">•</span>
                          <div>
                            <div className="font-semibold text-red-400">
                              보안 설정
                            </div>
                            <div className="text-sm text-slate-400">
                              실시간 검사, 검사 강도 등 기본 보안 기능을
                              설정합니다
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                          <span className="text-blue-400">•</span>
                          <div>
                            <div className="font-semibold text-blue-400">
                              알림 설정
                            </div>
                            <div className="text-sm text-slate-400">
                              위험 상황 알림 및 Slack 연동을 설정합니다
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                          <span className="text-green-400">•</span>
                          <div>
                            <div className="font-semibold text-green-400">
                              시스템 설정
                            </div>
                            <div className="text-sm text-slate-400">
                              자동 실행, 업데이트, 백업 등 시스템 관리를
                              설정합니다
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
                            1. 설정 확인
                          </div>
                          <div className="text-slate-400">
                            아래로 스크롤하면서 원하는 설정을 찾으세요
                          </div>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="font-semibold text-blue-400 mb-1">
                            2. 설정 변경
                          </div>
                          <div className="text-slate-400">
                            각 항목의 스위치나 옵션을 변경하세요
                          </div>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="font-semibold text-purple-400 mb-1">
                            3. 설정 저장
                          </div>
                          <div className="text-slate-400">
                            변경사항이 있으면 하단의 "저장" 버튼을 클릭하세요
                          </div>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="font-semibold text-yellow-400 mb-1">
                            4. 기본값 복원
                          </div>
                          <div className="text-slate-400">
                            문제가 생기면 "기본값으로 되돌리기"를 사용하세요
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Terminal Status */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4 text-sm font-mono">
                <span className="text-blue-400">설정센터@관리:~$</span>
                <span className="text-slate-300"></span>
              </div>
              <div className="flex items-center gap-6 text-xs font-mono">
                <span className="text-slate-400">
                  총 설정 항목:{" "}
                  <span className="text-cyan-400">
                    {settingsCategories.reduce(
                      (total, cat) => total + cat.settings.length,
                      0
                    )}
                  </span>
                </span>
                <span className="text-slate-400">
                  변경사항:{" "}
                  <span
                    className={
                      hasChanges ? "text-yellow-400" : "text-green-400"
                    }
                  >
                    {hasChanges ? "있음" : "없음"}
                  </span>
                </span>
                <span className="text-slate-400">
                  상태: <span className="text-green-400">정상</span>
                </span>
              </div>
            </div>
          </motion.div>

          {/* All Settings */}
          <div className="space-y-6">
            {settingsCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className={`bg-slate-900/70 backdrop-blur-md border ${category.borderColor} rounded-lg p-6`}
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xl">{category.icon}</span>
                  <div>
                    <h3 className={`text-xl font-bold ${category.color}`}>
                      {category.name}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {category.settings.map((setting) => (
                    <div
                      key={setting.key}
                      className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-white mb-1">
                          {setting.name}
                        </div>
                        <div className="text-sm text-slate-400">
                          {setting.description}
                        </div>
                      </div>
                      <div className="ml-4">
                        {setting.type === "toggle" && (
                          <button
                            onClick={() =>
                              handleSettingChange(
                                category.id,
                                setting.key,
                                !(
                                  settings[`${category.id}_${setting.key}`] ??
                                  setting.value
                                )
                              )
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings[`${category.id}_${setting.key}`] ??
                              setting.value
                                ? "bg-blue-500"
                                : "bg-slate-600"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                settings[`${category.id}_${setting.key}`] ??
                                setting.value
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        )}
                        {setting.type === "select" && (
                          <select
                            value={
                              settings[`${category.id}_${setting.key}`] ??
                              setting.value
                            }
                            onChange={(e) =>
                              handleSettingChange(
                                category.id,
                                setting.key,
                                e.target.value
                              )
                            }
                            className="bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500/50"
                          >
                            {setting.options?.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                        {setting.type === "text" && (
                          <input
                            type="text"
                            value={
                              settings[`${category.id}_${setting.key}`] ??
                              setting.value
                            }
                            onChange={(e) =>
                              handleSettingChange(
                                category.id,
                                setting.key,
                                e.target.value
                              )
                            }
                            placeholder={setting.placeholder}
                            className="bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500/50 min-w-72"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Action Buttons */}
          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-6 right-6 flex gap-3"
              >
                <button
                  onClick={handleResetSettings}
                  className="px-6 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors"
                >
                  기본값으로 되돌리기
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-3 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors"
                >
                  설정 저장
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
