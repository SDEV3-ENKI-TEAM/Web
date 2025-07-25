"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardWidget } from "@/context/DashboardContext";

interface WidgetEditModalProps {
  widget: DashboardWidget | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
}

export default function WidgetEditModal({
  widget,
  isOpen,
  onClose,
  onSave,
}: WidgetEditModalProps) {
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    if (widget) {
      setConfig(widget.config || {});
    }
  }, [widget]);

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  const handleInputChange = (key: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (!widget) return null;

  const renderConfigFields = () => {
    switch (widget.type) {
      case "stats":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                제목
              </label>
              <input
                type="text"
                value={config.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="input-field w-full"
                placeholder="통계 카드 제목"
              />
            </div>
          </div>
        );

      case "timeseries":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                제목
              </label>
              <input
                type="text"
                value={config.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="input-field w-full"
                placeholder="시계열 그래프 제목"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                선 색상
              </label>
              <input
                type="color"
                value={config.color || "#4a5568"}
                onChange={(e) => handleInputChange("color", e.target.value)}
                className="w-full h-10 rounded border border-app-accent-200"
              />
            </div>
          </div>
        );

      case "donutchart":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                제목
              </label>
              <input
                type="text"
                value={config.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="input-field w-full"
                placeholder="도넛 차트 제목"
              />
            </div>
          </div>
        );

      case "barchart":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                제목
              </label>
              <input
                type="text"
                value={config.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="input-field w-full"
                placeholder="막대 그래프 제목"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                색상
              </label>
              <input
                type="color"
                value={config.color || "#4a5568"}
                onChange={(e) => handleInputChange("color", e.target.value)}
                className="w-full h-10 rounded border border-app-accent-200"
              />
            </div>
          </div>
        );

      case "heatmap":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                제목
              </label>
              <input
                type="text"
                value={config.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="input-field w-full"
                placeholder="히트맵 제목"
              />
            </div>
          </div>
        );

      case "eventtable":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                제목
              </label>
              <input
                type="text"
                value={config.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="input-field w-full"
                placeholder="테이블 제목"
              />
            </div>
          </div>
        );

      case "eventdetail":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                제목
              </label>
              <input
                type="text"
                value={config.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="input-field w-full"
                placeholder="상세 정보 제목"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="text-app-secondary">
            이 위젯 타입에 대한 설정 옵션이 없습니다.
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white-900 backdrop-blur-md border border-app-accent-200 rounded-xl shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-app-text">
                  위젯 설정 - {widget.name}
                </h2>
                <button
                  onClick={onClose}
                  className="text-app-secondary hover:text-app-text transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {renderConfigFields()}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-app-secondary hover:text-app-text transition-colors"
                >
                  취소
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  className="px-6 py-2 bg-app-primary hover:bg-app-primary-700 text-white rounded-lg font-medium transition-colors"
                >
                  저장
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
