"use client";

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { motion } from "framer-motion";

ChartJS.register(ArcElement, Tooltip, Legend);

interface DonutChartProps {
  normalCount?: number;
  anomalyCount?: number;
  title?: string;
}

export default function DonutChart({
  normalCount = 4,
  anomalyCount = 10,
  title = "이벤트 분포",
}: DonutChartProps) {
  const total = normalCount + anomalyCount;
  const normalPercentage = ((normalCount / total) * 100).toFixed(1);
  const anomalyPercentage = ((anomalyCount / total) * 100).toFixed(1);

  const data = {
    labels: ["정상", "위험"],
    datasets: [
      {
        data: [normalCount, anomalyCount],
        backgroundColor: [
          "rgba(34, 197, 94, 0.7)", // Terminal green for normal
          "rgba(239, 68, 68, 0.7)", // Terminal red for anomaly
        ],
        borderColor: [
          "#10b981", // Green border
          "#ef4444", // Red border
        ],
        borderWidth: 2,
        hoverBackgroundColor: [
          "rgba(34, 197, 94, 0.9)",
          "rgba(239, 68, 68, 0.9)",
        ],
        hoverBorderWidth: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#cbd5e1", // Terminal text color
          font: {
            family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            size: 10,
            weight: "normal" as const,
          },
          padding: 12,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)", // Dark terminal background
        titleColor: "#f1f5f9",
        bodyColor: "#cbd5e1",
        borderColor: "#475569",
        borderWidth: 1,
        cornerRadius: 6,
        padding: 12,
        titleFont: {
          family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          size: 11,
        },
        bodyFont: {
          family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          size: 10,
        },
        callbacks: {
          label: function (context: any) {
            const label = context.label;
            const value = context.parsed;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value}개 이벤트 (${percentage}%)`;
          },
        },
      },
    },
    cutout: "65%",
    elements: {
      arc: {
        borderRadius: 4,
      },
    },
    layout: {
      padding: 10,
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="h-full flex flex-col bg-transparent font-mono"
    >
      <div className="relative flex-1 min-h-0 mb-4 flex items-center justify-center no-drag">
        <div className="w-full h-full relative">
          <Doughnut data={data} options={options} />

          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="font-bold text-red-400 text-xl font-mono">
                {anomalyPercentage}%
              </div>
              <div className="text-slate-400 text-xs font-mono uppercase tracking-wider">
                위험도 비율
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal-style summary stats */}
      <div className="flex-shrink-0 no-drag space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/10 border border-green-500/30 rounded p-3 text-center">
            <div className="text-green-400 text-lg font-mono font-bold">
              {normalCount}
            </div>
            <div className="text-green-300 text-xs font-mono uppercase tracking-wide">
              정상
            </div>
            <div className="text-green-500/70 text-xs font-mono">
              {normalPercentage}%
            </div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-center">
            <div className="text-red-400 text-lg font-mono font-bold">
              {anomalyCount}
            </div>
            <div className="text-red-300 text-xs font-mono uppercase tracking-wide">
              위험
            </div>
            <div className="text-red-500/70 text-xs font-mono">
              {anomalyPercentage}%
            </div>
          </div>
        </div>

        {/* Terminal info line */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded px-3 py-2">
          <div className="text-slate-400 text-xs font-mono text-center">
            전체 이벤트:{" "}
            <span className="text-blue-400 font-semibold">{total}</span> |
            처리됨:{" "}
            <span className="text-green-400 font-semibold">{total}</span> |
            실패: <span className="text-red-400 font-semibold">0</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
