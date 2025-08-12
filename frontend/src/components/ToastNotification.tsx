"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ToastProps {
  message: string;
  type: "info" | "success" | "error";
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type,
  duration = 3000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getToastStyle = () => {
    switch (type) {
      case "info":
        return "bg-blue-500 border-blue-600";
      case "success":
        return "bg-green-500 border-green-600";
      case "error":
        return "bg-red-500 border-red-600";
      default:
        return "bg-gray-500 border-gray-600";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`fixed top-4 right-4 z-50 p-4 rounded-lg border-l-4 shadow-lg text-white min-w-[300px] ${getToastStyle()}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="font-medium">{message}</span>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
};

interface ToastNotificationProps {
  children: React.ReactNode;
}

interface ToastMessage {
  id: string;
  message: string;
  type: "info" | "success" | "error";
  duration?: number;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    message: string,
    type: "info" | "success" | "error" = "info",
    duration?: number
  ) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // 전역 함수로 등록
  React.useEffect(() => {
    (window as any).showToast = addToast;
    return () => {
      delete (window as any).showToast;
    };
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </>
  );
};

export default ToastNotification;
