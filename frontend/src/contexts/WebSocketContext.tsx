"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { refreshAccessToken } from "@/lib/axios";

interface Alarm {
  trace_id: string;
  detected_at: number | string;
  summary: string;
  host: string;
  os: string;
  checked: boolean;
  sigma_alert?: string;
  matched_span_count?: number;
  ai_summary?: string;
  severity?: string;
  severity_score?: number;
  sigma_rule_title?: string;
  isUpdated?: boolean;
}

interface WebSocketContextType {
  ws: EventSource | null;
  alarms: Alarm[];
  notifications: Alarm[];
  wsConnected: boolean;
  wsError: string | null;
  addNotification: (alarm: Alarm) => void;
  clearNotifications: () => void;
  updateAlarm: (traceId: string, updates: Partial<Alarm>) => void;
  dequeueNotification: () => Alarm | null;
  dismissNotification: (id: string) => void;
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

const DISMISSED_STORAGE_KEY = "dismissed_notifications";

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [notifications, setNotifications] = useState<Alarm[]>([]);
  const [ws, setWs] = useState<EventSource | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  const highlightTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeHighlight = (traceId: string) => {
    setAlarms((prev) =>
      prev.map((alarm) =>
        alarm.trace_id === traceId ? { ...alarm, isUpdated: false } : alarm
      )
    );
    highlightTimers.current.delete(traceId);
  };

  const setHighlight = (traceId: string, duration: number = 5000) => {
    const existingTimer = highlightTimers.current.get(traceId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => removeHighlight(traceId), duration);
    highlightTimers.current.set(traceId, timer);
  };

  const isUnmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recentMapRef = useRef<Map<string, number>>(new Map());
  const dismissedRef = useRef<Record<string, number>>({});

  const pruneRecent = () => {
    const now = Date.now();
    const m = recentMapRef.current;
    Array.from(m.entries()).forEach(([k, expire]) => {
      if (expire <= now) m.delete(k);
    });
  };

  const loadDismissed = () => {
    try {
      const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
      const obj = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      const now = Date.now();
      const pruned: Record<string, number> = {};
      Object.entries(obj).forEach(([k, t]) => {
        if (t > now) pruned[k] = t;
      });
      dismissedRef.current = pruned;
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(pruned));
    } catch {}
  };

  const saveDismissed = () => {
    try {
      localStorage.setItem(
        DISMISSED_STORAGE_KEY,
        JSON.stringify(dismissedRef.current)
      );
    } catch {}
  };

  useEffect(() => {
    loadDismissed();
  }, []);

  useEffect(() => {
    let esInstance: EventSource | null = null;

    const connectSSE = async () => {
      try {
        let token = localStorage.getItem("token");
        if (!token) {
          try {
            token = await refreshAccessToken();
          } catch (error) {
            setWsError("로그인이 필요합니다");
            return;
          }
        }

        const sseUrl = `http://localhost:8004/sse/alarms?token=${encodeURIComponent(
          token
        )}&limit=100`;

        try {
          esInstance = new EventSource(sseUrl);
        } catch (e) {
          setWsError("SSE 연결 생성 실패");
          scheduleReconnect();
          return;
        }

        esInstance.onopen = () => {
          setWsConnected(true);
          setWsError(null);
        };

        esInstance.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "initial_data") {
              const initialAlarms = data.alarms || [];
              setAlarms(initialAlarms);
            } else if (data.type === "new_trace") {
              const newAlarm: Alarm = data.data;
              const key = newAlarm.trace_id;
              pruneRecent();
              const now = Date.now();
              const recentExpire = recentMapRef.current.get(key) || 0;
              const dismissedExpire = dismissedRef.current[key] || 0;
              if (recentExpire > now || dismissedExpire > now) return;
              recentMapRef.current.set(key, now + 10000);
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
                setHighlight(newAlarm.trace_id, 5000);
                return [newAlarmWithHighlight, ...prevAlarms.slice(0, 99)];
              });
              setNotifications((prev) => [
                {
                  ...newAlarm,
                  isUpdated: true,
                  detected_at: newAlarm.detected_at,
                },
                ...prev,
              ]);
            } else if (data.type === "trace_update") {
              if (!data.trace_id || !data.data) {
                return;
              }
              setAlarms((prevAlarms) => {
                return prevAlarms.map((alarm) => {
                  if (alarm.trace_id === data.trace_id) {
                    const updatedAlarm = {
                      ...alarm,
                      ...data.data,
                      detected_at: alarm.detected_at,
                      isUpdated: true,
                    } as Alarm;
                    setHighlight(data.trace_id, 3000);
                    return updatedAlarm;
                  }
                  return alarm;
                });
              });
            }
          } catch (e) {}
        };

        esInstance.onerror = () => {
          setWsConnected(false);
          setWsError("SSE 연결 오류");
          try {
            esInstance?.close();
          } catch {}
          if (!isUnmountedRef.current) scheduleReconnect();
        };

        setWs(esInstance);
      } catch (error) {
        setWsError("연결 실패");
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE();
      }, 3000);
    };

    connectSSE();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (esInstance) {
        try {
          esInstance.close();
        } catch {}
      }
    };
  }, []);

  const addNotification = (alarm: Alarm) => {
    setNotifications((prev) => [alarm, ...prev]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const dequeueNotification = (): Alarm | null => {
    let next: Alarm | null = null;
    setNotifications((prev) => {
      if (prev.length === 0) {
        next = null;
        return prev;
      }
      const [, ...rest] = prev;
      next = prev[0];
      return rest;
    });
    return next;
  };

  const dismissNotification = (id: string) => {
    const ttl = 30 * 60 * 1000;
    const expire = Date.now() + ttl;
    dismissedRef.current[id] = expire;
    saveDismissed();
    setNotifications((prev) => prev.filter((n) => n.trace_id !== id));
  };

  const updateAlarm = (traceId: string, updates: Partial<Alarm>) => {
    setAlarms((prev) =>
      prev.map((alarm) =>
        alarm.trace_id === traceId ? { ...alarm, ...updates } : alarm
      )
    );
  };

  return (
    <WebSocketContext.Provider
      value={{
        ws,
        alarms,
        notifications,
        wsConnected,
        wsError,
        addNotification,
        clearNotifications,
        updateAlarm,
        dequeueNotification,
        dismissNotification,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
