"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Event } from "@/types/event";

interface EventTableProps {
  events: Event[];
  onEventSelect: (event: Event) => void;
}

export default function EventTable({ events, onEventSelect }: EventTableProps) {
  const [sortField, setSortField] = useState<keyof Event>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const handleSort = (field: keyof Event) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const preventDrag = (e: React.MouseEvent | React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleSortClick = (e: React.MouseEvent, field: keyof Event) => {
    e.stopPropagation();
    e.preventDefault();
    handleSort(field);
  };

  const handleEventClick = (e: React.MouseEvent, event: Event) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedEventId(event.id);
    onEventSelect(event);
  };

  const sortedEvents = [...events].sort((a, b) => {
    if (a[sortField] < b[sortField]) return sortDirection === "asc" ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/30 font-mono border border-slate-700/50 rounded-lg overflow-hidden">
      {/* Terminal Output Header */}
      <div className="bg-slate-800/50 border-b border-slate-700/50 p-2">
        <div className="text-xs text-slate-400">
          총 {events.length}개의 이벤트 발견 | 실시간 모니터링 중...
        </div>
      </div>

      {/* Table Header */}
      <div className="bg-slate-800/30 border-b border-slate-700/50 sticky top-0 z-10 no-drag">
        <div className="grid grid-cols-12 gap-2 py-2 px-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">
          <div
            onClick={(e) => handleSortClick(e, "timestamp")}
            onMouseDown={preventDrag}
            onDragStart={preventDrag}
            onPointerDown={preventDrag}
            className="col-span-3 cursor-pointer hover:text-blue-400 transition-colors flex items-center justify-center gap-1 no-drag text-center"
          >
            발생 시간
            {sortField === "timestamp" && (
              <span className="text-blue-400">
                {sortDirection === "asc" ? "↑" : "↓"}
              </span>
            )}
          </div>
          <div
            onClick={(e) => handleSortClick(e, "user")}
            onMouseDown={preventDrag}
            onDragStart={preventDrag}
            onPointerDown={preventDrag}
            className="col-span-2 cursor-pointer hover:text-blue-400 transition-colors flex items-center justify-center gap-1 no-drag text-center"
          >
            사용자
            {sortField === "user" && (
              <span className="text-blue-400">
                {sortDirection === "asc" ? "↑" : "↓"}
              </span>
            )}
          </div>
          <div className="col-span-3 text-center no-drag">상태</div>
          <div
            onClick={(e) => handleSortClick(e, "event")}
            onMouseDown={preventDrag}
            onDragStart={preventDrag}
            onPointerDown={preventDrag}
            className="col-span-4 cursor-pointer hover:text-blue-400 transition-colors flex items-center justify-center gap-1 no-drag text-center"
          >
            이벤트 유형
            {sortField === "event" && (
              <span className="text-blue-400">
                {sortDirection === "asc" ? "↑" : "↓"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {sortedEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-slate-500 text-sm font-mono">
                이벤트가 없습니다
              </div>
              <div className="text-slate-600 text-xs font-mono mt-1">
                데이터 대기 중...
              </div>
            </div>
          </div>
        ) : (
          <div>
            {sortedEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                onClick={(e) => handleEventClick(e, event)}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                style={{ pointerEvents: "auto" }}
                className={`grid grid-cols-12 gap-2 py-2 px-3 text-xs text-slate-300 cursor-pointer transition-all duration-200 border-l-2 relative z-10 border-b border-slate-600/30 ${
                  selectedEventId === event.id
                    ? "bg-blue-500/20 border-l-blue-500 text-blue-100"
                    : "border-l-transparent hover:bg-slate-800/30 hover:border-l-blue-500/50"
                }`}
              >
                {/* Timestamp */}
                <div
                  className={`col-span-3 font-mono text-center ${
                    selectedEventId === event.id
                      ? "text-blue-200"
                      : "text-slate-400"
                  }`}
                >
                  {formatTimestamp(event.timestamp)}
                </div>

                {/* User */}
                <div
                  className={`col-span-2 font-mono text-center ${
                    selectedEventId === event.id
                      ? "text-cyan-200"
                      : "text-cyan-400"
                  }`}
                >
                  {event.user}
                </div>

                {/* Status Badge */}
                <div className="col-span-3 flex justify-center">
                  <span
                    className={`py-1 rounded text-xs font-bold border w-20 flex items-center justify-center ${
                      selectedEventId === event.id
                        ? event.label === "Anomaly"
                          ? "bg-red-500/40 border-red-400/70 text-red-200"
                          : "bg-green-500/40 border-green-400/70 text-green-200"
                        : event.label === "Anomaly"
                        ? "bg-red-500/20 border-red-500/50 text-red-300"
                        : "bg-green-500/20 border-green-500/50 text-green-300"
                    }`}
                  >
                    {event.label === "Anomaly" ? "위험" : "정상"}
                  </span>
                </div>

                {/* Event Type */}
                <div
                  className={`col-span-4 font-mono text-center ${
                    selectedEventId === event.id
                      ? "text-blue-200"
                      : "text-slate-300"
                  }`}
                >
                  {event.event}
                </div>
              </motion.div>
            ))}
            {/* 마지막 이벤트 하단 여백 */}
            <div className="h-4"></div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-slate-700/30 text-xs text-slate-500 font-mono">
        <div className="flex justify-between items-center">
          <span>
            Found {sortedEvents.length} events | Monitoring real-time...
          </span>
          <span className="text-slate-600">
            {sortDirection === "asc" ? "↑" : "↓"} {sortField}
          </span>
        </div>
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
    </div>
  );
}
