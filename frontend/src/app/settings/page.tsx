"use strict";
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "react-toastify";

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
    id: "slack_config",
    name: "Slack 설정",
    description: "Slack 웹훅 URL과 채널명을 설정합니다",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    icon: "⚙️",
    settings: [
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
  {
    id: "slack_connection",
    name: "Slack 연동",
    description: "Slack 알림 연동을 활성화/비활성화합니다",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    icon: "🔗",
    settings: [
      {
        name: "Slack 알림 연동",
        description: "Slack으로 보안 알림을 전송합니다",
        type: "toggle",
        value: false,
        key: "slack_enabled",
      },
    ],
  },
];

export default function SettingsPage() {
  const { logout } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<any>(null);
  const didLoadRef = useRef(false);

  const isWebhookMasked = (s: Record<string, any>) => {
    const masked = s["slack_config_slack_webhook_url_masked"] || "";
    const cur = s["slack_config_slack_webhook_url"] || "";
    return masked && cur === masked;
  };

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

  const handleSaveAll = async () => {
    try {
      setSaving(true);

      const enabled = !!(settings["slack_connection_slack_enabled"] ?? false);
      const channel = settings["slack_config_slack_channel"] ?? "";
      const webhook = settings["slack_config_slack_webhook_url"] ?? "";

      if (enabled && !webhook) {
        toast.error("Slack 웹훅 URL을 입력하세요");
        setSaving(false);
        return;
      }

      const loadingToast = toast.loading("저장 중...");

      const resp = await fetch("/api/settings/slack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhook?.replace(/[<>]/g, "") || "https://example.com",
          channel: channel?.replace(/[<>]/g, "") || null,
          enabled,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 422) {
          toast.update(loadingToast, {
            render:
              "웹훅 URL 형식이 올바르지 않습니다. 올바른 URL을 입력해주세요.",
            type: "error",
            isLoading: false,
            autoClose: 3000,
          });
        } else {
          toast.update(loadingToast, {
            render: `저장 실패: ${resp.status}`,
            type: "error",
            isLoading: false,
            autoClose: 3000,
          });
        }
        setSaving(false);
        return;
      }

      toast.update(loadingToast, {
        render: "저장됨",
        type: "success",
        isLoading: false,
        autoClose: 1500,
      });

      setHasChanges(false);
      setSaving(false);
    } catch (e: any) {
      toast.error("저장 중 오류가 발생했습니다");
      setSaving(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch("/api/settings/slack");
        if (!resp.ok) return;
        const data = await resp.json();
        setSettings((prev) => ({
          ...prev,
          ["slack_connection_slack_enabled"]: !!data.enabled,
          ["slack_config_slack_channel"]: data.channel || "",
          ["slack_config_slack_webhook_url_masked"]:
            data.webhook_url_masked || "",
          ["slack_config_slack_webhook_url"]: data.webhook_url_masked || "",
        }));
      } catch (loadError) {
        // console.error("Failed to load Slack settings:", loadError);
      }
      didLoadRef.current = true;
    };
    load();
  }, []);

  const handleResetSettings = async () => {
    if (
      confirm(
        "모든 설정을 기본값으로 되돌리시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      try {
        setSaving(true);

        const loadingToast = toast.loading("초기화 중...");

        const resp = await fetch("/api/settings/slack/reset", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            credentials: "include",
          },
          credentials: "include",
        });

        if (!resp.ok) {
          toast.update(loadingToast, {
            render: `초기화 실패: ${resp.status}`,
            type: "error",
            isLoading: false,
            autoClose: 3000,
          });
          setSaving(false);
          return;
        }

        setSettings({});
        setHasChanges(false);
        toast.update(loadingToast, {
          render: "초기화 완료",
          type: "success",
          isLoading: false,
          autoClose: 1500,
        });
        setSaving(false);
      } catch (e: any) {
        toast.error("초기화 중 오류가 발생했습니다");
        setSaving(false);
      }
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
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="space-y-6 col-span-4">
            {settingsCategories.map((category, index) => (
              <>
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
                            onClick={() => {
                              const current = !!(
                                settings[`${category.id}_${setting.key}`] ??
                                setting.value
                              );
                              const nextValue = !current;

                              const next = {
                                ...settings,
                                [`${category.id}_${setting.key}`]: nextValue,
                              };
                              setSettings(next);
                              setHasChanges(true);
                            }}
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
                            onChange={(e) => {
                              const next = {
                                ...settings,
                                [`${category.id}_${setting.key}`]:
                                  e.target.value,
                              };
                              setSettings(next);
                              setHasChanges(true);
                            }}
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
                            onFocus={() => {
                              if (
                                setting.key === "slack_webhook_url" &&
                                isWebhookMasked(settings)
                              ) {
                                const next = {
                                  ...settings,
                                  ["slack_config_slack_webhook_url"]: "",
                                };
                                setSettings(next);
                              }
                            }}
                            onChange={(e) => {
                              const next = {
                                ...settings,
                                [`${category.id}_${setting.key}`]:
                                  e.target.value,
                              };
                              setSettings(next);
                              setHasChanges(true);
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>

                {category.id === "slack_config" && (
                  <motion.div
                    key="slack_guide_inline"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="backdrop-blur-md rounded-lg p-6 border bg-slate-900/70 border-slate-700/50"
                  >
                    <h2 className="text-lg font-bold text-cyan-400 mb-4">
                      Slack 설정 가이드
                    </h2>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      <li>Slack 워크스페이스의 Apps → Incoming Webhooks</li>
                      <li>Add to Slack 클릭 후 채널 선택 및 Allow</li>
                      <li>생성된 웹훅 URL 복사 후 위 입력란에 붙여넣기</li>
                      <li>#security-alerts 같은 채널명을 입력</li>
                      <li>아래의 Slack 연동을 켜고 저장</li>
                    </ul>
                  </motion.div>
                )}
              </>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {hasChanges && (
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 bg-blue-600 border border-blue-500 rounded-lg text-white hover:bg-blue-700"
            >
              저장
            </button>
          )}
          <button
            onClick={handleResetSettings}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700"
          >
            초기화
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
