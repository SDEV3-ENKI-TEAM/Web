"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboard, DashboardWidget } from "@/context/DashboardContext";
import WidgetEditModal from "./WidgetEditModal";

interface DashboardSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DashboardSettings({
  isOpen,
  onClose,
}: DashboardSettingsProps) {
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(
    null
  );

  const {
    widgets,
    toggleWidget,
    resetLayout,
    addWidget,
    deleteWidget,
    duplicateWidget,
    updateWidgetConfig,
    getAvailableWidgetTypes,
  } = useDashboard();

  const availableTypes = getAvailableWidgetTypes();

  const handleAddWidget = (type: string) => {
    const widgetType = availableTypes.find((t) => t.type === type);
    if (widgetType) {
      // Find a good position for the new widget
      const maxY = Math.max(
        ...widgets.map((w) => w.position.y + w.position.h),
        0
      );

      addWidget({
        name: widgetType.name,
        type: type as any,
        visible: true,
        position: {
          x: 0,
          y: maxY,
          w: widgetType.defaultSize.w,
          h: widgetType.defaultSize.h,
        },
        config: {
          title: widgetType.name,
        },
      });
    }
    setShowAddWidget(false);
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    setEditingWidget(widget);
  };

  const handleSaveWidgetConfig = (config: any) => {
    if (editingWidget) {
      updateWidgetConfig(editingWidget.id, config);
    }
  };

  const handleDeleteWidget = (id: string) => {
    if (confirm("이 위젯을 삭제하시겠습니까?")) {
      deleteWidget(id);
    }
  };

  return (
    <>
      {/* Settings Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
            />

            {/* Settings Panel */}
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="fixed right-0 top-0 h-full w-96 bg-white-900 backdrop-blur-md border-l border-app-accent-200 shadow-xl z-40 p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-app-text">
                  대시보드 설정
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

              {/* Add Widget Button */}
              <div className="mb-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddWidget(!showAddWidget)}
                  className="w-full bg-app-primary hover:bg-app-primary-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  위젯 추가
                </motion.button>

                {/* Add Widget Options */}
                <AnimatePresence>
                  {showAddWidget && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-2"
                    >
                      {availableTypes.map((type) => (
                        <motion.button
                          key={type.type}
                          whileHover={{ scale: 1.01 }}
                          onClick={() => handleAddWidget(type.type)}
                          className="w-full text-left p-3 bg-app-accent-100 hover:bg-app-accent-200 rounded-lg border border-app-accent-200 transition-colors"
                        >
                          <div className="font-medium text-app-text">
                            {type.name}
                          </div>
                          <div className="text-xs text-app-secondary mt-1">
                            {type.description}
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Widget List */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-app-text mb-4">
                  위젯 관리
                </h3>
                <div className="space-y-3">
                  {widgets.map((widget) => (
                    <motion.div
                      key={widget.id}
                      whileHover={{ scale: 1.01 }}
                      className="p-4 bg-app-accent-100 rounded-lg border border-app-accent-200"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className="text-app-text font-medium">
                            {widget.name}
                          </span>
                          {widget.isCustom && (
                            <span className="ml-2 px-2 py-1 text-xs bg-app-primary text-white rounded">
                              사용자 정의
                            </span>
                          )}
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={widget.visible}
                            onChange={() => toggleWidget(widget.id)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-app-accent-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-app-primary"></div>
                        </label>
                      </div>

                      {/* Widget Actions */}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditWidget(widget)}
                          className="flex-1 px-3 py-2 text-xs bg-app-secondary hover:bg-app-secondary-700 text-white rounded transition-colors"
                          title="편집"
                        >
                          <svg
                            className="w-4 h-4 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => duplicateWidget(widget.id)}
                          className="flex-1 px-3 py-2 text-xs bg-app-accent-300 hover:bg-app-accent-400 text-app-text rounded transition-colors"
                          title="복사"
                        >
                          <svg
                            className="w-4 h-4 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                        {widget.isCustom && (
                          <button
                            onClick={() => handleDeleteWidget(widget.id)}
                            className="flex-1 px-3 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                            title="삭제"
                          >
                            <svg
                              className="w-4 h-4 mx-auto"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Layout Actions */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-app-text mb-4">
                  레이아웃 관리
                </h3>
                <div className="space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={resetLayout}
                    className="w-full bg-app-secondary hover:bg-app-secondary-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                  >
                    기본 레이아웃으로 초기화
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Widget Edit Modal */}
      <WidgetEditModal
        widget={editingWidget}
        isOpen={!!editingWidget}
        onClose={() => setEditingWidget(null)}
        onSave={handleSaveWidgetConfig}
      />
    </>
  );
}
