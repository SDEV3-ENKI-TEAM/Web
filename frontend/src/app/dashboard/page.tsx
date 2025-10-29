"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useDashboard } from "@/context/DashboardContext";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import DonutChart from "@/components/DonutChart";
import EventTable from "@/components/EventTable";
import EventDetail from "@/components/EventDetail";
import DashboardSettings from "@/components/DashboardSettings";
import { fetchStats, fetchTimeseries, fetchInfiniteAlarms } from "@/lib/api";
import { Event, Stats, EventDetail as EventDetailType } from "@/types/event";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function Dashboard() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalEvents: 0,
    anomalies: 0,
    avgAnomaly: 0,
    highestScore: 0,
    uncheckedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<any[]>([]);

  const [infiniteAlarms, setInfiniteAlarms] = useState<any[]>([]);
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const { widgets, isLoaded, deleteWidget, updateWidgetPosition } =
    useDashboard();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const statsData = await fetchStats();
        setStats(statsData);
        setError(null);
      } catch (err) {
        // console.error("Failed to load data:", err);
        setError("보안 데이터를 불러오는데 실패했습니다");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const loadInfiniteAlarms = async () => {
      try {
        setInfiniteLoading(true);
        const data = await fetchInfiniteAlarms(20);
        setInfiniteAlarms(data.alarms || []);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (err) {
        // console.error("무한스크롤 데이터 로드 실패:", err);
        setInfiniteAlarms([]);
      } finally {
        setInfiniteLoading(false);
      }
    };

    loadInfiniteAlarms();
  }, []);

  const loadMoreAlarms = async () => {
    if (infiniteLoading || !hasMore) return;

    try {
      setInfiniteLoading(true);
      const data = await fetchInfiniteAlarms(20, cursor || undefined);

      setInfiniteAlarms((prev) => [...prev, ...(data.alarms || [])]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      // console.error("추가 데이터 로드 실패:", err);
    } finally {
      setInfiniteLoading(false);
    }
  };

  useEffect(() => {
    const fetchTimeseriesData = async () => {
      try {
        const data = await fetchTimeseries();
        setTimeseriesData(data);
      } catch (err) {
        // console.error("시계열 데이터 로드 실패:", err);
        setTimeseriesData([]);
      }
    };

    fetchTimeseriesData();

    const interval = setInterval(fetchTimeseriesData, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleEventClick = useCallback((event: Event) => {
    setSelectedEvent(event);
  }, []);

  const convertEventToEventDetail = useCallback(
    (event: Event): EventDetailType => {
      return {
        id: event.id,
        date: event.timestamp,
        incident: event.event,
        traceID: event.traceID,
        timestamp: event.timestamp,
        user: event.user,
        host: event.host || "",
        os: event.os || "",
        event: event.event,
        label: event.label,
        duration: event.duration,
        ai_summary: event.ai_summary,
        details: {
          process_id: "",
          parent_process_id: "",
          command_line: "",
          image_path: "",
          sigma_rule: "",
          error_details: "",
        },
      };
    },
    []
  );
  const currentLayout = useMemo(() => {
    return widgets
      .filter((widget) => widget.visible)
      .map((widget) => ({
        i: widget.id,
        x: widget.position.x,
        y: widget.position.y,
        w: widget.position.w,
        h: widget.position.h,
      }));
  }, [widgets]);

  const WidgetWrapper = useCallback(
    ({ children, title, onRemove, widgetType }: any) => (
      <div className="w-full h-full bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-lg font-mono relative z-0 flex flex-col overflow-hidden">
        {/* Terminal Header */}
        <div className="bg-slate-800/70 border-b border-slate-700/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm ml-2">
              {title}.terminal
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            className="text-red-400 hover:text-red-300 transition-colors text-sm relative z-10 px-2 py-1 rounded hover:bg-red-500/10 select-none"
            style={{ pointerEvents: "auto" }}
          >
            ✕
          </button>
        </div>

        {/* Terminal Command */}
        <div className="px-4 py-1 bg-slate-800/30 border-b border-slate-700/30">
          <div className="text-xs text-green-400">
            $ {getTerminalCommand(widgetType)}
          </div>
        </div>

        {/* Widget Content */}
        <div className="p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    ),
    []
  );

  const getTerminalCommand = useCallback((type: string): string => {
    const commands: Record<string, string> = {
      stats: "시스템 상태 확인 중...",
      timeseries: "시간별 데이터 분석 중...",
      donutchart: "위험 요소 분석 중...",
      barchart: "카테고리별 분석 중...",
      heatmap: "상관관계 분석 중...",
      eventtable: "보안 이벤트 모니터링 중...",
      eventdetail: "상세 정보 분석 중...",
    };
    return commands[type] || "데이터 처리 중...";
  }, []);

  const statsWidget = useMemo(
    () => (
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 w-full h-full overflow-hidden">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-slate-400 text-xs mb-2">전체 활동</div>
          <div className="text-3xl font-bold text-blue-400 mb-1">
            {stats.totalEvents}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-slate-400 text-xs mb-2">미확인 수</div>
          <div className="text-3xl font-bold text-red-400 mb-1">
            {stats.uncheckedCount}
          </div>
        </div>
      </div>
    ),
    [stats]
  );

  const eventTableWidget = useMemo(
    () =>
      loading ? (
        <div className="flex items-center justify-center flex-1 min-h-0">
          <div className="text-green-400 font-mono text-sm animate-pulse">
            이벤트 정보를 불러오는 중...
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center flex-1 min-h-0">
          <div className="text-red-400 font-mono text-sm">오류: {error}</div>
        </div>
      ) : (
        <EventTable
          events={infiniteAlarms.map((alarm, index) => ({
            id: index,
            traceID: alarm.trace_id,
            operationName: alarm.summary,
            timestamp: new Date(alarm.detected_at).toLocaleString("ko-KR", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }),
            duration: 0,
            user: alarm.host,
            host: alarm.host,
            os: alarm.os,
            label: !alarm.ai_decision
              ? "Pending"
              : alarm.ai_decision === "benign"
              ? "Normal"
              : "Anomaly",
            event: alarm.summary,
            ai_summary: alarm.ai_summary,
          }))}
          onEventSelect={handleEventClick}
          onLoadMore={loadMoreAlarms}
          hasMore={hasMore}
          isLoading={infiniteLoading}
        />
      ),
    [loading, error, infiniteAlarms, handleEventClick, hasMore, infiniteLoading]
  );

  const eventDetailWidget = useMemo(
    () =>
      selectedEvent ? (
        <EventDetail event={convertEventToEventDetail(selectedEvent)} />
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-slate-500 text-4xl mb-4">○</div>
            <div className="text-slate-400 text-sm mb-2">
              선택된 이벤트가 없습니다
            </div>
            <div className="text-slate-500 text-xs">
              아래 표에서 이벤트를 클릭하면 상세 정보가 표시됩니다
            </div>
          </div>
        </div>
      ),
    [selectedEvent]
  );

  const renderWidget = useCallback(
    (widget: any) => {
      switch (widget.type) {
        case "stats":
          return (
            <WidgetWrapper
              title="시스템 현황"
              onRemove={() => deleteWidget(widget.id)}
              widgetType="stats"
            >
              {statsWidget}
            </WidgetWrapper>
          );
        case "timeseries":
          return (
            <WidgetWrapper
              title="시간별 추이"
              onRemove={() => deleteWidget(widget.id)}
              widgetType="timeseries"
            >
              <TimeSeriesChart data={timeseriesData} />
            </WidgetWrapper>
          );
        case "donutchart":
          return (
            <WidgetWrapper
              title="위험 요소 분석"
              onRemove={() => deleteWidget(widget.id)}
              widgetType="donutchart"
            >
              <DonutChart />
            </WidgetWrapper>
          );
        case "eventtable":
          return (
            <WidgetWrapper
              title="보안 이벤트 목록"
              onRemove={() => deleteWidget(widget.id)}
              widgetType="eventtable"
            >
              {eventTableWidget}
            </WidgetWrapper>
          );
        case "eventdetail":
          return (
            <WidgetWrapper
              title="이벤트 상세정보"
              onRemove={() => deleteWidget(widget.id)}
              widgetType="eventdetail"
            >
              {eventDetailWidget}
            </WidgetWrapper>
          );
        default:
          return null;
      }
    },
    [statsWidget, eventTableWidget, eventDetailWidget, timeseriesData]
  );

  return (
    <DashboardLayout
      onLogout={handleLogout}
      onOpenSettings={handleOpenSettings}
    >
      <div className="h-full relative z-10">
        {/* Grid Layout */}
        {isLoaded ? (
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: currentLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            onLayoutChange={(layout) => {
              layout.forEach((item) => {
                updateWidgetPosition(item.i, {
                  x: item.x,
                  y: item.y,
                  w: item.w,
                  h: item.h,
                });
              });
            }}
            isDraggable={true}
            isResizable={true}
            resizeHandles={["se", "sw", "ne", "nw", "n", "s", "e", "w"]}
            margin={[16, 16]}
            useCSSTransforms={true}
            transformScale={1}
          >
            {widgets
              .filter((widget) => widget.visible)
              .map((widget) => (
                <div key={widget.id}>{renderWidget(widget)}</div>
              ))}
          </ResponsiveGridLayout>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-green-400 font-mono text-sm animate-pulse">
              대시보드 레이아웃을 불러오는 중...
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <DashboardSettings
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
