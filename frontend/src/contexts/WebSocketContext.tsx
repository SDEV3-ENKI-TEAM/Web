"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";

interface Alarm {
  trace_id: string;
  detected_at: number;
  summary: string;
  host: string;
  os: string;
  checked: boolean;
  sigma_alert?: string;
  span_count?: number;
  ai_summary?: string;
  severity?: string;
  severity_score?: number;
  sigma_rule_title?: string;
  isUpdated?: boolean;
}

interface WebSocketContextType {
  ws: WebSocket | null;
  alarms: Alarm[];
  notifications: Alarm[];
  wsConnected: boolean;
  wsError: string | null;
  addNotification: (alarm: Alarm) => void;
  clearNotifications: () => void;
  updateAlarm: (traceId: string, updates: Partial<Alarm>) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [notifications, setNotifications] = useState<Alarm[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  // 강조표시 자동 제거를 위한 타이머 관리
  const highlightTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 강조표시 자동 제거 함수
  const removeHighlight = (traceId: string) => {
    setAlarms((prev) =>
      prev.map((alarm) =>
        alarm.trace_id === traceId ? { ...alarm, isUpdated: false } : alarm
      )
    );
    highlightTimers.current.delete(traceId);
  };

  // 강조표시 설정 함수
  const setHighlight = (traceId: string, duration: number = 5000) => {
    // 기존 타이머가 있으면 제거
    const existingTimer = highlightTimers.current.get(traceId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 새로운 타이머 설정
    const timer = setTimeout(() => removeHighlight(traceId), duration);
    highlightTimers.current.set(traceId, timer);
  };

  useEffect(() => {
    let wsInstance: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      try {
        wsInstance = new WebSocket("ws://localhost:8004/ws/alarms?limit=100");

        wsInstance.onopen = () => {
          console.log("WebSocket 연결 성공");
          setWsConnected(true);
          setWsError(null);
        };

        wsInstance.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("WebSocket 메시지 수신:", data.type);

            if (data.type === "initial_data") {
              const initialAlarms = data.alarms || [];
              setAlarms(initialAlarms);
            } else if (data.type === "new_trace") {
              const newAlarm = data.data;

              // alarms 상태 업데이트
              setAlarms((prevAlarms) => {
                const exists = prevAlarms.find(
                  (alarm) => alarm.trace_id === newAlarm.trace_id
                );
                if (exists) return prevAlarms;

                const newAlarmWithHighlight = {
                  ...newAlarm,
                  isUpdated: true,
                  detected_at: newAlarm.detected_at,
                };

                // 강조표시 타이머 설정
                setHighlight(newAlarm.trace_id, 5000);

                return [newAlarmWithHighlight, ...prevAlarms.slice(0, 99)];
              });

              // notifications에 추가 (새로운 알림)
              setNotifications((prev) => [
                {
                  ...newAlarm,
                  isUpdated: true,
                  detected_at: newAlarm.detected_at,
                },
                ...prev.slice(0, 4), // 최대 5개 알림 유지
              ]);
            } else if (data.type === "trace_update") {
              if (!data.trace_id || !data.data) {
                console.warn("업데이트 데이터가 유효하지 않음:", data);
                return;
              }

              setAlarms((prevAlarms) => {
                return prevAlarms.map((alarm) => {
                  if (alarm.trace_id === data.trace_id) {
                    const updatedAlarm = {
                      ...alarm,
                      ...data.data,
                      detected_at: alarm.detected_at,
                      isUpdated: true, // 업데이트된 trace도 강조 효과 적용
                    };

                    // 강조표시 타이머 설정
                    setHighlight(data.trace_id, 3000);

                    return updatedAlarm;
                  }
                  return alarm;
                });
              });

              // 업데이트된 trace도 알림에 추가
              const updatedAlarm = data.data;
              setNotifications((prev) => [
                {
                  ...updatedAlarm,
                  isUpdated: true,
                  detected_at: updatedAlarm.detected_at,
                },
                ...prev.slice(0, 4), // 최대 5개 알림 유지
              ]);
            }
          } catch (e) {
            console.error("WebSocket 메시지 파싱 오류:", e);
          }
        };

        wsInstance.onclose = () => {
          console.log("WebSocket 연결 해제");
          setWsConnected(false);

          // 자동 재연결
          reconnectTimeout = setTimeout(() => {
            console.log("WebSocket 재연결 시도...");
            connectWebSocket();
          }, 3000);
        };

        wsInstance.onerror = (error) => {
          console.error("WebSocket 오류:", error);
          setWsError("WebSocket 연결 오류");
          setWsConnected(false);
        };

        setWs(wsInstance);
      } catch (e) {
        console.error("WebSocket 연결 실패:", e);
        setWsError("WebSocket 연결 실패");
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsInstance) {
        wsInstance.close();
      }
      // 강조표시 타이머 정리
      highlightTimers.current.forEach((timer) => clearTimeout(timer));
      highlightTimers.current.clear();
    };
  }, []);

  const addNotification = (alarm: Alarm) => {
    setNotifications((prev) => [alarm, ...prev.slice(0, 4)]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const updateAlarm = (traceId: string, updates: Partial<Alarm>) => {
    setAlarms((prev) =>
      prev.map((alarm) =>
        alarm.trace_id === traceId ? { ...alarm, ...updates } : alarm
      )
    );
  };

  const value: WebSocketContextType = {
    ws,
    alarms,
    notifications,
    wsConnected,
    wsError,
    addNotification,
    clearNotifications,
    updateAlarm,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
