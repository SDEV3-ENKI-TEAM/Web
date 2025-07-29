"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface LoadingScreenProps {
  message?: string;
  showProgress?: boolean;
  minimal?: boolean;
  terminalTitle?: string;
  command?: string;
}

export default function LoadingScreen({
  message = "Initializing AI Security System...",
  showProgress = true,
  minimal = false,
  terminalTitle = "ai-detector-boot.terminal",
  command = "$ ai-detector --initialize --verbose",
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    "Loading LLM models...",
    "Initializing threat detection...",
    "Connecting to security endpoints...",
    "Calibrating anomaly detection...",
    "Starting real-time monitoring...",
    "System ready!",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + Math.random() * 15;
      });
    }, 300);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 1200);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, []);

  if (minimal) {
    return (
      <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50">
        {/* Tech Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

        {/* Single Floating Bubble */}
        <div
          className="absolute w-96 h-96 rounded-full opacity-20 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.1) 50%, transparent 70%)",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            animation: "float 8s ease-in-out infinite",
            zIndex: -1,
          }}
        ></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Minimal Terminal Window */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg border border-slate-700/50 overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/70 border-b border-slate-700/50">
              <div className="flex gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-slate-400 text-xs font-mono">
                  {terminalTitle}
                </span>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="p-4">
              <div className="text-green-400 font-mono text-xs mb-3">
                {command}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 border border-blue-400/50 border-t-blue-400 rounded-full animate-spin"></div>
                <span className="text-slate-300 font-mono text-xs">
                  {message}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-mono text-xs">
                  system@ai-detector:~$
                </span>
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-white font-mono text-xs bg-white w-1.5 h-3 inline-block ml-1"
                />
              </div>
            </div>
          </div>
        </motion.div>

        <style jsx>{`
          @keyframes float {
            0%,
            100% {
              transform: translate(-50%, -50%) rotate(0deg);
            }
            25% {
              transform: translate(-45%, -55%) rotate(1deg);
            }
            50% {
              transform: translate(-55%, -45%) rotate(-1deg);
            }
            75% {
              transform: translate(-50%, -50%) rotate(0.5deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 overflow-hidden z-50">
      {/* Tech Grid Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:72px_72px]"></div>

        {/* 3D Floating Bubbles Background */}
        {[
          {
            size: 350,
            x: "12%",
            y: "18%",
            color: "rgba(59, 130, 246, 0.7)",
            delay: 0,
          },
          {
            size: 280,
            x: "78%",
            y: "65%",
            color: "rgba(139, 92, 246, 0.6)",
            delay: 1,
          },
          {
            size: 220,
            x: "8%",
            y: "78%",
            color: "rgba(236, 72, 153, 0.5)",
            delay: 2,
          },
          {
            size: 320,
            x: "82%",
            y: "22%",
            color: "rgba(34, 197, 94, 0.4)",
            delay: 3,
          },
          {
            size: 180,
            x: "45%",
            y: "85%",
            color: "rgba(251, 191, 36, 0.5)",
            delay: 4,
          },
        ].map((bubble, i) => (
          <motion.div
            key={`loading-bubble-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              left: bubble.x,
              top: bubble.y,
              background: `radial-gradient(circle at 25% 25%, ${
                bubble.color
              } 0%, ${bubble.color.replace(
                "0.",
                "0.2"
              )} 40%, ${bubble.color.replace(
                /0\.\d/,
                "0.1"
              )} 70%, transparent 85%)`,
              filter: "brightness(1.3) blur(0.8px)",
              zIndex: -1,
            }}
            animate={{
              y: [-25, 25, -25],
              x: [-18, 18, -18],
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: Math.random() * 6 + 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: bubble.delay,
            }}
          >
            {/* 3D highlight effect */}
            <div
              className="absolute rounded-full"
              style={{
                width: "60%",
                height: "60%",
                top: "15%",
                left: "15%",
                background: `radial-gradient(circle at 20% 20%, ${bubble.color.replace(
                  /0\.\d/,
                  "0.9"
                )} 0%, transparent 60%)`,
                filter: "blur(2px)",
              }}
            ></div>

            {/* Inner core glow */}
            <div
              className="absolute rounded-full animate-pulse"
              style={{
                width: "30%",
                height: "30%",
                top: "20%",
                left: "20%",
                background: `radial-gradient(circle, ${bubble.color.replace(
                  /0\.\d/,
                  "1"
                )} 0%, transparent 70%)`,
                filter: "blur(1px)",
              }}
            ></div>

            {/* Natural glass reflection */}
            <div
              className="absolute rounded-full"
              style={{
                width: "18%",
                height: "18%",
                top: "15%",
                left: "20%",
                background:
                  "radial-gradient(ellipse at 30% 30%, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.08) 40%, transparent 70%)",
                filter: "blur(0.8px)",
              }}
            ></div>
          </motion.div>
        ))}

        {/* Data Streams */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`loading-stream-${i}`}
            className="absolute w-0.5 h-12 bg-gradient-to-b from-blue-400/30 to-transparent rounded-full"
            initial={{
              x:
                Math.random() *
                (typeof window !== "undefined" ? window.innerWidth : 1920),
              y: -20,
            }}
            animate={{
              y: typeof window !== "undefined" ? window.innerHeight + 20 : 1080,
            }}
            transition={{
              duration: Math.random() * 4 + 3,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "linear",
            }}
          />
        ))}

        {/* Network Nodes */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`loading-node-${i}`}
            className="absolute w-1.5 h-1.5 bg-violet-400/30 rounded-full border border-violet-400/50"
            initial={{
              x:
                Math.random() *
                (typeof window !== "undefined" ? window.innerWidth : 1920),
              y:
                Math.random() *
                (typeof window !== "undefined" ? window.innerHeight : 1080),
            }}
            animate={{
              x:
                Math.random() *
                (typeof window !== "undefined" ? window.innerWidth : 1920),
              y:
                Math.random() *
                (typeof window !== "undefined" ? window.innerHeight : 1080),
            }}
            transition={{
              duration: Math.random() * 25 + 20,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "linear",
            }}
          >
            <motion.div
              className="absolute inset-0 bg-violet-400/15 rounded-full"
              animate={{
                scale: [1, 3, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          </motion.div>
        ))}

        {/* Gradient overlays */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-transparent to-violet-500/5"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-slate-900/50 via-transparent to-slate-900/50"></div>
      </div>

      {/* Loading Content */}
      <div className="relative flex items-center justify-center min-h-screen p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative w-full max-w-2xl"
        >
          {/* Main Logo/Title */}
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-violet-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-mono text-2xl font-bold">
                  AI
                </span>
              </div>
              <h1 className="text-4xl font-mono font-bold text-white">
                AI Detector
              </h1>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20"
            >
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-400 text-sm font-mono">
                System Initializing
              </span>
            </motion.div>
          </motion.div>

          {/* Terminal Loading Window */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-slate-800/50 backdrop-blur-xl rounded-lg border border-slate-700/50 overflow-hidden"
          >
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/70 border-b border-slate-700/50">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-slate-400 text-sm font-mono">
                  {terminalTitle}
                </span>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="p-8">
              <div className="space-y-3 mb-8">
                <div className="text-green-400 font-mono text-sm">
                  {command}
                </div>
                <div className="text-slate-400 font-mono text-xs">
                  {message}
                </div>

                {/* Loading Steps */}
                <div className="space-y-2 mt-6">
                  {steps.map((step, index) => (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{
                        opacity: index <= currentStep ? 1 : 0.3,
                        x: 0,
                      }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-2 font-mono text-sm"
                    >
                      {index < currentStep ? (
                        <span className="text-green-400">✓</span>
                      ) : index === currentStep ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full"
                        />
                      ) : (
                        <span className="text-slate-600">○</span>
                      )}
                      <span
                        className={
                          index <= currentStep
                            ? "text-slate-300"
                            : "text-slate-600"
                        }
                      >
                        {step}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              {showProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-mono text-xs">
                      Progress
                    </span>
                    <span className="text-blue-400 font-mono text-xs">
                      {Math.min(progress, 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {/* Loading Cursor */}
              <div className="mt-6 flex items-center gap-1">
                <span className="text-slate-400 font-mono text-sm">
                  system@ai-detector:~$
                </span>
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-white font-mono text-sm bg-white w-2 h-4 inline-block ml-1"
                />
              </div>
            </div>
          </motion.div>

          {/* Bottom Status */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center mt-8"
          >
            <div className="text-slate-500 font-mono text-xs">
              Agentic AI Security Platform • Version 2.0.1
            </div>
            <div className="text-slate-600 font-mono text-xs mt-1">
              Endpoint Protection • LLM Integration • Real-time Analysis
            </div>
          </motion.div>

          {/* Floating Effects */}
          <motion.div
            animate={{ y: [-15, 15, -15] }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-r from-blue-500/15 to-violet-500/15 rounded-full blur-2xl"
          />
          <motion.div
            animate={{ y: [15, -15, 15] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -bottom-8 -left-8 w-40 h-40 bg-gradient-to-r from-violet-500/15 to-blue-500/15 rounded-full blur-2xl"
          />
        </motion.div>
      </div>
    </div>
  );
}
