"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { motion } from "framer-motion";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimeSeriesChartProps {
  data?: Array<{
    timestamp: string;
    duration: number;
    has_anomaly?: boolean;
    trace_id?: string;
    matched_span_count?: number;
    operation_name?: string;
    service_name?: string;
  }>;
  title?: string;
  color?: string;
}

export default function TimeSeriesChart({
  data,
  title = "Trace Duration 시계열",
  color = "#60a5fa",
}: TimeSeriesChartProps) {
  const chartData = data && data.length > 0 ? data : [];

  const labels = chartData.map((item) => {
    const date = new Date(item.timestamp);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Seoul",
    });
  });

  const dataset = chartData.map((item) => item.duration);

  const pointBackgroundColors = chartData.map((item) =>
    item.has_anomaly ? "#ef4444" : color
  );

  const pointBorderColors = chartData.map((item) =>
    item.has_anomaly ? "#dc2626" : color
  );

  const chartConfig = {
    labels,
    datasets: [
      {
        label: "Duration (ms)",
        data: dataset,
        borderColor: color,
        backgroundColor: `${color}20`,
        pointRadius: chartData.map((item) => (item.has_anomaly ? 6 : 4)),
        pointBackgroundColor: pointBackgroundColors,
        pointBorderColor: pointBorderColors,
        pointBorderWidth: 2,
        fill: true,
        tension: 0.3,
        showLine: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#cbd5e1",
          font: {
            family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            size: 11,
            weight: "normal" as const,
          },
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        titleColor: "#f1f5f9",
        bodyColor: "#cbd5e1",
        borderColor: "#475569",
        borderWidth: 1,
        cornerRadius: 6,
        padding: 12,
        titleFont: {
          family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          size: 12,
        },
        bodyFont: {
          family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          size: 11,
        },
        callbacks: {
          label: function (context: any) {
            const dataIndex = context.dataIndex;
            const item = chartData[dataIndex];
            const lines = [
              `Duration: ${context.parsed.y} ms`,
              `Time: ${item.timestamp}`,
            ];

            if (item.trace_id) {
              lines.push(`Trace ID: ${item.trace_id}`);
            }
            if (item.matched_span_count) {
              lines.push(`Spans: ${item.matched_span_count}개`);
            }
            if (item.operation_name) {
              lines.push(`Operation: ${item.operation_name}`);
            }

            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(71, 85, 105, 0.3)",
          drawBorder: false,
        },
        ticks: {
          color: "#94a3b8",
          font: {
            family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            size: 10,
          },
          maxTicksLimit: 6,
        },
        title: {
          display: true,
          text: "Time",
          color: "#cbd5e1",
        },
      },
      y: {
        min: 0,
        grid: {
          color: "rgba(71, 85, 105, 0.3)",
          drawBorder: false,
        },
        ticks: {
          color: "#94a3b8",
          font: {
            family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            size: 10,
          },
        },
        title: {
          display: true,
          text: "Duration (ms)",
          color: "#cbd5e1",
        },
      },
    },
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full h-full flex flex-col bg-transparent"
    >
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-72 text-slate-400 font-mono text-sm">
          시계열 데이터를 불러오는 중...
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 p-4 terminal-chart-container h-72"
          style={{ height: 300 }}
        >
          <Line data={chartConfig} options={options} />
        </div>
      )}
    </motion.div>
  );
}
