"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSSE } from "@/contexts/SSEContext";
import { useRouter } from "next/navigation";

interface Alarm {
  trace_id: string;
  detected_at: number;
  summary: string;
  host: string;
  os: string;
  checked: boolean;
  sigma_alert?: string;
  matched_span_count?: number;
  ai_summary?: string;
  severity?: string;
  severity_score?: number;
  sigma_rule_title?: string;
  isUpdated?: boolean;
  toast_id?: string;
}

function timeAgo(dateNum: number) {
  if (!dateNum) return "-";
  const now = Date.now();
  const diff = Math.floor((now - dateNum) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function GlobalNotification() {
  const { dequeueNotification, dismissNotification, notifications } = useSSE();
  const [visibleNotifications, setVisibleNotifications] = useState<Alarm[]>([]);
  const router = useRouter();

  const MAX_VISIBLE = 3;
  const isConsumingRef = React.useRef(false);
  const timersRef = React.useRef<Record<string, any>>({});

  useEffect(() => {
    if (notifications.length === 0) return;
    if (isConsumingRef.current) return;
    isConsumingRef.current = true;

    const pulled: Alarm[] = [];
    while (pulled.length < MAX_VISIBLE) {
      const next = dequeueNotification();
      if (!next) break;
      pulled.push({ ...next, detected_at: Number(next.detected_at) } as Alarm);
    }

    if (pulled.length === 0) {
      isConsumingRef.current = false;
      return;
    }

    setVisibleNotifications((prev) => {
      let nextVisible = [...prev];
      for (const item of pulled) {
        const key = item.toast_id || item.trace_id;
        if (nextVisible.some((n) => (n.toast_id || n.trace_id) === key))
          continue;
        nextVisible = [
          { ...item, detected_at: Number(item.detected_at) },
          ...nextVisible,
        ].slice(0, MAX_VISIBLE);
      }
      return nextVisible;
    });

    for (const item of pulled) {
      const key = item.toast_id || item.trace_id;
      if (timersRef.current[key]) continue;
      const t = setTimeout(() => {
        setVisibleNotifications((prev) =>
          prev.filter((n) => (n.toast_id || n.trace_id) !== key)
        );
        dismissNotification(item.trace_id);
        delete timersRef.current[key];
      }, 5000);
      timersRef.current[key] = t;
    }

    isConsumingRef.current = false;
  }, [notifications.length]);

  const handleNotificationClick = (alarm: Alarm) => {
    router.push(`/alarms/${alarm.trace_id}`);
    const key = alarm.toast_id || alarm.trace_id;
    setVisibleNotifications((prev) =>
      prev.filter((n) => (n.toast_id || n.trace_id) !== key)
    );
    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key]);
      delete timersRef.current[key];
    }
    dismissNotification(alarm.trace_id);
  };

  const handleClose = (alarm: Alarm) => {
    const key = alarm.toast_id || alarm.trace_id;
    setVisibleNotifications((prev) =>
      prev.filter((n) => (n.toast_id || n.trace_id) !== key)
    );
    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key]);
      delete timersRef.current[key];
    }
    dismissNotification(alarm.trace_id);
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {visibleNotifications.map((notification) => (
          <motion.div
            key={notification.toast_id || notification.trace_id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="bg-slate-800 border border-red-500/30 rounded-lg p-4 shadow-lg max-w-sm w-full backdrop-blur-md"
            onClick={() => handleNotificationClick(notification)}
            style={{ cursor: "pointer" }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-red-400 font-medium">
                    새로운 보안 알림
                  </span>
                  <span className="text-xs text-slate-400">
                    {timeAgo(notification.detected_at)}
                  </span>
                </div>

                <div className="mb-2">
                  <div className="text-sm font-medium text-white mb-1">
                    {notification.sigma_rule_title ? (
                      <>
                        {notification.sigma_rule_title}
                        <span className="text-xs font-normal text-slate-400">
                          {" "}
                          ({notification.trace_id})
                        </span>
                      </>
                    ) : (
                      notification.summary
                    )}
                  </div>
                  <div className="text-xs text-slate-300">
                    Trace ID: {notification.trace_id.slice(0, 8)}...
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">호스트</span>
                    <span className="text-slate-300 font-mono">
                      {notification.host || "unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">위험도</span>
                    <span className="text-slate-300 font-mono">
                      {notification.severity || "low"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose(notification);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
