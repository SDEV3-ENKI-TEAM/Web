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
import { useAuth } from "@/context/AuthContext";

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

const toTs = (t: any): number => {
  if (typeof t === "number") return t;
  if (typeof t === "string") {
    const n = Date.parse(t);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const getRecency = (a: any): number => {
  const u = (a && (a.updated_at as any)) || 0;
  const d = (a && (a.detected_at as any)) || 0;
  return Math.max(toTs(u), toTs(d));
};

const upsertByTraceId = (
  prev: Alarm[],
  items: Alarm[],
  limit: number = 100
): Alarm[] => {
  const map = new Map<string, Alarm>();
  for (const p of prev) map.set(p.trace_id, p);
  for (const incoming of items) {
    const ex = map.get(incoming.trace_id);
    if (!ex) {
      map.set(incoming.trace_id, incoming);
      continue;
    }
    const newer = getRecency(incoming) >= getRecency(ex);
    if (newer) {
      const merged: Alarm = {
        ...ex,
        ...incoming,
        detected_at: ex.detected_at ?? incoming.detected_at,
      } as Alarm;
      map.set(incoming.trace_id, merged);
    }
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => getRecency(b) - getRecency(a));
  return arr.slice(0, limit);
};

export const SSEProvider: React.FC<SSEProviderProps> = ({ children }) => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [notifications, setNotifications] = useState<Alarm[]>([]);
  const notificationsRef = useRef<Alarm[]>([]);
  const [sse, setSse] = useState<EventSource | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [sseError, setSseError] = useState<string | null>(null);
  const { isLoggedIn } = useAuth();

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
  const backoffAttemptRef = useRef(0);

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

    const scheduleReconnect = () => {
      if (manualStopRef.current || isUnmountedRef.current || !isLoggedIn)
        return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      const base = 1000;
      const max = 30000;
      const attempt = backoffAttemptRef.current || 0;
      const exp = Math.min(max, base * Math.pow(2, attempt));
      const jitter = Math.floor(exp * 0.1);
      const delay =
        exp + Math.floor(Math.random() * jitter) - Math.floor(jitter / 2);
      backoffAttemptRef.current = attempt + 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE();
      }, delay);
    };

    const connectSSE = async () => {
      if (!isLoggedIn) return;
      if (sse) return;
      try {
        manualStopRef.current = false;
        try {
          try {
            await fetch(`/api/alarms/warm-cache`, { method: "POST" });
          } catch {}
          esInstance = new EventSource(`/api/sse/alarms?limit=100`);
        } catch {
          setSseError("SSE 연결 생성 실패");
          scheduleReconnect();
          return;
        }

        esInstance.onopen = () => {
          setSseConnected(true);
          setSseError(null);
          backoffAttemptRef.current = 0;
        };

        esInstance.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "initial_data") {
              const initialAlarms = (data.alarms || []) as Alarm[];
              setAlarms((prev) => upsertByTraceId(prev, initialAlarms, 100));
              if ((initialAlarms?.length || 0) < 5) {
                fetch(`/api/alarms/warm-cache`, { method: "POST" }).catch(
                  () => {}
                );
              }
            } else if (data.type === "new_trace") {
              const newAlarm: Alarm = data.data;
              const key = newAlarm.trace_id;
              pruneRecent();
              const now = Date.now();
              const recentExpire = recentMapRef.current.get(key) || 0;
              const dismissedExpire = dismissedRef.current[key] || 0;
              if (recentExpire > now || dismissedExpire > now) {
                return;
              }
              recentMapRef.current.set(key, now + 10000);
              const withFlag = { ...newAlarm, isUpdated: true } as Alarm;
              setAlarms((prev) => {
                const next = upsertByTraceId(prev, [withFlag], 100);
                return next;
              });
              setHighlight(newAlarm.trace_id, 5000);
              setNotifications((prev) => {
                if (prev.some((n) => n.trace_id === newAlarm.trace_id))
                  return prev;
                const next = [
                  {
                    ...withFlag,
                    toast_id: `${Date.now()}-${newAlarm.trace_id}`,
                  },
                  ...prev,
                ];
                notificationsRef.current = next;
                return next;
              });
            } else if (data.type === "trace_update") {
              const updatedAlarm: Alarm = data.data;
              setAlarms((prev) => {
                const next = upsertByTraceId(prev, [updatedAlarm], 100);
                return next;
              });
              setHighlight(updatedAlarm.trace_id, 3000);
            } else if (data.type === "ai_update") {
              const aiUpdate = data.data || {};
              const traceId = data.trace_id as string;
              setAlarms((prev) =>
                prev.map((a) =>
                  a.trace_id === traceId
                    ? { ...a, ...aiUpdate, isUpdated: true }
                    : a
                )
              );
              setHighlight(traceId, 2000);
            }
          } catch (err) {
            setSseError("데이터 처리 중 오류");
          }
        };

        esInstance.onerror = () => {
          setSseConnected(false);
          setSseError("SSE 오류");
          if (!manualStopRef.current) scheduleReconnect();
        };

        setSse(esInstance);
      } catch (error) {
        setSseError("SSE 연결 실패");
        scheduleReconnect();
      }
    };

    if (isLoggedIn) {
      connectSSE();
    } else {
      disconnectSSE();
    }

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
  }, [isLoggedIn]);

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
