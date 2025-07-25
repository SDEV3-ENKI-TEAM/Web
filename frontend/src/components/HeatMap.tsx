"use client";

import React from "react";
import { motion } from "framer-motion";

interface HeatMapProps {
  title?: string;
  data?: Array<{ hour: number; day: number; value: number }>;
}

export default function HeatMap({
  title = "시간대별 활동 패턴",
  data,
}: HeatMapProps) {
  // Mock data for demonstration - 24 hours x 7 days
  const mockData = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => ({
      hour,
      day,
      value: Math.random() * 10,
    }))
  ).flat();

  const heatmapData = data || mockData;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getIntensityColor = (value: number) => {
    const intensity = Math.min(value / 10, 1);
    if (intensity === 0) return "bg-app-accent-100";
    if (intensity < 0.2) return "bg-blue-100";
    if (intensity < 0.4) return "bg-blue-200";
    if (intensity < 0.6) return "bg-blue-300";
    if (intensity < 0.8) return "bg-blue-400";
    return "bg-blue-500";
  };

  const getValueForCell = (day: number, hour: number) => {
    const cell = heatmapData.find((d) => d.day === day && d.hour === hour);
    return cell ? cell.value : 0;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="card h-full overflow-hidden flex flex-col"
    >
      <div className="p-2 flex-1 min-h-0 flex flex-col">
        <h3 className="text-sm font-semibold text-app-text mb-2 flex-shrink-0">
          {title}
        </h3>

        <div className="overflow-auto flex-1 min-h-0">
          <div className="grid grid-cols-25 gap-1 text-xs min-w-max">
            {/* Header row with hours */}
            <div></div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="text-center text-app-secondary font-medium p-1 text-xs"
              >
                {hour}
              </div>
            ))}

            {/* Data rows */}
            {days.map((day, dayIndex) => (
              <React.Fragment key={dayIndex}>
                <div className="text-app-secondary font-medium p-1 flex items-center text-xs">
                  {day}
                </div>
                {hours.map((hour) => {
                  const value = getValueForCell(dayIndex, hour);
                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className={`aspect-square rounded ${getIntensityColor(
                        value
                      )} border border-app-accent-200 cursor-pointer hover:scale-110 transition-transform min-w-4 min-h-4`}
                      title={`${day}요일 ${hour}시: ${value.toFixed(1)} 이벤트`}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center justify-between text-xs text-app-secondary flex-shrink-0">
          <span>적음</span>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-app-accent-100 rounded"></div>
            <div className="w-2 h-2 bg-blue-100 rounded"></div>
            <div className="w-2 h-2 bg-blue-200 rounded"></div>
            <div className="w-2 h-2 bg-blue-300 rounded"></div>
            <div className="w-2 h-2 bg-blue-400 rounded"></div>
            <div className="w-2 h-2 bg-blue-500 rounded"></div>
          </div>
          <span>많음</span>
        </div>
      </div>
    </motion.div>
  );
}
