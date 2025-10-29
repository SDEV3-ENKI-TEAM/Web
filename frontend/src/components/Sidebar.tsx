"use strict";
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useDashboard } from "@/context/DashboardContext";
import { useSSE } from "@/contexts/SSEContext";
import { isSafeURL, getSafeURL } from "@/lib/urlValidation";

function SidebarComponent() {
  const pathname = usePathname();
  const router = useRouter();
  const { ensureEventLogWidgets } = useDashboard();
  const { sseConnected, sseError } = useSSE();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEventLogClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname !== "/dashboard") {
      router.push("/dashboard");
    }
    setTimeout(() => {
      ensureEventLogWidgets();
    }, 100);
  };

  const mainNavItems: Array<{
    href: string;
    label: string;
    icon: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    description?: string;
  }> = [
    {
      href: "/dashboard",
      label: "홈 대시보드",
      description: "보안 상황을 한눈에 확인하세요",
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      href: "/alarms",
      label: "보안 알림",
      description: "의심스러운 활동이나 문제를 확인하세요",
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    {
      href: "/settings",
      label: "설정",
      description: "사용자 설정 및 환경을 관리하세요",
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ].map((item) => ({
    ...item,
    href: getSafeURL(item.href, "/dashboard"), // 각 href를 안전하게 검증
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "text-green-400";
      case "ONLINE":
        return "text-emerald-400";
      case "MONITORING":
        return "text-blue-400";
      case "PROCESSING":
        return "text-orange-400";
      case "READY":
        return "text-cyan-400";
      case "LOADED":
        return "text-violet-400";
      case "STANDBY":
        return "text-yellow-400";
      case "IDLE":
        return "text-slate-400";
      default:
        return "text-slate-500";
    }
  };

  const getStatusDot = (status: string) => {
    const color = getStatusColor(status);
    return (
      <div
        className={`w-2 h-2 rounded-full ${color.replace(
          "text-",
          "bg-"
        )} animate-pulse`}
      ></div>
    );
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="w-80 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/50 flex flex-col shadow-2xl font-mono"
    >
      {/* Terminal Header */}
      <div className="bg-slate-800/70 border-b border-slate-700/50 p-4">
        {/* Logo/Brand */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-700/50 border border-slate-600/50 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Project Logo"
                width={32}
                height={32}
                style={{ width: "auto", height: "auto" }}
                className="object-contain"
              />
            </div>
            <div className="text-left">
              <h1 className="text-base font-bold text-white">ShiftX</h1>
              <p className="text-xs text-slate-400 -mt-1">
                v2.3.1 | 빌드 2025.7.25
              </p>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-slate-800/50 rounded border border-slate-700/50 p-2 mt-3">
          <div className="text-xs text-slate-400 mb-2">시스템 상태</div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div className="flex items-center gap-1">
              {sseConnected ? (
                <>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400">연결됨</span>
                </>
              ) : sseError ? (
                <>
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span className="text-red-400">연결 실패</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-yellow-400">연결 중</span>
                </>
              )}
            </div>
          </div>
          <div className="text-slate-500 text-xs" suppressHydrationWarning>
            {currentTime
              ? currentTime.toLocaleString("ko-KR", {
                  hour12: false,
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "로딩 중..."}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-grow p-4">
        {/* 주요 메뉴 */}
        <ul className="space-y-3 mb-8">
          {mainNavItems.map((item, index) => {
            const isActive = pathname === item.href;

            return (
              <motion.li
                key={item.href}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                {item.onClick ? (
                  <button
                    onClick={item.onClick}
                    className={`group flex items-center justify-between p-4 rounded border transition-all duration-200 w-full text-left ${
                      isActive
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                        : "border-slate-700/50 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600/50 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span
                        className={`${
                          isActive ? "text-blue-400" : "text-slate-400"
                        } group-hover:text-slate-300`}
                      >
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs font-semibold ${
                            isActive ? "text-blue-300" : "text-slate-300"
                          }`}
                        >
                          {item.label}
                        </div>
                      </div>
                    </div>
                  </button>
                ) : (
                  <Link
                    href={getSafeURL(item.href, "/dashboard")}
                    className={`group flex items-center justify-between p-4 rounded border transition-all duration-200 w-full text-left ${
                      isActive
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                        : "border-slate-700/50 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600/50 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span
                        className={`${
                          isActive ? "text-blue-400" : "text-slate-400"
                        } group-hover:text-slate-300`}
                      >
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs font-semibold ${
                            isActive ? "text-blue-300" : "text-slate-300"
                          }`}
                        >
                          {item.label}
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
              </motion.li>
            );
          })}
        </ul>
      </nav>
    </motion.aside>
  );
}

export default React.memo(SidebarComponent);
