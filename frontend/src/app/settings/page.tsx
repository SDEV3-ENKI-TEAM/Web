"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

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

interface SettingsCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  settings: Setting[];
}

const settingsCategories: SettingsCategory[] = [
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
        name: "팝업 알림",
        description: "위험한 상황이 발생했을 때 알림을 받습니다",
        type: "toggle",
        value: true,
        key: "danger_alerts",
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
    ],
  },
];

export default function SettingsPage() {
  const { logout } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<Record<string, any>>({});
  const [showGuide, setShowGuide] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleChangeSetting = (
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
    <DashboardLayout onLogout={handleLogout}>
      <div className="flex-1 p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 backdrop-blur-md border border-blue-500/30 rounded-lg p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">설정 센터</h1>
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

        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-800/70 backdrop-blur-md border border-slate-700/50 rounded-lg p-6"
            >
              <div className="text-slate-300 text-sm leading-6">
                시스템 설정은 사용자 환경에 맞게 조절할 수 있습니다. 알림, 보안,
                연동을 설정하세요.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg p-4">
              <div className="text-slate-300 text-sm">
                총{" "}
                {settingsCategories.reduce(
                  (total, cat) => total + cat.settings.length,
                  0
                )}
                개 항목
              </div>
            </div>
            <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg p-4">
              <div className="text-slate-300 text-sm">
                변경 사항은 저장 버튼을 눌러 적용할 수 있습니다.
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {settingsCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`backdrop-blur-md rounded-lg p-6 border ${category.bgColor} ${category.borderColor}`}
              >
                <div className="mb-4">
                  <h2 className={`text-xl font-bold ${category.color}`}>
                    {category.name}
                  </h2>
                  <p className="text-slate-300 text-sm">
                    {category.description}
                  </p>
                </div>

                <div className="space-y-4">
                  {category.settings.map((setting) => (
                    <div
                      key={`${category.id}_${setting.key}`}
                      className="flex items-center justify-between bg-slate-900/50 border border-slate-700/50 rounded-lg p-4"
                    >
                      <div>
                        <div className="text-white font-medium">
                          {setting.name}
                        </div>
                        <div className="text-slate-400 text-sm">
                          {setting.description}
                        </div>
                      </div>

                      {setting.type === "toggle" && (
                        <button
                          onClick={() =>
                            handleChangeSetting(
                              category.id,
                              setting.key,
                              !(
                                settings[`${category.id}_${setting.key}`] ??
                                setting.value
                              )
                            )
                          }
                          className={`w-14 h-8 rounded-full transition-colors ${
                            settings[`${category.id}_${setting.key}`] ??
                            setting.value
                              ? "bg-blue-600"
                              : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`block w-6 h-6 bg-white rounded-full transform transition-transform mt-1 ml-1 ${
                              settings[`${category.id}_${setting.key}`] ??
                              setting.value
                                ? "translate-x-6"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      )}

                      {setting.type === "select" && (
                        <select
                          className="bg-slate-800 border border-slate-700 rounded-md text-slate-200 px-3 py-2"
                          value={
                            settings[`${category.id}_${setting.key}`] ??
                            setting.value
                          }
                          onChange={(e) =>
                            handleChangeSetting(
                              category.id,
                              setting.key,
                              e.target.value
                            )
                          }
                        >
                          {setting.options?.map((opt: SettingOption) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {setting.type === "text" && (
                        <input
                          type="text"
                          className="bg-slate-800 border border-slate-700 rounded-md text-slate-200 px-3 py-2 w-80"
                          placeholder={setting.placeholder}
                          value={
                            settings[`${category.id}_${setting.key}`] ??
                            setting.value
                          }
                          onChange={(e) =>
                            handleChangeSetting(
                              category.id,
                              setting.key,
                              e.target.value
                            )
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleResetSettings}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700"
          >
            초기화
          </button>
          <button
            onClick={handleSaveSettings}
            className={`px-4 py-2 rounded-lg text-white ${
              hasChanges
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-slate-600 cursor-not-allowed"
            }`}
            disabled={!hasChanges}
          >
            저장
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
