"use client";

import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import GlobalNotification from "@/components/GlobalNotification";

interface DashboardLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  onOpenSettings?: () => void;
}

function DashboardLayoutComponent({
  children,
  onLogout,
  onOpenSettings,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-full bg-slate-900 text-slate-200 relative">
      {/* Background with bubbles and grid */}
      <div className="fixed inset-0 bg-slate-900">
        {/* Tech Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

        {/* 3D Floating Bubbles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Bubble 1 */}
          <div
            className="absolute w-72 h-72 rounded-full opacity-30"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.1) 50%, transparent 70%)",
              left: "10%",
              top: "15%",
              animation: "float 20s ease-in-out infinite",
              zIndex: -1,
            }}
          ></div>

          {/* Bubble 2 */}
          <div
            className="absolute w-96 h-96 rounded-full opacity-25"
            style={{
              background:
                "radial-gradient(circle at 25% 25%, rgba(168, 85, 247, 0.35) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 70%)",
              right: "5%",
              top: "5%",
              animation: "float 25s ease-in-out infinite reverse",
              zIndex: -1,
            }}
          ></div>

          {/* Bubble 3 */}
          <div
            className="absolute w-80 h-80 rounded-full opacity-20"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.08) 50%, transparent 70%)",
              left: "60%",
              bottom: "10%",
              animation: "float 18s ease-in-out infinite",
              zIndex: -1,
            }}
          ></div>

          {/* Bubble 4 */}
          <div
            className="absolute w-64 h-64 rounded-full opacity-25"
            style={{
              background:
                "radial-gradient(circle at 40% 35%, rgba(236, 72, 153, 0.35) 0%, rgba(236, 72, 153, 0.1) 50%, transparent 70%)",
              left: "15%",
              bottom: "20%",
              animation: "float 22s ease-in-out infinite reverse",
              zIndex: -1,
            }}
          ></div>
        </div>
      </div>

      <Sidebar />
      <div className="flex flex-col flex-grow relative z-10">
        <Header onLogout={onLogout} onOpenSettings={onOpenSettings} />
        <main className="flex flex-col flex-grow p-4 md:p-8 md:pr-12 min-h-0">
          {children}
        </main>
      </div>

      <GlobalNotification />

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(30px, -30px) rotate(1deg);
          }
          50% {
            transform: translate(-20px, 20px) rotate(-1deg);
          }
          75% {
            transform: translate(20px, -10px) rotate(0.5deg);
          }
        }
      `}</style>
    </div>
  );
}

export default React.memo(DashboardLayoutComponent);
