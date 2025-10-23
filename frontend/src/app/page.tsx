"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.push("/dashboard");
    }
  }, [isLoading, isLoggedIn, router]);

  const handleGetStarted = () => {
    router.push("/login");
  };

  const handleLearnMore = () => {
    // Can implement scroll to features or open demo
    const featuresSection = document.querySelector("#features");
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Checking authentication status..." />;
  }

  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden relative">
      {/* Tech Grid Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:72px_72px]"></div>

        {/* Network Nodes - AI Agents */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`node-${i}`}
            className="absolute w-3 h-3 bg-blue-400/30 rounded-full border border-blue-400/50"
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
            {/* Node pulse effect */}
            <motion.div
              className="absolute inset-0 bg-blue-400/20 rounded-full"
              animate={{
                scale: [1, 2, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.5,
              }}
            />
          </motion.div>
        ))}

        {/* Data Streams - EventLog flows */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`stream-${i}`}
            className="absolute w-1 h-8 bg-gradient-to-b from-violet-400/40 to-transparent rounded-full"
            initial={{
              x:
                Math.random() *
                (typeof window !== "undefined" ? window.innerWidth : 1920),
              y: -10,
            }}
            animate={{
              y: typeof window !== "undefined" ? window.innerHeight + 10 : 1080,
            }}
            transition={{
              duration: Math.random() * 8 + 5,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "linear",
            }}
          />
        ))}

        {/* LLM Processing Indicators */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={`llm-${i}`}
            className="absolute w-6 h-6 border border-purple-400/30 rounded-lg"
            initial={{
              x:
                Math.random() *
                (typeof window !== "undefined" ? window.innerWidth : 1920),
              y:
                Math.random() *
                (typeof window !== "undefined" ? window.innerHeight : 1080),
              rotate: 0,
            }}
            animate={{
              rotate: 360,
              scale: [1, 1.2, 1],
            }}
            transition={{
              rotate: {
                duration: 15,
                repeat: Infinity,
                ease: "linear",
              },
              scale: {
                duration: 4,
                repeat: Infinity,
                delay: i * 1,
              },
            }}
          >
            <div className="w-1 h-1 bg-purple-400/50 rounded-full absolute top-1 left-1"></div>
            <div className="w-1 h-1 bg-purple-400/50 rounded-full absolute top-1 right-1"></div>
            <div className="w-1 h-1 bg-purple-400/50 rounded-full absolute bottom-1 left-1"></div>
            <div className="w-1 h-1 bg-purple-400/50 rounded-full absolute bottom-1 right-1"></div>
          </motion.div>
        ))}

        {/* 3D Floating Bubbles Background */}
        {[
          {
            size: 400,
            x: "15%",
            y: "20%",
            color: "rgba(59, 130, 246, 0.8)",
            delay: 0,
          },
          {
            size: 300,
            x: "75%",
            y: "60%",
            color: "rgba(139, 92, 246, 0.7)",
            delay: 2,
          },
          {
            size: 250,
            x: "5%",
            y: "70%",
            color: "rgba(236, 72, 153, 0.6)",
            delay: 4,
          },
          {
            size: 350,
            x: "85%",
            y: "15%",
            color: "rgba(34, 197, 94, 0.5)",
            delay: 6,
          },
          {
            size: 200,
            x: "45%",
            y: "85%",
            color: "rgba(251, 191, 36, 0.6)",
            delay: 8,
          },
          {
            size: 320,
            x: "60%",
            y: "35%",
            color: "rgba(168, 85, 247, 0.7)",
            delay: 10,
          },
        ].map((bubble, i) => (
          <motion.div
            key={`3d-bubble-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              left: bubble.x,
              top: bubble.y,
              background: `radial-gradient(circle at 25% 25%, ${
                bubble.color
              } 0%, ${bubble.color
                .replace("0.", "0.3")
                .replace("0.3", "0.2")} 40%, ${bubble.color.replace(
                /0\.\d/,
                "0.1"
              )} 70%, transparent 85%)`,
              filter: "brightness(1.3) blur(0.8px)",
              zIndex: -1,
            }}
            animate={{
              y: [-30, 30, -30],
              x: [-20, 20, -20],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: Math.random() * 8 + 12,
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
                  "radial-gradient(ellipse at 30% 30%, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 40%, transparent 70%)",
                filter: "blur(0.8px)",
              }}
            ></div>
          </motion.div>
        ))}

        {/* Gradient overlays */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-transparent to-violet-500/5"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-slate-900/50 via-transparent to-slate-900/50"></div>

        {/* Cyber security perimeter */}
        <div className="absolute inset-0 border-2 border-green-400/10 rounded-lg m-8"></div>
        <div className="absolute inset-0 border border-blue-400/10 rounded-lg m-16"></div>
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="fixed top-0 left-0 right-0 z-50 p-6 backdrop-blur-xl bg-slate-900/70 border-b border-slate-800/50"
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-mono text-sm font-bold">X</span>
            </div>
            <span className="text-xl font-mono font-bold text-white">
              ShiftX
            </span>
          </motion.div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push("/login")}
              className="px-4 py-2 rounded-lg font-mono text-sm border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200"
            >
              Login
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push("/signup")}
              className="px-4 py-2 rounded-lg font-mono text-sm bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:from-blue-600 hover:to-violet-600 transition-all duration-200"
            >
              Join
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center relative px-6">
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="space-y-8"
            >
              {/* Status Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-mono">
                  System Online
                </span>
              </motion.div>

              {/* Main Title */}
              <div className="space-y-4">
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-5xl lg:text-6xl font-bold text-white leading-tight"
                >
                  <span className="block font-mono text-2xl lg:text-3xl text-slate-400 mb-2">
                    // Agentic AI Powered
                  </span>
                  Endpoint Security
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
                    Intelligence
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-lg text-slate-300 max-w-lg leading-relaxed"
                >
                  EventLog를 Trace로 변환하여 LLM이 공격 패턴을 추론하고, Tool
                  Calling을 통한 실시간 자동대응까지 제공하는 차세대 보안
                  솔루션입니다.
                </motion.p>
              </div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGetStarted}
                  className="group relative px-6 py-3 bg-gradient-to-r from-blue-500 to-violet-500 rounded-lg font-mono font-medium text-white overflow-hidden"
                >
                  <span className="relative z-10">Get Started →</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLearnMore}
                  className="px-6 py-3 border border-slate-600 rounded-lg font-mono font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-300"
                >
                  View Demo
                </motion.button>
              </motion.div>

              {/* Tech Stats */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-800/50"
              >
                {[
                  { label: "Trace Processing", value: "< 100ms" },
                  { label: "LLM Inference", value: "99.9%" },
                  { label: "Tool Calling", value: "< 2s" },
                ].map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-xl font-bold font-mono text-blue-400">
                      {stat.value}
                    </div>
                    <div className="text-xs text-slate-500 font-mono uppercase tracking-wider">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right Content - Code Terminal Mockup */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="hidden lg:block"
            >
              <div className="relative">
                {/* Terminal Window */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg border border-slate-700/50 overflow-hidden">
                  {/* Terminal Header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/70 border-b border-slate-700/50">
                    <div className="flex-1 text-center">
                      <span className="text-slate-400 text-sm font-mono">
                        agentic-ai-security.terminal
                      </span>
                    </div>
                  </div>

                  {/* Terminal Content */}
                  <div className="p-6 font-mono text-sm space-y-2">
                    <div className="text-green-400">
                      $ agentic-ai --endpoint-security --live
                    </div>
                    <div className="text-slate-400">
                      Initializing Agentic AI Security System...
                    </div>
                    <div className="text-blue-400">✓ Loading LLM models</div>
                    <div className="text-blue-400">
                      ✓ EventLog → Trace converter ready
                    </div>
                    <div className="text-blue-400">
                      ✓ Tool calling framework initialized
                    </div>
                    <div className="text-yellow-400">
                      [TRACE] Process: suspicious_file.exe → analyzed
                    </div>
                    <div className="text-violet-400">
                      [LLM] Inference: Potential malware behavior detected
                    </div>
                    <div className="text-orange-400">
                      [TOOL] Auto-isolating endpoint...
                    </div>
                    <div className="text-green-400">
                      <span className="text-slate-400">Status:</span> PROTECTED
                    </div>
                    <div className="text-slate-400">
                      <span className="animate-pulse">█</span>
                    </div>
                  </div>
                </div>

                {/* Floating Elements */}
                <motion.div
                  animate={{ y: [-10, 10, -10] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-r from-blue-500/20 to-violet-500/20 rounded-full blur-xl"
                ></motion.div>
                <motion.div
                  animate={{ y: [10, -10, 10] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-r from-violet-500/20 to-blue-500/20 rounded-full blur-xl"
                ></motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-slate-500"
          >
            <span className="text-xs font-mono uppercase tracking-wider">
              Scroll
            </span>
            <div className="w-px h-8 bg-gradient-to-b from-slate-500 to-transparent"></div>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6"
            >
              <span className="text-blue-400 text-sm font-mono">
                // Core Features
              </span>
            </motion.div>

            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4 font-mono">
              Agentic AI
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                {" "}
                Security Engine
              </span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Advanced LLM-powered threat analysis with autonomous response
              capabilities
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "EventLog to Trace",
                description:
                  "Real-time conversion of system logs into analyzable trace format",
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                ),
                gradient: "from-cyan-400 to-blue-500",
              },
              {
                title: "LLM Threat Analysis",
                description:
                  "Advanced language models analyze attack patterns and behaviors",
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                ),
                gradient: "from-purple-400 to-pink-500",
              },
              {
                title: "Tool Calling Response",
                description:
                  "Autonomous security tools execution for immediate threat mitigation",
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                  </svg>
                ),
                gradient: "from-orange-400 to-red-500",
              },
              {
                title: "Endpoint Protection",
                description:
                  "Comprehensive endpoint security with behavioral analysis",
                icon: (
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                ),
                gradient: "from-green-400 to-emerald-500",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative"
              >
                <div className="relative h-full bg-slate-800/30 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 hover:border-blue-500/30 transition-all duration-300">
                  {/* Icon with gradient background */}
                  <div
                    className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.gradient} mb-4 text-white`}
                  >
                    {feature.icon}
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3 font-mono">
                    {feature.title}
                  </h3>

                  <p className="text-slate-400 leading-relaxed text-sm">
                    {feature.description}
                  </p>

                  {/* Hover effect overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-violet-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {/* Top-right corner accent */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-xl"></div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Tech metrics row */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {[
              {
                metric: "Real-time",
                label: "EventLog Processing",
                color: "text-green-400",
              },
              {
                metric: "< 50ms",
                label: "LLM Response",
                color: "text-blue-400",
              },
              {
                metric: "Auto",
                label: "Tool Execution",
                color: "text-violet-400",
              },
              {
                metric: "100%",
                label: "Endpoint Coverage",
                color: "text-yellow-400",
              },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div
                  className={`text-2xl font-bold font-mono ${item.color} mb-1`}
                >
                  {item.metric}
                </div>
                <div className="text-slate-500 text-sm font-mono uppercase tracking-wider">
                  {item.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 relative">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Background with tech pattern */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-800/50 to-slate-800/30 backdrop-blur-xl rounded-2xl border border-slate-700/50"></div>
            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(59,130,246,0.05)_25%,transparent_25%),linear-gradient(-45deg,rgba(139,92,246,0.05)_25%,transparent_25%)] bg-[size:20px_20px] rounded-2xl"></div>

            <div className="relative p-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6"
              >
                <span className="text-blue-400 text-sm font-mono">
                  // Ready to Start
                </span>
              </motion.div>

              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 font-mono">
                Deploy Agentic AI
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                  Security Shield
                </span>
              </h2>

              <p className="text-slate-300 mb-8 text-lg leading-relaxed max-w-2xl mx-auto">
                Experience next-generation endpoint protection with intelligent
                AI agents that analyze, reason, and respond to threats
                autonomously.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGetStarted}
                  className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-violet-500 rounded-lg font-mono font-medium text-white overflow-hidden"
                >
                  <span className="relative z-10">Start Free Trial →</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 border border-slate-600 rounded-lg font-mono font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-300"
                >
                  Schedule Demo
                </motion.button>
              </div>

              {/* Trust indicators */}
              <div className="mt-8 pt-8 border-t border-slate-700/50">
                <p className="text-slate-500 text-sm font-mono mb-4">
                  Trusted by 500+ companies
                </p>
                <div className="flex justify-center items-center gap-8 opacity-50">
                  {["Enterprise", "Startup", "Government", "Healthcare"].map(
                    (type, index) => (
                      <span
                        key={index}
                        className="text-slate-400 text-sm font-mono"
                      >
                        {type}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -top-6 -right-6 w-12 h-12 border border-blue-500/20 rounded-lg"
            ></motion.div>
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-6 -left-6 w-16 h-16 border border-violet-500/20 rounded-lg"
            ></motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-800/50 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row justify-between items-center gap-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-violet-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-mono text-sm font-bold">
                  AI
                </span>
              </div>
              <span className="text-xl font-mono font-bold text-white">
                AI Detector
              </span>
            </div>

            <div className="flex gap-8 text-slate-400 text-sm font-mono">
              <a href="#" className="hover:text-white transition-colors">
                Documentation
              </a>
              <a href="#" className="hover:text-white transition-colors">
                API
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Support
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Status
              </a>
            </div>
          </motion.div>

          {/* Tech footer info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="mt-8 pt-8 border-t border-slate-800/30"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-green-400 font-mono text-sm">
                  API Status
                </div>
                <div className="text-slate-500 text-xs font-mono">
                  All Systems Operational
                </div>
              </div>
              <div>
                <div className="text-blue-400 font-mono text-sm">Latency</div>
                <div className="text-slate-500 text-xs font-mono">
                  {"< 50ms Response"}
                </div>
              </div>
              <div>
                <div className="text-violet-400 font-mono text-sm">Uptime</div>
                <div className="text-slate-500 text-xs font-mono">
                  99.99% SLA
                </div>
              </div>
              <div>
                <div className="text-yellow-400 font-mono text-sm">
                  Security
                </div>
                <div className="text-slate-500 text-xs font-mono">
                  SOC 2 Compliant
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}
