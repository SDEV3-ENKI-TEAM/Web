"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

export interface DashboardWidget {
  id: string;
  name: string;
  type:
    | "stats"
    | "timeseries"
    | "eventtable"
    | "donutchart"
    | "eventdetail"
    | "barchart"
    | "heatmap"
    | "custom";
  visible: boolean;
  position: { x: number; y: number; w: number; h: number };
  config?: {
    title?: string;
    color?: string;
    dataSource?: string;
    chartType?: string;
    [key: string]: any;
  };
  isCustom?: boolean;
}

interface DashboardContextType {
  widgets: DashboardWidget[];
  isLoaded: boolean;
  toggleWidget: (id: string) => void;
  updateWidgetPosition: (
    id: string,
    position: { x: number; y: number; w: number; h: number }
  ) => void;
  updateWidgetConfig: (id: string, config: any) => void;
  addWidget: (widget: Omit<DashboardWidget, "id">) => void;
  deleteWidget: (id: string) => void;
  duplicateWidget: (id: string) => void;
  resetLayout: () => void;
  getAvailableWidgetTypes: () => Array<{
    type: string;
    name: string;
    description: string;
    defaultSize: { w: number; h: number };
  }>;
  ensureEventLogWidgets: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

const defaultWidgets: DashboardWidget[] = [
  {
    id: "stats",
    name: "통계 카드",
    type: "stats",
    visible: true,
    position: { x: 0, y: 0, w: 12, h: 3 },
    config: { title: "시스템 통계" },
  },
  {
    id: "timeseries",
    name: "시계열 그래프",
    type: "timeseries",
    visible: true,
    position: { x: 0, y: 3, w: 8, h: 6 },
    config: { title: "이상 탐지 점수 추이", color: "#4a5568" },
  },
  {
    id: "donutchart",
    name: "분포 차트",
    type: "donutchart",
    visible: true,
    position: { x: 8, y: 3, w: 4, h: 7 },
    config: { title: "이상 탐지 분포" },
  },
  {
    id: "eventtable",
    name: "이벤트 테이블",
    type: "eventtable",
    visible: true,
    position: { x: 0, y: 7, w: 8, h: 8 },
    config: { title: "이벤트 로그" },
  },
  {
    id: "eventdetail",
    name: "이벤트 상세",
    type: "eventdetail",
    visible: true,
    position: { x: 8, y: 10, w: 4, h: 7 },
    config: { title: "상세 정보" },
  },
];

const availableWidgetTypes = [
  {
    type: "stats",
    name: "통계 카드",
    description: "주요 지표를 카드 형태로 표시",
    defaultSize: { w: 12, h: 2 },
  },
  {
    type: "timeseries",
    name: "시계열 그래프",
    description: "시간에 따른 데이터 변화 추이",
    defaultSize: { w: 8, h: 4 },
  },
  {
    type: "donutchart",
    name: "도넛 차트",
    description: "데이터 분포를 원형 차트로 표시",
    defaultSize: { w: 4, h: 4 },
  },
  {
    type: "barchart",
    name: "막대 그래프",
    description: "카테고리별 데이터 비교",
    defaultSize: { w: 6, h: 4 },
  },
  {
    type: "eventtable",
    name: "이벤트 테이블",
    description: "이벤트 데이터를 테이블로 표시",
    defaultSize: { w: 8, h: 8 },
  },
  {
    type: "eventdetail",
    name: "이벤트 상세",
    description: "선택된 이벤트의 상세 정보",
    defaultSize: { w: 4, h: 5 },
  },
  {
    type: "heatmap",
    name: "히트맵",
    description: "시간대별 활동 패턴 히트맵",
    defaultSize: { w: 8, h: 4 },
  },
];
const getInitialWidgets = (): DashboardWidget[] => {
  if (typeof window === "undefined") {
    return defaultWidgets;
  }

  const saved = localStorage.getItem("dashboard-layout");
  if (saved) {
    try {
      const parsedWidgets = JSON.parse(saved);
      if (Array.isArray(parsedWidgets) && parsedWidgets.length > 0) {
        return parsedWidgets;
      }
    } catch (error) {
      console.error("Failed to load dashboard layout:", error);
    }
  }
  return defaultWidgets;
};

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initialWidgets = getInitialWidgets();
    setWidgets(initialWidgets);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (widgets.length > 0 && isLoaded) {
      localStorage.setItem("dashboard-layout", JSON.stringify(widgets));
    }
  }, [widgets, isLoaded]);

  const toggleWidget = useCallback((id: string) => {
    setWidgets((prev) =>
      prev.map((widget) =>
        widget.id === id ? { ...widget, visible: !widget.visible } : widget
      )
    );
  }, []);

  const updateWidgetPosition = useCallback(
    (id: string, position: { x: number; y: number; w: number; h: number }) => {
      setWidgets((prev) =>
        prev.map((widget) =>
          widget.id === id ? { ...widget, position } : widget
        )
      );
    },
    []
  );

  const updateWidgetConfig = useCallback((id: string, config: any) => {
    setWidgets((prev) =>
      prev.map((widget) =>
        widget.id === id
          ? { ...widget, config: { ...widget.config, ...config } }
          : widget
      )
    );
  }, []);

  const addWidget = useCallback((newWidget: Omit<DashboardWidget, "id">) => {
    const id = `widget_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const widget: DashboardWidget = {
      ...newWidget,
      id,
      isCustom: true,
    };

    setWidgets((prev) => [...prev, widget]);
  }, []);

  const deleteWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((widget) => widget.id !== id));
  }, []);

  const duplicateWidget = useCallback(
    (id: string) => {
      const widget = widgets.find((w) => w.id === id);
      if (widget) {
        const newWidget = {
          ...widget,
          name: `${widget.name} (복사본)`,
          position: {
            ...widget.position,
            x: widget.position.x + 1,
            y: widget.position.y + 1,
          },
        };
        delete (newWidget as any).id; // Remove id so addWidget can generate new one
        addWidget(newWidget);
      }
    },
    [widgets, addWidget]
  );

  const resetLayout = useCallback(() => {
    setWidgets(defaultWidgets);
    localStorage.removeItem("dashboard-layout");
  }, []);

  const getAvailableWidgetTypes = useCallback(() => availableWidgetTypes, []);

  const ensureEventLogWidgets = useCallback(() => {
    const hasEventTable = widgets.some(
      (widget) => widget.type === "eventtable" && widget.visible
    );
    const hasEventDetail = widgets.some(
      (widget) => widget.type === "eventdetail" && widget.visible
    );

    if (!hasEventTable || !hasEventDetail) {
      const newWidgets: DashboardWidget[] = [];

      if (!hasEventTable) {
        const eventTableWidget: DashboardWidget = {
          id: `eventtable_${Date.now()}`,
          name: "이벤트 테이블",
          type: "eventtable",
          visible: true,
          position: { x: 0, y: 15, w: 8, h: 8 },
          config: { title: "이벤트 로그" },
          isCustom: true,
        };
        newWidgets.push(eventTableWidget);
      }

      if (!hasEventDetail) {
        const eventDetailWidget: DashboardWidget = {
          id: `eventdetail_${Date.now()}`,
          name: "이벤트 상세",
          type: "eventdetail",
          visible: true,
          position: { x: 8, y: 15, w: 4, h: 5 },
          config: { title: "상세 정보" },
          isCustom: true,
        };
        newWidgets.push(eventDetailWidget);
      }

      if (newWidgets.length > 0) {
        setWidgets((prev) => [...prev, ...newWidgets]);
      }
    }
  }, [widgets]);

  const contextValue = useMemo(
    () => ({
      widgets,
      isLoaded,
      toggleWidget,
      updateWidgetPosition,
      updateWidgetConfig,
      addWidget,
      deleteWidget,
      duplicateWidget,
      resetLayout,
      getAvailableWidgetTypes,
      ensureEventLogWidgets,
    }),
    [
      widgets,
      isLoaded,
      toggleWidget,
      updateWidgetPosition,
      updateWidgetConfig,
      addWidget,
      deleteWidget,
      duplicateWidget,
      resetLayout,
      getAvailableWidgetTypes,
      ensureEventLogWidgets,
    ]
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error(
      "useDashboard must be used within a DashboardProvider. " +
        "Make sure to wrap your component with <DashboardProvider> at a higher level in the component tree."
    );
  }
  return context;
}
