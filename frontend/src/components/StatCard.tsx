"use client";

import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string;
  icon: "network" | "warning" | "chart" | "monitor";
  color: "blue" | "purple" | "cyan" | "red";
}

export default function StatCard({ title, value, icon, color }: StatCardProps) {
  const getIcon = () => {
    switch (icon) {
      case "network":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        );
      case "warning":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
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
        );
      case "chart":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        );
      case "monitor":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getColorClass = () => {
    switch (color) {
      case "blue":
        return "from-app-primary/20 to-app-secondary/20 border-app-primary/30 hover:from-app-primary/30 hover:to-app-secondary/30";
      case "purple":
        return "from-app-secondary/20 to-app-accent/20 border-app-secondary/30 hover:from-app-secondary/30 hover:to-app-accent/30";
      case "cyan":
        return "from-app-accent/20 to-app-primary/20 border-app-accent/30 hover:from-app-accent/30 hover:to-app-primary/30";
      case "red":
        return "from-danger/20 to-danger/10 border-danger/30 hover:from-danger/30 hover:to-danger/20";
      default:
        return "from-app-primary/20 to-app-secondary/20 border-app-primary/30 hover:from-app-primary/30 hover:to-app-secondary/30";
    }
  };

  const getIconColor = () => {
    switch (color) {
      case "blue":
        return "text-app-primary";
      case "purple":
        return "text-app-secondary";
      case "cyan":
        return "text-app-accent";
      case "red":
        return "text-danger";
      default:
        return "text-app-primary";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`stat-card relative overflow-hidden rounded-xl bg-gradient-to-br ${getColorClass()} border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl p-4`}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div
            className={`p-2 rounded-lg bg-white/10 backdrop-blur-sm ${getIconColor()} flex-shrink-0`}
          >
            <div className="w-6 h-6">{getIcon()}</div>
          </div>
          <div className="text-right flex-1 min-w-0 ml-2">
            <h3 className="text-xs font-medium text-app-text/70 mb-1 truncate">
              {title}
            </h3>
            <p className="stat-value text-app-text truncate">{value}</p>
          </div>
        </div>

        {/* Progress indicator for visual appeal */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1, delay: 0.5 }}
            className={`h-full bg-gradient-to-r ${
              color === "red"
                ? "from-danger to-danger/60"
                : "from-app-primary to-app-secondary"
            } rounded-full`}
          />
        </div>
      </div>
    </motion.div>
  );
}
