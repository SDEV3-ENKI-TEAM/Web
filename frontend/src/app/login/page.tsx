"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ username, password });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden relative">
      {/* Tech Grid Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:72px_72px]"></div>

        {/* 3D Floating Bubbles Background */}
        {[
          {
            size: 300,
            x: "10%",
            y: "15%",
            color: "rgba(59, 130, 246, 0.6)",
            delay: 0,
          },
          {
            size: 250,
            x: "80%",
            y: "60%",
            color: "rgba(139, 92, 246, 0.5)",
            delay: 2,
          },
          {
            size: 200,
            x: "5%",
            y: "75%",
            color: "rgba(236, 72, 153, 0.4)",
            delay: 4,
          },
          {
            size: 280,
            x: "85%",
            y: "20%",
            color: "rgba(34, 197, 94, 0.3)",
            delay: 6,
          },
        ].map((bubble, i) => (
          <motion.div
            key={`login-bubble-${i}`}
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
              y: [-20, 20, -20],
              x: [-15, 15, -15],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: Math.random() * 6 + 10,
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
                  "0.8"
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

        {/* Network Nodes */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`login-node-${i}`}
            className="absolute w-2 h-2 bg-blue-400/20 rounded-full border border-blue-400/40"
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
              duration: Math.random() * 20 + 15,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "linear",
            }}
          >
            <motion.div
              className="absolute inset-0 bg-blue-400/10 rounded-full"
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

        {/* Gradient overlays */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-transparent to-violet-500/5"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-slate-900/50 via-transparent to-slate-900/50"></div>
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
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-lg font-mono text-sm border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200"
            >
              Home
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

      {/* Login Form */}
      <main className="min-h-screen flex items-center justify-center p-6 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative w-full max-w-md"
        >
          {/* Terminal Window */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg border border-slate-700/50 overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/70 border-b border-slate-700/50">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-slate-400 text-sm font-mono">
                  shiftx-auth.terminal
                </span>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="p-6">
              {/* Terminal Prompt */}
              <div className="mb-6">
                <div className="text-green-400 font-mono text-sm mb-1">
                  $ shiftx --login --secure
                </div>
                <div className="text-slate-400 font-mono text-xs mb-4">
                  Initializing secure authentication protocol...
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-xs font-mono">
                    System Ready
                  </span>
                </motion.div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-mono mb-2">
                    <span className="text-blue-400">user@</span>endpoint:
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white font-mono text-sm placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all duration-200"
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-mono mb-2">
                    <span className="text-violet-400">auth@</span>password:
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white font-mono text-sm placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none transition-all duration-200"
                    placeholder="Enter password"
                    required
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                  >
                    <div className="text-red-400 font-mono text-sm">
                      <span className="text-red-500">ERROR:</span> {error}
                    </div>
                  </motion.div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="group relative w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-violet-500 rounded-lg font-mono font-medium text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Authenticating...
                      </div>
                    ) : (
                      "Execute Login →"
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </motion.button>

                <div className="pt-4 border-t border-slate-700/50">
                  <div className="text-slate-400 font-mono text-xs text-center">
                    <span className="text-slate-500">user@system:</span> No
                    account?
                    <Link
                      href="/signup"
                      className="text-blue-400 hover:text-blue-300 ml-1 hover:underline transition-colors"
                    >
                      initialize-new-user
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Floating Effects */}
          <motion.div
            animate={{ y: [-10, 10, -10] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-r from-blue-500/20 to-violet-500/20 rounded-full blur-xl"
          ></motion.div>
          <motion.div
            animate={{ y: [10, -10, 10] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-r from-violet-500/20 to-blue-500/20 rounded-full blur-xl"
          ></motion.div>
        </motion.div>
      </main>
    </div>
  );
}
