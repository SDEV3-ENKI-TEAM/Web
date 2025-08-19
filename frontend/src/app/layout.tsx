import "./globals.css";
import "./theme.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { DashboardProvider } from "@/context/DashboardContext";
import { SSEProvider } from "@/contexts/SSEContext";
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
            <SSEProvider>
              <ToastNotification>{children}</ToastNotification>
            </SSEProvider>
          </DashboardProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
