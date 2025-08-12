import "./globals.css";
import "./theme.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardProvider } from "@/context/DashboardContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import GlobalNotification from "@/components/GlobalNotification";
import ToastNotification from "@/components/ToastNotification";

export const metadata: Metadata = {
  title: "AI Detector - 악성프로세스 탐지 시스템",
  description: "AI 기반 악성프로세스 탐지 및 모니터링 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-app-background text-app-text">
        <AuthProvider>
          <DashboardProvider>
            <WebSocketProvider>
              <ToastNotification>
                {children}
                <GlobalNotification />
              </ToastNotification>
            </WebSocketProvider>
          </DashboardProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
