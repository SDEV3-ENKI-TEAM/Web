"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useRouter } from "next/navigation";

interface Alarm {
  trace_id: string;
  detected_at: number;
  summary: string;
  host: string;
  os: string;
  checked: boolean;
  sigma_alert?: string;
  span_count?: number;
  ai_summary?: string;
  severity?: string;
  severity_score?: number;
  sigma_rule_title?: string;
  isUpdated?: boolean;
}

function timeAgo(dateNum: number) {
  if (!dateNum) return "-";
  const now = new Date();
  const date = new Date(dateNum);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function GlobalNotification() {
  const { notifications, clearNotifications } = useWebSocket();
  const [visibleNotifications, setVisibleNotifications] = useState<Alarm[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (notifications.length > 0) {
      // 새로운 알림이 들어오면 표시
      const newNotification = notifications[0];
      setVisibleNotifications((prev) => [newNotification, ...prev.slice(0, 2)]);

      // 5초 후 자동으로 제거
      const timer = setTimeout(() => {
        setVisibleNotifications((prev) =>
          prev.filter((n) => n.trace_id !== newNotification.trace_id)
        );
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const handleNotificationClick = (alarm: Alarm) => {
    // 알림 클릭 시 alarms 페이지로 이동
    router.push(`/alarms/${alarm.trace_id}`);

    // 클릭된 알림 제거
    setVisibleNotifications((prev) =>
      prev.filter((n) => n.trace_id !== alarm.trace_id)
    );
  };

  const handleClose = (traceId: string) => {
    setVisibleNotifications((prev) =>
      prev.filter((n) => n.trace_id !== traceId)
    );
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {visibleNotifications.map((notification) => (
          <motion.div
            key={notification.trace_id}
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
                    {notification.sigma_rule_title || notification.summary}
                  </div>
                  <div className="text-xs text-slate-300">
                    Trace ID: {notification.trace_id.slice(0, 8)}...
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>호스트: {notification.host}</span>
                  <span>룰 매칭: {notification.span_count || 0}개</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose(notification.trace_id);
                }}
                className="text-slate-400 hover:text-white transition-colors ml-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
