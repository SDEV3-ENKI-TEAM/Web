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
      <div className="h-full flex items-center justify-center bg-transparent font-mono">
        <div className="text-center">
          <div className="text-slate-500 text-4xl mb-4">○</div>
          <div className="text-slate-400 text-sm mb-2">
            선택된 이벤트가 없습니다
          </div>
          <div className="text-slate-500 text-xs">
            표에서 이벤트를 클릭하면 상세 정보를 볼 수 있습니다
          </div>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score < 0.5) return "text-green-400";
    if (score < 0.8) return "text-yellow-400";
    return "text-red-400";
  };

  const getProgressBarColor = (score: number) => {
    if (score < 0.5) return "bg-green-500";
    if (score < 0.8) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getBadgeStyle = (score: number) => {
    if (score < 0.5)
      return "bg-green-500/20 text-green-300 border-green-500/30";
    if (score < 0.8)
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    return "bg-red-500/20 text-red-300 border-red-500/30";
  };

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

          {/* Anomaly Score Section */}
          <div className="no-drag">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-2">
              위험도 점수
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-2xl font-bold font-mono ${getScoreColor(
                    event.anomalyScore
                  )}`}
                >
                  {event.anomalyScore.toFixed(3)}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-mono uppercase tracking-wide border ${getBadgeStyle(
                    event.anomalyScore
                  )}`}
                >
                  {event.anomalyScore < 0.5
                    ? "정상"
                    : event.anomalyScore < 0.8
                    ? "주의"
                    : "위험"}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getProgressBarColor(
                    event.anomalyScore
                  )}`}
                  style={{ width: `${event.anomalyScore * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1 font-mono">
                <span>0.000 (안전)</span>
                <span>1.000 (위험)</span>
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
                {event.incident}
              </div>
            </div>
          </div>

          {/* Raw Data Section */}
          <div className="no-drag">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-2">
              원본 이벤트 데이터
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg">
              <div className="max-h-60 overflow-y-auto p-3 custom-scrollbar">
                <div className="space-y-2">
                  {Object.entries(event.rowData).map(([key, value], index) => (
                    <div key={key} className="flex flex-col sm:flex-row">
                      <div className="text-cyan-400 font-mono text-xs font-semibold min-w-0 sm:w-1/3 mb-1 sm:mb-0">
                        {key === "ip_address"
                          ? "IP 주소"
                          : key === "user"
                          ? "사용자"
                          : key === "number"
                          ? "번호"
                          : key === "location"
                          ? "위치"
                          : key === "timestamp"
                          ? "발생시간"
                          : key === "event_type"
                          ? "이벤트 유형"
                          : key === "anomaly_score"
                          ? "위험도 점수"
                          : key === "status"
                          ? "상태"
                          : key}
                        :
                      </div>
                      <div className="text-slate-300 font-mono text-xs break-all sm:w-2/3">
                        "{value}"
                      </div>
                    </div>
                  ))}
                </div>
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
