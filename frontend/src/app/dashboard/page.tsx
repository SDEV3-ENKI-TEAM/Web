"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useDashboard } from "@/context/DashboardContext";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import DonutChart from "@/components/DonutChart";
import EventTable from "@/components/EventTable";
import EventDetail from "@/components/EventDetail";
import BarChart from "@/components/BarChart";
import HeatMap from "@/components/HeatMap";
import DashboardSettings from "@/components/DashboardSettings";
import { fetchEvents, fetchStats } from "@/lib/api";
import { Event, Stats, EventDetail as EventDetailType } from "@/types/event";

const ResponsiveGridLayout = WidthProvider(Responsive);

const defaultLayouts = {
  lg: [
    { i: "stat1", x: 0, y: 0, w: 3, h: 2 },
    { i: "stat2", x: 3, y: 0, w: 3, h: 2 },
    { i: "stat3", x: 6, y: 0, w: 3, h: 2 },
    { i: "stat4", x: 9, y: 0, w: 3, h: 2 },
    { i: "timeseries", x: 0, y: 2, w: 8, h: 4 },
    { i: "donut", x: 8, y: 2, w: 4, h: 4 },
    { i: "bar", x: 0, y: 6, w: 6, h: 4 },
    { i: "heatmap", x: 6, y: 6, w: 6, h: 4 },
    { i: "events", x: 0, y: 10, w: 12, h: 5 },
  ],
};

// Event를 EventDetail로 변환하는 함수
function convertEventToEventDetail(event: Event): EventDetailType {
  return {
    id: event.id,
    date: new Date(event.timestamp).toLocaleString("ko-KR"),
    anomalyScore: event.label === "Anomaly" ? 1.0 : 0.0,
    incident: `보안 이벤트 감지: 사용자 ${event.user}가 ${
      event.event
    } 활동을 수행했습니다. ${
      event.label === "Anomaly"
        ? "이 활동은 의심스러운 것으로 분류되어 조사가 필요합니다."
        : "이 활동은 정상적인 활동으로 보입니다."
    }`,
    rowData: {
      ip_address: "192.168.1." + (Math.floor(Math.random() * 254) + 1),
      user: event.user,
      number: event.id.toString(),
      location: "위치 정보 없음",
      timestamp: event.timestamp,
      event_type: event.event,
      anomaly_score: event.label === "Anomaly" ? "1.000" : "0.000",
      status: event.label,
    },
  };
}

export default function Dashboard() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalEvents: 0,
    anomalies: 0,
    avgAnomaly: 0,
    highestScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeseriesData, setTimeseriesData] = useState<any[]>([]);

  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const { widgets } = useDashboard();

  // Load data on mount (without auto-refresh)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [eventsData, statsData, alarmsData] = await Promise.all([
          fetchEvents(),
          fetchStats(),
          fetch("/api/alarms?offset=0&limit=10").then((res) => res.json()),
        ]);
        setEvents(eventsData);
        setStats(statsData);
        setAlarms(alarmsData.alarms || []);
        setError(null);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("보안 데이터를 불러오는데 실패했습니다");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 시계열 데이터 fetch
  useEffect(() => {
    const fetchTimeseries = async () => {
      try {
        const res = await fetch("/api/timeseries");
        if (!res.ok) throw new Error("시계열 데이터 요청 실패");
        const data = await res.json();
        setTimeseriesData(data);
      } catch (err) {
        console.error("시계열 데이터 로드 실패:", err);
        setTimeseriesData([]);
      }
    };
    fetchTimeseries();
  }, []);

  // Debug: 위젯 정보 출력
  useEffect(() => {
    console.log("Current widgets:", widgets);
    console.log("Events:", events.length);
    console.log("Stats:", stats);
  }, [widgets, events, stats]);

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

  // 실제 위젯 데이터로부터 레이아웃 생성 (메모이제이션)
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

  // Calculate threat level (메모이제이션)
  const threatData = useMemo(() => {
    const threatLevel =
      stats.anomalies > 10 ? "HIGH" : stats.anomalies > 5 ? "MEDIUM" : "LOW";
    const threatColor =
      threatLevel === "HIGH"
        ? "text-red-400"
        : threatLevel === "MEDIUM"
        ? "text-yellow-400"
        : "text-green-400";
    return { threatLevel, threatColor };
  }, [stats.anomalies]);

  // WidgetWrapper를 메모이제이션
  const WidgetWrapper = useCallback(
    ({ children, title, onRemove, widgetType }: any) => (
      <div className="h-full bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-lg overflow-hidden font-mono relative z-0">
        {/* Terminal Header */}
        <div className="bg-slate-800/70 border-b border-slate-700/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-400 text-sm ml-2">
              {title}.terminal
            </span>
          </div>
          <button
            onClick={onRemove}
            className="text-red-400 hover:text-red-300 transition-colors text-sm"
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
        <div className="p-4 h-full overflow-hidden">{children}</div>
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

  // 각 위젯을 개별적으로 메모이제이션
  const statsWidget = useMemo(
    () =>
      loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-green-400 font-mono text-sm animate-pulse">
            시스템 정보를 불러오는 중...
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-red-400 font-mono text-sm">오류: {error}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Events */}
          <div className="bg-slate-800/30 rounded border border-slate-700/50 p-4 hover:bg-slate-800/50 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded border border-blue-500/30 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-slate-400 text-xs font-mono uppercase tracking-wide">
                  전체 활동
                </div>
                <div className="text-blue-400 text-xl font-mono font-bold">
                  {stats.totalEvents}
                </div>
                <div className="text-slate-500 text-xs mt-1">
                  오늘 발생한 모든 활동 수
                </div>
              </div>
            </div>
            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full animate-pulse"
                style={{ width: "100%" }}
              ></div>
            </div>
          </div>

          {/* Anomalies */}
          <div className="bg-slate-800/30 rounded border border-slate-700/50 p-4 hover:bg-slate-800/50 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-red-500/20 rounded border border-red-500/30 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-slate-400 text-xs font-mono uppercase tracking-wide">
                  의심스러운 활동
                </div>
                <div className="text-red-400 text-xl font-mono font-bold">
                  {stats.anomalies}
                </div>
                <div className="text-slate-500 text-xs mt-1">
                  주의가 필요한 활동 수
                </div>
              </div>
            </div>
            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full animate-pulse"
                style={{
                  width: `${Math.min(
                    100,
                    (stats.anomalies / stats.totalEvents) * 100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Risk Ratio */}
          <div className="bg-slate-800/30 rounded border border-slate-700/50 p-4 hover:bg-slate-800/50 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-yellow-500/20 rounded border border-yellow-500/30 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-slate-400 text-xs font-mono uppercase tracking-wide">
                  위험도 비율
                </div>
                <div className="text-yellow-400 text-xl font-mono font-bold">
                  {stats.totalEvents > 0
                    ? ((stats.anomalies / stats.totalEvents) * 100).toFixed(1)
                    : 0}
                  %
                </div>
                <div className="text-slate-500 text-xs mt-1">
                  위험한 활동의 비율
                </div>
              </div>
            </div>
            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 rounded-full animate-pulse"
                style={{
                  width: `${
                    stats.totalEvents > 0
                      ? (stats.anomalies / stats.totalEvents) * 100
                      : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>

          {/* Threat Level */}
          <div className="bg-slate-800/30 rounded border border-slate-700/50 p-4 hover:bg-slate-800/50 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 ${
                  threatData.threatLevel === "HIGH"
                    ? "bg-red-500/20 border-red-500/30"
                    : threatData.threatLevel === "MEDIUM"
                    ? "bg-yellow-500/20 border-yellow-500/30"
                    : "bg-green-500/20 border-green-500/30"
                } rounded border flex items-center justify-center`}
              >
                <svg
                  className={`w-4 h-4 ${
                    threatData.threatLevel === "HIGH"
                      ? "text-red-400"
                      : threatData.threatLevel === "MEDIUM"
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-slate-400 text-xs font-mono uppercase tracking-wide">
                  보안 상태
                </div>
                <div
                  className={`text-xl font-mono font-bold ${threatData.threatColor}`}
                >
                  {threatData.threatLevel === "HIGH"
                    ? "위험"
                    : threatData.threatLevel === "MEDIUM"
                    ? "주의"
                    : "안전"}
                </div>
                <div className="text-slate-500 text-xs mt-1">
                  현재 시스템 보안 상태
                </div>
              </div>
            </div>
            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full animate-pulse ${
                  threatData.threatLevel === "HIGH"
                    ? "bg-red-500"
                    : threatData.threatLevel === "MEDIUM"
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{
                  width: `${
                    threatData.threatLevel === "HIGH"
                      ? 100
                      : threatData.threatLevel === "MEDIUM"
                      ? 60
                      : 30
                  }%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      ),
    [loading, error, stats, threatData]
  );

  const eventTableWidget = useMemo(
    () =>
      loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-green-400 font-mono text-sm animate-pulse">
            이벤트 정보를 불러오는 중...
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-red-400 font-mono text-sm">오류: {error}</div>
        </div>
      ) : (
        <EventTable
          events={alarms.map((alarm, index) => ({
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
            label: "Anomaly", // alarms는 에러 상태이므로 Anomaly
            event: alarm.summary,
          }))}
          onEventSelect={handleEventClick}
        />
      ),
    [loading, error, alarms, handleEventClick]
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
              onRemove={() => console.log("Remove widget:", widget.id)}
              widgetType="stats"
            >
              {statsWidget}
            </WidgetWrapper>
          );
        case "timeseries":
          return (
            <WidgetWrapper
              title="시간별 추이"
              onRemove={() => console.log("Remove widget:", widget.id)}
              widgetType="timeseries"
            >
              <TimeSeriesChart data={timeseriesData} />
            </WidgetWrapper>
          );
        case "donutchart":
          return (
            <WidgetWrapper
              title="위험 요소 분석"
              onRemove={() => console.log("Remove widget:", widget.id)}
              widgetType="donutchart"
            >
              <DonutChart />
            </WidgetWrapper>
          );
        case "barchart":
          return (
            <WidgetWrapper
              title="분류별 현황"
              onRemove={() => console.log("Remove widget:", widget.id)}
              widgetType="barchart"
            >
              <BarChart />
            </WidgetWrapper>
          );
        case "heatmap":
          return (
            <WidgetWrapper
              title="상관관계 분석"
              onRemove={() => console.log("Remove widget:", widget.id)}
              widgetType="heatmap"
            >
              <HeatMap />
            </WidgetWrapper>
          );
        case "eventtable":
          return (
            <WidgetWrapper
              title="보안 이벤트 목록"
              onRemove={() => console.log("Remove widget:", widget.id)}
              widgetType="eventtable"
            >
              {eventTableWidget}
            </WidgetWrapper>
          );
        case "eventdetail":
          return (
            <WidgetWrapper
              title="이벤트 상세정보"
              onRemove={() => console.log("Remove widget:", widget.id)}
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
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: currentLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          onLayoutChange={() => {}}
          isDraggable={true}
          isResizable={true}
          margin={[16, 16]}
        >
          {widgets
            .filter((widget) => widget.visible)
            .map((widget) => (
              <div key={widget.id}>{renderWidget(widget)}</div>
            ))}
        </ResponsiveGridLayout>

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
