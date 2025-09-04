"use client";

import { useState, useEffect, useRef } from "react";
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
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<any>(null);
  const didLoadRef = useRef(false);

  const isWebhookMasked = (s: Record<string, any>) => {
    const masked = s["notifications_slack_webhook_url_masked"] || "";
    const cur = s["notifications_slack_webhook_url"] || "";
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

  const queueAutoSave = (
    immediate: boolean = false,
    draft?: Record<string, any>
  ) => {
    if (!didLoadRef.current) return;
    const doSave = async () => {
      try {
        const s = draft ?? settings;
        if (isWebhookMasked(s)) {
          setSaveStatus("idle");
          setSaving(false);
          setHasChanges(false);
          return;
        }
        setSaving(true);
        setSaveStatus("saving");
        setSaveError(null);
        const enabled = !!(s["notifications_slack_enabled"] ?? false);
        const channel = s["notifications_slack_channel"] ?? "";
        const webhook = s["notifications_slack_webhook_url"] ?? "";
        if (enabled && !webhook) {
          setSaveStatus("error");
          setSaveError("Slack 웹훅 URL을 입력하세요");
          setSaving(false);
          return;
        }
        const resp = await fetch("/api/settings/slack", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhook_url: webhook,
            channel: channel || null,
            enabled,
          }),
        });
        if (!resp.ok) {
          setSaveStatus("error");
          setSaveError(`저장 실패: ${resp.status}`);
          setSaving(false);
          return;
        }
        setSaveStatus("saved");
        setHasChanges(false);
        setSaving(false);
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch (e: any) {
        setSaveStatus("error");
        setSaveError("저장 중 오류가 발생했습니다");
        setSaving(false);
      }
    };

    if (immediate) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      doSave();
    } else {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(doSave, 600);
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
          ["notifications_slack_enabled"]: !!data.enabled,
          ["notifications_slack_channel"]: data.channel || "",
          ["notifications_slack_webhook_url_masked"]:
            data.webhook_url_masked || "",
          ["notifications_slack_webhook_url"]: data.webhook_url_masked || "",
        }));
      } catch {}
      didLoadRef.current = true;
    };
    load();
  }, []);

  const handleSaveSettings = async () => {
    try {
      const enabled = !!(settings["notifications_slack_enabled"] ?? false);
      const channel = settings["notifications_slack_channel"] ?? "";
      const webhook = settings["notifications_slack_webhook_url"] ?? "";
      if (!webhook) {
        alert("Slack 웹훅 URL을 입력하세요");
        return;
      }
      const resp = await fetch("/api/settings/slack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhook,
          channel: channel || null,
          enabled,
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        alert(`저장 실패: ${resp.status} ${t}`);
        return;
      }
      setHasChanges(false);
    } catch (e: any) {
      alert("저장 중 오류가 발생했습니다");
    }
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="space-y-6 col-span-4">
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
                          onClick={async () => {
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
                            setSaveStatus("saving");
                            try {
                              const resp = await fetch(
                                "/api/settings/slack/enabled",
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ enabled: nextValue }),
                                }
                              );
                              if (!resp.ok) {
                                throw new Error(await resp.text());
                              }
                              setSaveStatus("saved");
                              setTimeout(() => setSaveStatus("idle"), 1500);
                            } catch (e: any) {
                              const reverted = {
                                ...settings,
                                [`${category.id}_${setting.key}`]: current,
                              };
                              setSettings(reverted);
                              setSaveStatus("error");
                              setSaveError(
                                "웹훅이 필요하거나 저장에 실패했습니다"
                              );
                            }
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
                              [`${category.id}_${setting.key}`]: e.target.value,
                            };
                            setSettings(next);
                            setHasChanges(true);
                            queueAutoSave(false, next);
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
                                ["notifications_slack_webhook_url"]: "",
                              };
                              setSettings(next);
                            }
                          }}
                          onChange={(e) => {
                            const next = {
                              ...settings,
                              [`${category.id}_${setting.key}`]: e.target.value,
                            };
                            setSettings(next);
                            setHasChanges(true);
                            if (setting.key === "slack_webhook_url") {
                              queueAutoSave(false, next);
                            } else {
                              queueAutoSave(false, next);
                            }
                          }}
                          onBlur={() => {
                            if (
                              setting.key === "slack_webhook_url" &&
                              isWebhookMasked(settings)
                            )
                              return;
                            queueAutoSave(true);
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm">
            {saveStatus === "saving" && (
              <span className="text-slate-300">저장 중...</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-green-400">저장됨</span>
            )}
            {saveStatus === "error" && (
              <span className="text-red-400">{saveError || "저장 실패"}</span>
            )}
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleResetSettings}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700"
            >
              초기화
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
