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
  toast_id?: string;
}

interface SSEContextType {
  sse: EventSource | null;
  alarms: Alarm[];
  notifications: Alarm[];
  sseConnected: boolean;
  sseError: string | null;
  addNotification: (alarm: Alarm) => void;
  clearNotifications: () => void;
  updateAlarm: (traceId: string, updates: Partial<Alarm>) => void;
  dequeueNotification: () => Alarm | null;
  dismissNotification: (id: string) => void;
  disconnectSSE: () => void;
}

const SSEContext = createContext<SSEContextType | undefined>(undefined);

export const useSSE = () => {
  const context = useContext(SSEContext);
  if (context === undefined) {
    throw new Error("useSSE must be used within a SSEProvider");
  }
  return context;
};

interface SSEProviderProps {
  children: ReactNode;
}

const DISMISSED_STORAGE_KEY = "dismissed_notifications";

export const SSEProvider: React.FC<SSEProviderProps> = ({ children }) => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [notifications, setNotifications] = useState<Alarm[]>([]);
  const notificationsRef = useRef<Alarm[]>([]);
  const [sse, setSse] = useState<EventSource | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [sseError, setSseError] = useState<string | null>(null);

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
  const manualStopRef = useRef(false);

  const disconnectSSE = () => {
    manualStopRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    try {
      sse?.close();
    } catch {}
    setSse(null);
    setSseConnected(false);
    setSseError(null);
  };

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
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    let esInstance: EventSource | null = null;

    const connectSSE = async () => {
      try {
        manualStopRef.current = false;
        let token = localStorage.getItem("token");
        if (!token) {
          try {
            token = await refreshAccessToken();
            if (token) localStorage.setItem("token", token);
          } catch (error) {
            setSseError("로그인이 필요합니다");
            scheduleReconnect();
            return;
          }
        }

        if (!token) {
          scheduleReconnect();
          return;
        }

        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost:8004";
        const base = origin.replace(/\/$/, "");
        const url = base.includes(":8004") ? base : "http://localhost:8004";
        const sseUrl = `${url}/sse/alarms?token=${encodeURIComponent(
          token
        )}&limit=100`;

        try {
          esInstance = new EventSource(sseUrl);
        } catch (e) {
          setSseError("SSE 연결 생성 실패");
          scheduleReconnect();
          return;
        }

        esInstance.onopen = () => {
          setSseConnected(true);
          setSseError(null);
        };

        esInstance.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "initial_data") {
              const initialAlarms = data.alarms || [];
              setAlarms(initialAlarms);
            } else if (data.type === "new_trace") {
              const newAlarm: Alarm = data.data;
              console.log("push", newAlarm.trace_id);
              const key = newAlarm.trace_id;
              pruneRecent();
              const now = Date.now();
              const recentExpire = recentMapRef.current.get(key) || 0;
              const dismissedExpire = dismissedRef.current[key] || 0;
              if (recentExpire > now || dismissedExpire > now) {
                console.log("skip recent", newAlarm.trace_id, {
                  recentExpire,
                  now,
                  dismissedExpire,
                });
                return;
              }
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
              setNotifications((prev) => {
                if (prev.some((n) => n.trace_id === newAlarm.trace_id))
                  return prev;
                const next = [
                  {
                    ...newAlarm,
                    isUpdated: true,
                    detected_at: newAlarm.detected_at,
                    toast_id: `${newAlarm.trace_id}-${Date.now()}`,
                  },
                  ...prev,
                ];
                notificationsRef.current = next;
                return next;
              });
              console.log("queued", newAlarm.trace_id);
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
                    } as Alarm;
                    return updatedAlarm;
                  }
                  return alarm;
                });
              });
            } else if (data.type === "ai_update") {
              if (!data.trace_id || !data.data) {
                return;
              }
              const traceId: string = data.trace_id;
              const payload = data.data || {};
              setAlarms((prevAlarms) => {
                const idx = prevAlarms.findIndex((a) => a.trace_id === traceId);
                if (idx >= 0) {
                  const updated = { ...prevAlarms[idx], ...payload } as Alarm;
                  const next = prevAlarms.slice();
                  next[idx] = updated;
                  return next;
                }
                return prevAlarms;
              });
            }
          } catch (e) {
            console.error("sse onmessage error", e);
          }
        };

        esInstance.onerror = () => {
          setSseConnected(false);
          setSseError("SSE 연결 오류");
          try {
            esInstance?.close();
          } catch {}
          if (!isUnmountedRef.current && !manualStopRef.current)
            scheduleReconnect();
        };

        setSse(esInstance);
      } catch (error) {
        setSseError("연결 실패");
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (manualStopRef.current || isUnmountedRef.current) return;
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE();
      }, 2000);
    };

    const onLogout = () => {
      try {
        esInstance?.close();
      } catch {}
      disconnectSSE();
    };

    const onLogin = () => {
      manualStopRef.current = false;
      if (!sse && !reconnectTimeoutRef.current) {
        connectSSE();
      }
    };

    window.addEventListener("auth:logout", onLogout);
    window.addEventListener("auth:login", onLogin);

    connectSSE();

    return () => {
      window.removeEventListener("auth:logout", onLogout);
      window.removeEventListener("auth:login", onLogin);
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
    setNotifications((prev) => {
      const next = [alarm, ...prev];
      notificationsRef.current = next;
      return next;
    });
  };

  const clearNotifications = () => {
    notificationsRef.current = [];
    setNotifications([]);
  };

  const dequeueNotification = (): Alarm | null => {
    const curr = notificationsRef.current;
    if (!curr || curr.length === 0) return null;
    const [head, ...rest] = curr;
    notificationsRef.current = rest;
    setNotifications(rest);
    return head || null;
  };

  const dismissNotification = (id: string) => {
    const ttl = 30 * 60 * 1000;
    const expire = Date.now() + ttl;
    dismissedRef.current[id] = expire;
    saveDismissed();
    setNotifications((prev) => {
      const next = prev.filter((n) => n.trace_id !== id);
      notificationsRef.current = next;
      return next;
    });
  };

  const updateAlarm = (traceId: string, updates: Partial<Alarm>) => {
    setAlarms((prev) =>
      prev.map((alarm) =>
        alarm.trace_id === traceId ? { ...alarm, ...updates } : alarm
      )
    );
  };

  return (
    <SSEContext.Provider
      value={{
        sse,
        alarms,
        notifications,
        sseConnected,
        sseError,
        addNotification,
        clearNotifications,
        updateAlarm,
        dequeueNotification,
        dismissNotification,
        disconnectSSE,
      }}
    >
      {children}
    </SSEContext.Provider>
  );
};
