"use client";

import { motion } from "framer-motion";
import { EventDetail as EventDetailType } from "@/types/event";

interface EventDetailProps {
  event: EventDetailType | null;
  title?: string;
}

export default function EventDetail({
  event,
  title = "이벤트 분석",
}: EventDetailProps) {
  if (!event) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-500 text-4xl mb-4">○</div>
          <div className="text-slate-400 text-sm mb-2">
            선택된 이벤트가 없습니다
          </div>
          <div className="text-slate-500 text-xs">
            아래 표에서 이벤트를 클릭하면 상세 정보가 표시됩니다
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full w-full flex flex-col bg-transparent font-mono"
    >
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
        <div className="space-y-4">
          {/* Event Header */}
          <div className="no-drag">
            <div className="flex justify-between items-start mb-2">
              <div className="text-slate-400 text-xs uppercase tracking-wide">
                이벤트 ID
              </div>
              <div className="text-slate-500 text-xs font-mono">
                {event.date}
              </div>
            </div>
            <div className="text-blue-400 text-lg font-mono font-bold">
              #{event.id}
            </div>
          </div>

          {/* Event Details */}
          <div className="no-drag">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-2">
              이벤트 정보
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <div className="space-y-3">
                {event.timestamp && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">발생 시간:</span>
                    <span className="text-slate-300 text-sm font-mono">
                      {event.timestamp}
                    </span>
                  </div>
                )}
                {event.user && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">사용자:</span>
                    <span className="text-slate-300 text-sm font-mono">
                      {event.user}
                    </span>
                  </div>
                )}
                {event.host && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">호스트:</span>
                    <span className="text-slate-300 text-sm font-mono">
                      {event.host}
                    </span>
                  </div>
                )}
                {event.os && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">운영체제:</span>
                    <span className="text-slate-300 text-sm font-mono">
                      {event.os}
                    </span>
                  </div>
                )}
                {event.label && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">상태:</span>
                    <span
                      className={`text-sm font-mono px-2 py-1 rounded ${
                        event.label === "Anomaly"
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : event.label === "Pending"
                          ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                          : "bg-green-500/20 text-green-300 border border-green-500/30"
                      }`}
                    >
                      {event.label === "Anomaly"
                        ? "위험"
                        : event.label === "Pending"
                        ? "미확인"
                        : "정상"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Incident Details */}
          <div className="no-drag">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-2">
              상세 설명
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3">
              <div className="text-slate-300 text-sm font-mono leading-relaxed">
                {event.ai_summary || "AI 추론중..."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Action Buttons */}
      <div className="flex justify-between space-x-3 flex-shrink-0 pt-4 mt-4 border-t border-slate-700/50 no-drag">
        <button className="flex-1 bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 border border-slate-600/50 hover:border-slate-500 text-xs px-3 py-2 rounded font-mono uppercase tracking-wide transition-all duration-200">
          무시하기
        </button>
        <button className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 hover:border-red-500/50 text-xs px-3 py-2 rounded font-mono uppercase tracking-wide transition-all duration-200">
          조치 취하기
        </button>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(71, 85, 105, 0.5) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(71, 85, 105, 0.5);
          border-radius: 3px;
          border: none;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(71, 85, 105, 0.7);
        }
      `}</style>
    </motion.div>
  );
}
