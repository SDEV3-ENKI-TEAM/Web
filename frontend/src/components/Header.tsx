"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import React from "react";

interface HeaderProps {
  onLogout: () => void;
  onOpenSettings?: () => void;
}

export default function Header({ onLogout, onOpenSettings }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { currentUser } = useAuth();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  React.useEffect(() => {
    setCurrentTime(new Date());

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { label: "시스템 리포트", href: "#", icon: "•" },
    { label: "이벤트 분석", href: "#", icon: "•" },
    { label: "도움말", href: "#", icon: "•" },
  ];

  return (
    <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 font-mono relative z-50">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Terminal Status Bar */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400">보안 상태 정상</span>
          </div>
          <div className="text-slate-500 text-xs" suppressHydrationWarning>
            {currentTime
              ? currentTime.toLocaleString("ko-KR", {
                  hour12: false,
                  weekday: "short",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "로딩 중..."}
          </div>
        </div>

        {/* User Section */}
        <div className="flex items-center gap-4">
          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-violet-500 rounded border border-slate-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">
                {currentUser?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-slate-200">
                {currentUser || "관리자"}
              </p>
              <p className="text-xs text-green-400">온라인 • 접속중</p>
            </div>
          </div>

          {/* Terminal Menu */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded border border-slate-600 bg-slate-800/70 hover:bg-slate-700/70 transition-all duration-200"
            >
              <motion.svg
                animate={{ rotate: isMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="h-4 w-4 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </motion.svg>
            </motion.button>

            {/* Dropdown Terminal */}
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl rounded border border-slate-700 shadow-2xl z-[9999] overflow-hidden"
                >
                  {/* Terminal Header */}
                  <div className="bg-slate-800/70 border-b border-slate-700/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      <div className="flex-1 text-center">
                        <span className="text-slate-400 text-xs">
                          사용자 메뉴
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-green-400">
                      메뉴 실행 중...
                    </div>
                  </div>

                  <div className="p-2">
                    {/* Settings */}
                    <motion.button
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0 }}
                      onClick={() => {
                        onOpenSettings?.();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-blue-400 transition-all duration-200 rounded border border-transparent hover:border-slate-600"
                    >
                      <div className="flex items-center gap-2">
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
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <div>
                          <div className="font-semibold">대시보드 설정</div>
                          <div className="text-xs text-slate-500">
                            화면 구성 변경
                          </div>
                        </div>
                      </div>
                    </motion.button>

                    {/* Menu Items */}
                    {menuItems.map((item, index) => (
                      <motion.a
                        key={item.label}
                        href={item.href}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: (index + 1) * 0.05,
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-blue-400 transition-all duration-200 rounded border border-transparent hover:border-slate-600"
                      >
                        <div className="flex items-center gap-2">
                          <span>{item.icon}</span>
                          <div>
                            <div className="font-semibold">{item.label}</div>
                            <div className="text-xs text-slate-500">
                              {item.label === "시스템 리포트"
                                ? "보고서 보기"
                                : item.label === "이벤트 분석"
                                ? "상세 분석"
                                : "도움말 보기"}
                            </div>
                          </div>
                        </div>
                      </motion.a>
                    ))}

                    <div className="border-t border-slate-700 my-2" />

                    {/* Logout */}
                    <motion.button
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: (menuItems.length + 1) * 0.05,
                      }}
                      onClick={onLogout}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 rounded border border-transparent hover:border-red-500/30"
                    >
                      <div className="flex items-center gap-2">
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
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        <div>
                          <div className="font-semibold">로그아웃</div>
                          <div className="text-xs text-red-500/70">
                            시스템 종료
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
