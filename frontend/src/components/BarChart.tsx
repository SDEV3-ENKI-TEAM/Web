"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { motion } from "framer-motion";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface BarChartProps {
  data?: Array<{ user: string; anomalyCount: number; normalCount: number }>;
  title?: string;
  color?: string;
}

export default function BarChart({
  data,
  title = "사용자별 이벤트 분포",
  color = "#4a5568",
}: BarChartProps) {
  const chartData = data || [];

  const config = {
    labels: chartData.map((item) => item.user),
    datasets: [
      {
        label: "정상",
        data: chartData.map((item) => item.normalCount),
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: "위험",
        data: chartData.map((item) => item.anomalyCount),
        backgroundColor: "#ef4444",
        borderColor: "#dc2626",
        borderWidth: 1,
        borderRadius: 4,
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
          color: "#2d3748",
          font: {
            size: 12,
            weight: "normal" as const,
          },
        },
      },
      title: {
        display: true,
        text: title,
        color: "#2d3748",
        font: {
          size: 16,
          weight: "bold" as const,
        },
        padding: 20,
      },
      tooltip: {
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        titleColor: "#2d3748",
        bodyColor: "#4a5568",
        borderColor: "#a2b2c1",
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(162, 178, 193, 0.2)",
          drawBorder: false,
        },
        ticks: {
          color: "#718096",
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(162, 178, 193, 0.2)",
          drawBorder: false,
        },
        ticks: {
          color: "#718096",
          font: {
            size: 11,
          },
          stepSize: 1,
        },
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="card h-full flex flex-col"
    >
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-72 text-slate-400 font-mono text-sm">
          데이터를 불러오는 중...
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-4">
          <Bar data={config} options={options} />
        </div>
      )}
    </motion.div>
  );
}
