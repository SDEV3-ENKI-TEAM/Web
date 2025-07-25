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
  data?: Array<{ timestamp: string; duration: number }>;
  title?: string;
  color?: string;
}

export default function TimeSeriesChart({
  data,
  title = "Trace Duration 시계열",
  color = "#60a5fa",
}: TimeSeriesChartProps) {
  // 예시/mock 데이터 (없을 때)
  const mockData = [
    { timestamp: "2024-07-24T18:06:40", duration: 800 },
    { timestamp: "2024-07-24T18:15:00", duration: 200 },
    { timestamp: "2024-07-24T18:20:00", duration: 600 },
  ];

  const chartData = data || mockData;

  const labels = chartData.map((item) =>
    new Date(item.timestamp).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );

  const dataset = chartData.map((item) => item.duration);

  const chartConfig = {
    labels,
    datasets: [
      {
        label: "Duration (ms)",
        data: dataset,
        borderColor: color,
        backgroundColor: color,
        pointRadius: 7,
        pointBackgroundColor: color,
        fill: false,
        tension: 0.2,
        showLine: false, // 점만 찍힘
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
            return [
              `Duration: ${context.parsed.y} ms`,
              `Time: ${item.timestamp}`,
            ];
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
      <div
        className="flex-1 min-h-0 p-4 terminal-chart-container h-72"
        style={{ height: 300 }}
      >
        <Line data={chartConfig} options={options} />
      </div>
    </motion.div>
  );
}
